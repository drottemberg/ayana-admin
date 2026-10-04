import { getLocalStorage, removeLocalStorage, setLocalStorage } from '@/utils/storage-utils'

export type AppSettings = {
  sidebarOpen: boolean
}

const APP_SETTINGS_KEY = 'app_settings'

export const DEFAULT_APP_SETTINGS: AppSettings = {
  sidebarOpen: true,
}

export function readAppSettings(): AppSettings {
  const parsed = getLocalStorage<Partial<AppSettings>>(APP_SETTINGS_KEY)

  if (parsed && typeof parsed === 'object') {
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
    }
  }

  return DEFAULT_APP_SETTINGS
}

export function saveAppSettings(settings: AppSettings): void {
  setLocalStorage(APP_SETTINGS_KEY, settings)
}

export function clearAppSettings(): void {
  removeLocalStorage(APP_SETTINGS_KEY)
}
