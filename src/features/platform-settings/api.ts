import { apiClient } from '@/lib/api-client'

export type PlatformSettings = { whatsappNotificationsEnabled: boolean }

export function getPlatformSettingsRequest(): Promise<PlatformSettings> {
  return apiClient.get<PlatformSettings>('/platform-settings')
}

export function updatePlatformSettingsRequest(input: PlatformSettings): Promise<PlatformSettings> {
  return apiClient.patch<PlatformSettings>('/platform-settings', input)
}
