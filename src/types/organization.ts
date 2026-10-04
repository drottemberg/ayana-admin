import type { Address } from './address'

// Backend-computed (OrganizationEntity.getStatus(), mirroring UserEntity.getStatus() — not the
// raw stored status column, which is still just PENDING/ACTIVE/DELETED) — folds isArchived/
// isDeleted into one value instead of the frontend combining three flags itself.
export const OrganizationStatus = {
  PENDING: 'PENDING',
  ACTIVE:  'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
} as const
export type OrganizationStatus = (typeof OrganizationStatus)[keyof typeof OrganizationStatus]
export const OrganizationStatusValues = [
  OrganizationStatus.ACTIVE,
  OrganizationStatus.PENDING,
  OrganizationStatus.ARCHIVED,
  OrganizationStatus.DELETED,
] as const

export const OrganizationType = {
  MASTER: 'MASTER',
  STORE: 'STORE',
  CUSTOMER: 'CUSTOMER',
  MAINTENANCE: 'MAINTENANCE',
}

export type OrganizationType = (typeof OrganizationType)[keyof typeof OrganizationType]

export type OrganizationCounters = {
  devices?: number
  media?: number
  users?: number
}

export type Organization = {
  id: string
  name: string
  number?: string
  type: OrganizationType
  status?: OrganizationStatus
  isDeleted?: boolean
  isArchived?: boolean
  parentId?: string
  parent?: Organization
  address?: Address
  timezone?: string
  phone?: string
  email?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  counters?: OrganizationCounters
  users?: number
  stores?: number
  createdAt?: string
}
