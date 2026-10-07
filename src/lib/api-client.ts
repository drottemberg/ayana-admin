import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type Method } from 'axios'
import { ALL_LOCATIONS_SCOPE, clearSelectedOrgId, readSelectedLocationScope, readSelectedOrgId } from '@/features/organizations/storage'
import { getAppMode } from '@/features/app/app-mode'
import {
  deleteCookie,
  getCookie,
  getLocalStorage,
  removeLocalStorage,
  setCookie,
  setLocalStorage,
} from '@/utils/storage-utils'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'
const AUTH_TOKEN_KEY = 'auth_token'
const AUTH_REFRESH_TOKEN_KEY = 'auth_refresh_token'
const CLIENT_SETTINGS_KEY = 'api_client_settings'
const DEFAULT_CULTURE = 'en'

export const API_STATUS_EVENT_NAME = 'gkmanager:api-status'
export const AUTH_TOKEN_REFRESHED_EVENT_NAME = 'ayana:auth-token-refreshed'

export class ApiError extends Error {
  status: number | null
  cause?: unknown

  constructor(message: string, status: number | null, cause?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.cause = cause
  }
}

type TokenResponse = {
  token: string
  refreshToken: string
}

type ClientSettings = {
  culture?: string
}

function notifyApiStatus(error: ApiError | null) {
  window.dispatchEvent(new CustomEvent(API_STATUS_EVENT_NAME, { detail: { error } }))
}

function getTimezoneHeaders() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return {
    'x-timezone': timezone,
    'x-gmt-offset': String(new Date().getTimezoneOffset()),
  }
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined
    return new ApiError(
      data?.message ?? data?.error ?? error.message ?? 'Request failed.',
      error.response?.status ?? null,
      error,
    )
  }

  return new ApiError(error instanceof Error ? error.message : 'Request failed.', null, error)
}

export class ApiClient {
  private readonly axios: AxiosInstance
  private logoutRedirectPending = false
  private refreshInFlight: Promise<TokenResponse> | null = null
  culture: string

  constructor() {
    const settings = this.getSettings()

    this.culture = settings.culture ?? DEFAULT_CULTURE
    this.axios = axios.create({
      baseURL: API_URL,
      responseType: 'json',
    })
    this.configureInterceptors()
  }

  getSettings(): ClientSettings {
    return getLocalStorage<ClientSettings>(CLIENT_SETTINGS_KEY) ?? {}
  }

  saveSettings(settings: ClientSettings = this.getSettings()): void {
    setLocalStorage(CLIENT_SETTINGS_KEY, settings)
  }

  setSettingsItem<TKey extends keyof ClientSettings>(key: TKey, value: ClientSettings[TKey] | null): void {
    const settings = this.getSettings()

    if (value == null) {
      delete settings[key]
    } else {
      settings[key] = value
    }

    this.saveSettings(settings)
  }

  clearSettings(): void {
    removeLocalStorage(CLIENT_SETTINGS_KEY)
  }

  setCulture(culture: string): void {
    this.culture = culture
    this.setSettingsItem('culture', culture)
  }

  getCulture(): string {
    return this.culture || DEFAULT_CULTURE
  }

  getAuthToken(): string | null {
    return getCookie(AUTH_TOKEN_KEY)
  }

  getRefreshToken(): string | null {
    return getCookie(AUTH_REFRESH_TOKEN_KEY)
  }

  setTokens(token: string, refreshToken?: string | null): void {
    setCookie(AUTH_TOKEN_KEY, token)
    if (refreshToken) {
      setCookie(AUTH_REFRESH_TOKEN_KEY, refreshToken)
    }
    window.dispatchEvent(new CustomEvent(AUTH_TOKEN_REFRESHED_EVENT_NAME))
  }

  clearTokens(): void {
    deleteCookie(AUTH_TOKEN_KEY)
    deleteCookie(AUTH_REFRESH_TOKEN_KEY)
  }

