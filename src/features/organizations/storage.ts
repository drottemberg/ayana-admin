import { getLocalStorage, removeLocalStorage, setLocalStorage } from '@/utils/storage-utils'

const SELECTED_ORG_ID_KEY = 'selected_org_id'

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
