import { getLocalStorage, removeLocalStorage, setLocalStorage } from '@/utils/storage-utils'

const SELECTED_ORG_ID_KEY = 'selected_org_id'
const SELECTED_LOCATION_SCOPE_PREFIX = 'selected_location_scope:'

export const ALL_LOCATIONS_SCOPE = 'ALL'

export function readSelectedOrgId(): string | null {
  return getLocalStorage<string>(SELECTED_ORG_ID_KEY)
}

export function saveSelectedOrgId(orgId: string | null | undefined): void {
  if (!orgId) {
    clearSelectedOrgId()
    return
  }

  setLocalStorage(SELECTED_ORG_ID_KEY, orgId)
}

export function clearSelectedOrgId(): void {
  removeLocalStorage(SELECTED_ORG_ID_KEY)
}

export function readSelectedLocationScope(customerId: string): string | null {
  if (!customerId) return null
  return getLocalStorage<string>(`${SELECTED_LOCATION_SCOPE_PREFIX}${customerId}`)
}

export function saveSelectedLocationScope(customerId: string, scope: string): void {
  if (!customerId || !scope) return
  setLocalStorage(`${SELECTED_LOCATION_SCOPE_PREFIX}${customerId}`, scope)
}

export function clearSelectedLocationScope(customerId: string): void {
  if (!customerId) return
  removeLocalStorage(`${SELECTED_LOCATION_SCOPE_PREFIX}${customerId}`)
}
