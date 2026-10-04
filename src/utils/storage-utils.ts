type CookieOptions = {
  days?: number
  path?: string
  sameSite?: 'strict' | 'lax' | 'none'
  secure?: boolean
}

function isJson(value: string): boolean {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

export function setLocalStorage<TValue>(name: string, value: TValue | null | undefined): void {
  if (!name) return

  try {
    if (value == null) {
      window.localStorage.removeItem(name)
      return
    }

    const storageValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
    window.localStorage.setItem(name, storageValue)
  } catch {
    // Storage can be unavailable in private mode or restricted browser contexts.
  }
}

export function getLocalStorage<TValue = unknown>(name: string): TValue | null {
  if (!name) return null

  try {
    const value = window.localStorage.getItem(name)
    if (!value) return null

    return (isJson(value) ? JSON.parse(value) : value) as TValue
  } catch {
    return null
  }
}

export function removeLocalStorage(name: string): void {
  setLocalStorage(name, null)
}

export function setCookie(name: string, value: string | null | undefined, options: CookieOptions = {}): void {
  if (!name) return

  const { days = 365, path = '/', sameSite = 'lax', secure = false } = options

  if (value == null) {
    deleteCookie(name, { path, sameSite, secure })
    return
  }

  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)

  document.cookie = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `expires=${expires.toUTCString()}`,
    `path=${path}`,
    `samesite=${sameSite}`,
    secure ? 'secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

export function getCookie(name: string): string | null {
  if (!name) return null

  const encodedName = `${encodeURIComponent(name)}=`
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName))

  return cookie ? decodeURIComponent(cookie.slice(encodedName.length)) : null
}

export function deleteCookie(name: string, options: Pick<CookieOptions, 'path' | 'sameSite' | 'secure'> = {}): void {
  if (!name) return

  const { path = '/', sameSite = 'lax', secure = false } = options

  document.cookie = [
    `${encodeURIComponent(name)}=`,
    'expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'max-age=0',
    `path=${path}`,
    `samesite=${sameSite}`,
    secure ? 'secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}
