import { createContext } from 'react'
import type { AppSettings } from '@/features/app-settings/storage'

export type AppSettingsContextValue = {
  settings: AppSettings
  setSidebarOpen: (open: boolean) => void
  updateSettings: (patch: Partial<AppSettings>) => void
  resetSettings: () => void
}

export const AppSettingsContext = createContext<AppSettingsContextValue | null>(null)
