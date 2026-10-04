import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type Method } from 'axios'
import { readSelectedOrgId } from '@/features/organizations/storage'
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

type RetryableAxiosRequestConfig = AxiosRequestConfig & {
  _retry?: boolean
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
  private refreshTokenRequest: Promise<boolean> | null = null
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

  async refreshToken(): Promise<boolean> {
    if (this.refreshTokenRequest) return this.refreshTokenRequest

    const refreshToken = this.getRefreshToken()
    if (!refreshToken) return false

    this.refreshTokenRequest = this.axios
      .post<TokenResponse>('/auth/refresh', { refreshToken })
      .then((tokens) => {
        this.setTokens(tokens.data.token, tokens.data.refreshToken)
        return true
      })
      .catch(() => {
        this.clearTokens()
        return false
      })
      .finally(() => {
        this.refreshTokenRequest = null
      })

    return this.refreshTokenRequest
  }

  private configureInterceptors() {
    this.axios.interceptors.request.use((config) => {
      const token = this.getAuthToken()
      const orgId = token ? readSelectedOrgId() : null
      const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData

      if (!isFormData) {
        config.headers.set('Content-Type', 'application/json')
      }
      config.headers.set('x-culture', this.getCulture())

      const timezoneHeaders = getTimezoneHeaders()
      config.headers.set('x-timezone', timezoneHeaders['x-timezone'])
      config.headers.set('x-gmt-offset', timezoneHeaders['x-gmt-offset'])

      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`)
      }
      if (orgId) {
        config.headers.set('x-org-id', orgId)
      }

      return config
    })

    this.axios.interceptors.response.use(
      (response) => {
        notifyApiStatus(null)
        return response
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as RetryableAxiosRequestConfig | undefined
        const status = error.response?.status ?? null
        const isRefreshRequest = originalRequest?.url === '/auth/refresh'

        if (status === 401 && originalRequest && !originalRequest._retry && !isRefreshRequest) {
          originalRequest._retry = true
          const refreshed = await this.refreshToken()

          if (refreshed) {
            return this.axios.request(originalRequest)
          }
        }

        const apiError = toApiError(error)
        if (error.code === 'ERR_NETWORK') {
          notifyApiStatus(apiError)
        }
        throw apiError
      },
    )
  }
}

export const apiClient = new ApiClient()
