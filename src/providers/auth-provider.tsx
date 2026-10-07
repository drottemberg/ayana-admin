import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPasswordRequest,
  forgotPasswordRequest,
  loginRequest,
  logoutRequest,
  signupRequest,
} from '@/lib/api/auth'
import { AuthContext, type AuthContextValue } from '@/providers/auth-context'
import { appQueryKeys } from '@/features/app/query-keys'
import { clearSelectedOrgId } from '@/features/organizations/storage'
import { connectAppRequest } from '@/lib/api/app'
import { apiClient, AUTH_TOKEN_REFRESHED_EVENT_NAME } from '@/lib/api-client'
import { AppConnectEntity } from '@/lib/entities/app-connect.entity'
import { getLocalStorage, removeLocalStorage, setLocalStorage } from '@/utils/storage-utils'

const RESET_TOKEN_KEY = 'reset_token'
const DEFAULT_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000
const REFRESH_EARLY_BY_MS = 60 * 1000

function getRefreshDelay(token: string | null): number {
  if (!token) return DEFAULT_ACCESS_TOKEN_TTL_MS - REFRESH_EARLY_BY_MS
  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as {
      exp?: number
    }
    if (typeof decoded.exp === 'number') {
      return Math.max(0, decoded.exp * 1000 - Date.now() - REFRESH_EARLY_BY_MS)
    }
  } catch {
    // Use the configured access-token lifetime when the token cannot be decoded.
  }
  return DEFAULT_ACCESS_TOKEN_TTL_MS - REFRESH_EARLY_BY_MS
}

export function AuthProvider({ children }: React.PropsWithChildren) {
  const queryClient = useQueryClient()
  const [authVersion, setAuthVersion] = useState(0)
  const token = apiClient.getAuthToken()
  const hasToken = Boolean(token)
  const connectQuery = useQuery({
    queryKey: appQueryKeys.connect,
    queryFn: connectAppRequest,
    enabled: hasToken,
  })
  const session = useMemo(
    () => (connectQuery.data ? new AppConnectEntity(connectQuery.data) : null),
    [connectQuery.data],
  )
  const user = session?.user.toJSON() ?? null
  const isLoading = hasToken && connectQuery.isLoading

  useEffect(() => {
    if (!session) return

    session.syncSelectedOrganization()
  }, [session])

  useEffect(() => {
    const handleTokenRefresh = () => setAuthVersion((version) => version + 1)
    window.addEventListener(AUTH_TOKEN_REFRESHED_EVENT_NAME, handleTokenRefresh)
    return () => window.removeEventListener(AUTH_TOKEN_REFRESHED_EVENT_NAME, handleTokenRefresh)
  }, [])

  useEffect(() => {
    if (!hasToken || !apiClient.getRefreshToken()) return
    let timer: number | undefined
    let cancelled = false

    const scheduleRefresh = (delay: number) => {
      timer = window.setTimeout(async () => {
        if (cancelled) return
        const refreshed = await apiClient.refreshSession()
        if (!refreshed && !cancelled && apiClient.getAuthToken() && apiClient.getRefreshToken()) {
          scheduleRefresh(30 * 1000)
        }
      }, delay)
    }

    scheduleRefresh(getRefreshDelay(token))
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [hasToken, token, authVersion])

  useEffect(() => {
    if (hasToken) return

    queryClient.setQueryData(appQueryKeys.connect, null)
  }, [hasToken, queryClient])

  // Keep this state local to trigger a render when apiClient token state changes.
  void authVersion

  const refreshAppSession = async () => {
    const dto = await connectAppRequest()
    const session = new AppConnectEntity(dto)
    session.syncSelectedOrganization()
    queryClient.setQueryData(appQueryKeys.connect, dto)

    return session
  }

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => loginRequest(email, password),
    onSuccess: async () => {
      await refreshAppSession()
      setAuthVersion((version) => version + 1)
    },
  })

  const signupMutation = useMutation({
    mutationFn: ({
      requestId,
      email,
      name,
      password,
    }: {
      requestId: string | undefined
      email: string
      name: string
      password: string
    }) => signupRequest(requestId, { email, name, password }),
    onSuccess: async () => {
      await refreshAppSession()
      setAuthVersion((version) => version + 1)
    },
  })

  const forgotPasswordMutation = useMutation({
    mutationFn: (email: string) => forgotPasswordRequest(email),
    onSuccess: (resetToken) => {
      if (resetToken) {
        setLocalStorage(RESET_TOKEN_KEY, resetToken)
      }
    },
  })

  const createPasswordMutation = useMutation({
    mutationFn: ({ resetToken, password }: { resetToken: string; password: string }) =>
      createPasswordRequest(resetToken, password),
    onSuccess: () => {
      removeLocalStorage(RESET_TOKEN_KEY)
    },
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !isLoading && Boolean(token && user),
      login: async (email, password) => {
        await loginMutation.mutateAsync({ email, password })
      },
      signup: async (requestId, email, name, password) => {
        await signupMutation.mutateAsync({ requestId, email, name, password })
      },
      logout: async () => {
        try {
          await logoutRequest()
        } catch {
          // Local logout should still clear stale sessions when the API is unavailable.
        }
        apiClient.clearTokens()
        clearSelectedOrgId()
        queryClient.setQueryData(appQueryKeys.connect, null)
        queryClient.removeQueries({ queryKey: appQueryKeys.connect })
        setAuthVersion((version) => version + 1)
      },
      requestPasswordReset: async (email) => {
        return forgotPasswordMutation.mutateAsync(email)
      },
      completePasswordReset: async (password, tokenFromParam) => {
        const resetToken = tokenFromParam ?? getLocalStorage<string>(RESET_TOKEN_KEY)

        if (!resetToken) {
          throw new Error('Reset session expired. Please request password reset again.')
        }

        await createPasswordMutation.mutateAsync({ resetToken, password })
      },
    }),
    [
      createPasswordMutation,
      forgotPasswordMutation,
      isLoading,
      loginMutation,
      queryClient,
      signupMutation,
      token,
      user,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
