export const Portal = {
  ADMIN: 'ADMIN',
  CUSTOMER: 'CUSTOMER',
} as const

export type Portal = (typeof Portal)[keyof typeof Portal]

export function getPortal(hostname: string = window.location.hostname): Portal {
  const subdomain = hostname.split('.')[0]

  if (subdomain === 'admin') return Portal.ADMIN
  if (subdomain === 'customer') return Portal.CUSTOMER

  throw new Error(`Unknown portal for hostname: ${hostname}`)
}

/** Like getPortal(), but returns null instead of throwing on an unrecognized hostname (e.g. local dev on plain `localhost`). */
export function getPortalSafe(hostname?: string): Portal | null {
  try {
    return getPortal(hostname)
  } catch {
    return null
  }
}
