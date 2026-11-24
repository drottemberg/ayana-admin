import { useEffect } from 'react'
import { App } from '@capacitor/app'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { apiClient, AUTH_TOKEN_REFRESHED_EVENT_NAME } from '@/lib/api-client'
import { useAuth } from '@/providers/use-auth'

const APP_ID = import.meta.env.VITE_APP_ID?.trim()
const DEVICE_ID_KEY = 'ayana.native-push.device-id.v1'
const TOKEN_KEY = 'ayana.native-push.token.v1:club.ayana.admin'

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function NativePushRegistration() {
  const { user } = useAuth()
  const accessToken = apiClient.getAuthToken()

  useEffect(() => {
    if (!user || !accessToken || !APP_ID || !Capacitor.isNativePlatform()) return
    const platform = Capacitor.getPlatform()
    if (platform !== 'android' && platform !== 'ios') return

    let cancelled = false
    let isActive = false
    let registering = false
    let tokenListener: PluginListenerHandle | undefined
    let errorListener: PluginListenerHandle | undefined
    let appStateListener: PluginListenerHandle | undefined
    const currentDeviceId = deviceId()

    const syncToken = async (token: string) => {
      localStorage.setItem(TOKEN_KEY, token)
      await apiClient.post('/messaging/native-push/register', {
        deviceId: currentDeviceId,
        platform,
        token,
        appId: APP_ID,
        culture: apiClient.getCulture(),
        model: navigator.userAgent,
        os: platform,
      })
      isActive = true
    }

    const refreshIfEnabled = async () => {
      if (cancelled || !isActive || registering) return
      const permission = await PushNotifications.checkPermissions()
      if (permission.receive !== 'granted') return
      registering = true
      try {
        const cachedToken = localStorage.getItem(TOKEN_KEY)
        if (cachedToken) await syncToken(cachedToken)
        await PushNotifications.register()
      } catch {
        // The next app resume retries with the cached token.
      } finally {
        registering = false
      }
    }

    void (async () => {
      try {
        tokenListener = await PushNotifications.addListener('registration', ({ value }) => {
          void syncToken(value).catch(() => undefined)
        })
        errorListener = await PushNotifications.addListener('registrationError', () => undefined)
        appStateListener = await App.addListener('appStateChange', ({ isActive: foregrounded }) => {
          if (foregrounded) void refreshIfEnabled()
        })
        const status = await apiClient.get<{ active: boolean }>(
          `/messaging/native-push/status?deviceId=${encodeURIComponent(currentDeviceId)}&platform=${platform}&appId=${encodeURIComponent(APP_ID)}`,
        )
        if (cancelled || !status.active) return
        isActive = true
        await refreshIfEnabled()
      } catch {
        // Push registration is optional and must not block app startup.
      }
    })()

    const onTokenRefresh = () => {
      if (!cancelled) void refreshIfEnabled()
    }
    window.addEventListener(AUTH_TOKEN_REFRESHED_EVENT_NAME, onTokenRefresh)

    return () => {
      cancelled = true
      window.removeEventListener(AUTH_TOKEN_REFRESHED_EVENT_NAME, onTokenRefresh)
      void tokenListener?.remove()
      void errorListener?.remove()
      void appStateListener?.remove()
    }
  }, [user?.id, accessToken])

  return null
}
