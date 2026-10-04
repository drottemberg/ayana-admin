export type AppMode = 'admin' | 'ops' | 'customer'

export function getAppMode(hostname = window.location.hostname): AppMode {
  const normalizedHostname = hostname.toLowerCase()

  if (normalizedHostname.startsWith('admin.')) return 'admin'
  if (normalizedHostname.startsWith('ops.')) return 'ops'

  return 'customer'
}

export function getAppModeLabel(mode: AppMode): string {
  switch (mode) {
    case 'admin':
      return 'Admin'
    case 'ops':
      return 'Ops'
    case 'customer':
      return 'Customer'
  }
}
