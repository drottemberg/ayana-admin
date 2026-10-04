import { apiClient } from '@/lib/api-client'

export type AuthResponse = {
  token: string
  refreshToken: string
}

export function loginRequest(email: string, password: string): Promise<AuthResponse> {
  return apiClient.login<AuthResponse>('/auth/login', { email, password })
}

export async function logoutRequest(): Promise<void> {
  await apiClient.logout('/auth/logout')
}

export async function forgotPasswordRequest(email: string): Promise<string | null> {
  const response = await apiClient.post<{ ok: boolean; token?: string }>('/auth/forgot-password', { email })

  return response.token ?? null
}

export async function createPasswordRequest(token: string, password: string): Promise<void> {
  await apiClient.post<{ ok: boolean }>('/auth/reset-password', {
    token,
    newPassword: password,
  })
}