  async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('GET', path, undefined, config)
  }

  async post<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('POST', path, data, config)
  }

  async patch<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('PATCH', path, data, config)
  }

  async delete<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>('DELETE', path, data, config)
  }

  async request<T>(method: Method, path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axios.request<T>({
        ...config,
        method,
        url: path,
        data,
      })

      return response.data
    } catch (error) {
      throw toApiError(error)
    }
  }

  async login<T extends TokenResponse>(path: string, payload: unknown): Promise<T> {
    const response = await this.post<T>(path, payload)
    this.setTokens(response.token, response.refreshToken)

    return response
  }

  async logout(path = '/auth/logout'): Promise<void> {
    try {
      await this.post(path)
    } finally {
      this.clearTokens()
      this.clearSettings()
    }
  }

  async refreshSession(): Promise<boolean> {
    if (!this.getRefreshToken()) {
      this.logoutAfterUnauthorized()
      return false
    }

    try {
      await this.refreshTokens()
      return true
    } catch (error) {
      if (toApiError(error).status === 401) {
        this.logoutAfterUnauthorized()
      }
      return false
    }
  }

  private refreshTokens(): Promise<TokenResponse> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) return Promise.reject(new ApiError('Refresh token is missing.', 401))
    if (this.refreshInFlight) return this.refreshInFlight

    this.refreshInFlight = this.axios
      .post<TokenResponse>('/auth/refresh', { refreshToken })
      .then(({ data }) => {
        this.setTokens(data.token, data.refreshToken)
        return data
      })
      .finally(() => {
        this.refreshInFlight = null
      })

    return this.refreshInFlight
  }

  private configureInterceptors() {
    this.axios.interceptors.request.use((config) => {
      const token = this.getAuthToken()
      const selectedCustomerId = token ? readSelectedOrgId() : null
      const requestedOrgId = config.headers.get('x-org-id')
      const locationScope = token && selectedCustomerId && getAppMode() === 'customer'
        ? readSelectedLocationScope(selectedCustomerId)
        : null
      const selectedLocationId = locationScope && locationScope !== ALL_LOCATIONS_SCOPE ? locationScope : null
      const orgId = requestedOrgId ?? selectedLocationId ?? selectedCustomerId
      const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData

      if (!isFormData) {
        config.headers.set('Content-Type', 'application/json')
      }
      config.headers.set('x-culture', this.getCulture())
      config.headers.set('x-app-context', getAppMode() === 'admin' ? 'ADMIN' : 'CUSTOMER')

      const timezoneHeaders = getTimezoneHeaders()
      config.headers.set('x-timezone', timezoneHeaders['x-timezone'])
      config.headers.set('x-gmt-offset', timezoneHeaders['x-gmt-offset'])

      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`)
      }
      if (orgId) config.headers.set('x-org-id', String(orgId))

      return config
    })

    this.axios.interceptors.response.use(
      (response) => {
        notifyApiStatus(null)
        return response
      },
      async (error: AxiosError) => {
        const status = error.response?.status ?? null

        const request = error.config as (AxiosRequestConfig & { _authRetry?: boolean }) | undefined
        const requestUrl = request?.url ?? ''
        const isAuthEndpoint =
          requestUrl.includes('/auth/login') ||
          requestUrl.includes('/auth/refresh') ||
          requestUrl.includes('/auth/logout')

        if (status === 401 && !isAuthEndpoint && request && !request._authRetry) {
          request._authRetry = true
          if (this.getRefreshToken()) {
            try {
              const tokens = await this.refreshTokens()
              request.headers = request.headers ?? {}
              if ('set' in request.headers && typeof request.headers.set === 'function') {
                request.headers.set('Authorization', `Bearer ${tokens.token}`)
              } else {
                ;(request.headers as Record<string, string>).Authorization = `Bearer ${tokens.token}`
              }
              return this.axios.request(request)
            } catch (refreshError) {
              if (toApiError(refreshError).status === 401) {
                this.logoutAfterUnauthorized()
              }
              throw toApiError(error)
            }
          }
          this.logoutAfterUnauthorized()
        } else if (status === 401 && !isAuthEndpoint && request?._authRetry) {
          this.logoutAfterUnauthorized()
        }

        const apiError = toApiError(error)
        if (error.code === 'ERR_NETWORK') {
          notifyApiStatus(apiError)
        }
        throw apiError
      },
    )
  }

  private logoutAfterUnauthorized(): void {
    const hasSession = Boolean(this.getAuthToken() || this.getRefreshToken())
    if (!hasSession) return

    this.clearTokens()
    this.clearSettings()
    clearSelectedOrgId()

    if (this.logoutRedirectPending || window.location.pathname === '/login') return

    this.logoutRedirectPending = true
    window.location.replace('/login')
  }
}

export const apiClient = new ApiClient()
