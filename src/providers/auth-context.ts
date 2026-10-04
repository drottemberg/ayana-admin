import { createContext } from 'react'
import type { User } from '@/types'

export type AuthContextValue = {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void> | void
  requestPasswordReset: (email: string) => Promise<string | null>
  completePasswordReset: (password: string, token?: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
