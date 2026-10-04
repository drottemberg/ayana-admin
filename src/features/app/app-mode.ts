export type AppMode = 'admin' | 'customer'

export function getAppMode(hostname = window.location.hostname): AppMode {
  const normalizedHostname = hostname.toLowerCase()

  if (normalizedHostname.startsWith('admin.')) return 'admin'
  return 'customer'
}

export function getAppModeLabel(mode: AppMode): string {
  switch (mode) {
    case 'admin':
      return 'Admin'
    case 'customer':
      return 'Customer'
  }
}
