import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'

export function CapgoReady() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    void CapacitorUpdater.notifyAppReady().catch((error: unknown) => {
      console.error('[Capgo] Failed to confirm app startup:', error)
    })
  }, [])

  return null
}
