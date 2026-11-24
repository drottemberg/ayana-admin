import type { CapacitorConfig } from '@capacitor/cli'

const appId = 'club.ayana.admin'

const config: CapacitorConfig = {
  appId,
  appName: 'AYANA Admin',
  webDir: 'dist',
  plugins: {
    CapacitorUpdater: {
      appId,
      autoUpdate: 'atBackground',
      version: '1.0',
      defaultChannel: 'production',
      updateUrl: 'https://plugin.eu.capgo.app/updates',
      statsUrl: 'https://plugin.eu.capgo.app/stats',
      channelUrl: 'https://plugin.eu.capgo.app/channel_self',
    },
  },
}

export default config
