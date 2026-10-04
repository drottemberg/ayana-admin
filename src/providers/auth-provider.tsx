import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPasswordRequest, forgotPasswordRequest, loginRequest, logoutRequest } from '@/lib/api/auth'
import { AuthContext, type AuthContextValue } from '@/providers/auth-context'
import { appQueryKeys } from '@/features/app/query-keys'
import { clearSelectedOrgId } from '@/features/organizations/storage'
import { connectAppRequest } from '@/lib/api/app'
import { apiClient } from '@/lib/api-client'
import { AppConnectEntity } from '@/lib/entities/app-connect.entity'
import { getLocalStorage, removeLocalStorage, setLocalStorage } from '@/utils/storage-utils'

const RESET_TOKEN_KEY = 'reset_token'

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
    if (!hasToken || !connectQuery.isError) return

    apiClient.clearTokens()
    clearSelectedOrgId()
    queryClient.setQueryData(appQueryKeys.connect, null)
    queryClient.removeQueries({ queryKey: appQueryKeys.connect })
    setAuthVersion((version) => version + 1)
  }, [connectQuery.isError, hasToken, queryClient])

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
    [createPasswordMutation, forgotPasswordMutation, isLoading, loginMutation, queryClient, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
