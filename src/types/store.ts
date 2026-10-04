import { OrganizationType, type Organization } from '@/types/organization'

export const StoreStatus = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
} as const

export type StoreStatus = (typeof StoreStatus)[keyof typeof StoreStatus]

export type Store = Omit<Organization, 'type'> & {
  type: typeof OrganizationType.STORE
  retailer?: string
  status?: StoreStatus
  productLevel?: string
  lastSeen?: string
  /** Organization-level status (ACTIVE/PENDING/DELETED) — distinct from live StoreStatus */
  orgStatus?: import('@/types/organization').OrganizationStatus
  customer?: { id: string; name: string } | null
}

export type StoreDeviceHistoryPeriod = {
  id: string
  storeId: string
  deviceId: string
  assignedAt: string
  unassignedAt?: string | null
}

export type StoreDeviceHistory = {
  id: string
  storeId: string
  deviceId: string
  store: Store
  status: 'ACTIVE' | 'INACTIVE'
  assignedAt: string
  unassignedAt?: string | null
  history: StoreDeviceHistoryPeriod[]
}

export type CreateStorePayload = Omit<Store, 'id' | 'parent' | 'parentId' | 'status' | 'customer'> & {
  customerId: string
}
