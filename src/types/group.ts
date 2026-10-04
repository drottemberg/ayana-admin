export type DeviceGroup = {
  id: string
  name: string
  ownerId?: string | null
  isPrivate?: boolean
  createdAt?: string | null
  updatedAt?: string | null
  deviceCount?: number
}

export type StoreGroup = {
  id: string
  name: string
  ownerId?: string | null
  isPrivate?: boolean
  createdAt?: string | null
  updatedAt?: string | null
  storeCount?: number
}

export type GroupPayload = {
  name: string
}
