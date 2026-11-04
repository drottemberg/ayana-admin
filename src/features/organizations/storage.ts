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

export function clearOrganizationLocationContext(): void {
  clearSelectedOrgId()

  try {
    const keys = Object.keys(window.localStorage)
    for (const key of keys) {
      if (
        key.startsWith(SELECTED_LOCATION_SCOPE_PREFIX)
        || key.startsWith('ayana:kitchen:location:')
      ) {
        window.localStorage.removeItem(key)
        continue
      }

      if (key.startsWith('data_table_settings:')) {
        const value = getLocalStorage<Record<string, unknown>>(key)
        const filters = value?.f
        if (filters && typeof filters === 'object' && !Array.isArray(filters)) {
          for (const filterKey of Object.keys(filters)) {
            if (/customer|organization|location/i.test(filterKey)) delete (filters as Record<string, unknown>)[filterKey]
          }
          setLocalStorage(key, value)
        }
      }
    }
    window.localStorage.removeItem('ayana:kitchen:customer')

    const reportFilters = getLocalStorage<Record<string, unknown>>('sales-report.filters')
    if (reportFilters) {
      delete reportFilters.customerId
      delete reportFilters.customerName
      delete reportFilters.locationId
      delete reportFilters.locationName
      setLocalStorage('sales-report.filters', reportFilters)
    }
  } catch {
    // Keep logout working when browser storage is unavailable.
  }
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
