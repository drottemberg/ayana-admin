import { useEffect, useMemo, useReducer } from 'react'
import {
  clearAppSettings,
  DEFAULT_APP_SETTINGS,
  readAppSettings,
  saveAppSettings,
  type AppSettings,
} from '@/features/app-settings/storage'
import { AppSettingsContext, type AppSettingsContextValue } from '@/providers/app-settings-context'

type AppSettingsAction =
  | { type: 'setSidebarOpen'; payload: boolean }
  | { type: 'update'; payload: Partial<AppSettings> }
  | { type: 'reset' }

function appSettingsReducer(state: AppSettings, action: AppSettingsAction): AppSettings {
  switch (action.type) {
    case 'setSidebarOpen':
      return {
        ...state,
        sidebarOpen: action.payload,
      }
    case 'update':
      return {
        ...state,
        ...action.payload,
      }
    case 'reset':
      return DEFAULT_APP_SETTINGS
    default:
      return state
  }
}

export function AppSettingsProvider({ children }: React.PropsWithChildren) {
  const [settings, dispatch] = useReducer(appSettingsReducer, undefined, readAppSettings)

  useEffect(() => {
    saveAppSettings(settings)
  }, [settings])

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      settings,
      setSidebarOpen: (open) => {
        dispatch({ type: 'setSidebarOpen', payload: open })
      },
      updateSettings: (patch) => {
        dispatch({ type: 'update', payload: patch })
      },
      resetSettings: () => {
        clearAppSettings()
        dispatch({ type: 'reset' })
      },
    }),
    [settings],
  )

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}
