import type { Customer, Store } from '@/types/customer'
import type { Device } from '@/types/device'

export const ContractType = {
  Rental: 'RENTAL',
  Purchase: 'PURCHASE',
} as const

export const ContractTypeLabel = {
  [ContractType.Rental]: 'Rental',
  [ContractType.Purchase]: 'Purchase',
} as const

export type ContractType = (typeof ContractType)[keyof typeof ContractType]

export const ContractStatus = {
  Created: 'created',
  Active: 'active',
  Suspended: 'suspended',
  Completed: 'completed',
  Cancelled: 'cancelled',
  Archived: 'archived',
  Deleted: 'deleted',
} as const

export const ContractStatusLabel = {
  [ContractStatus.Created]: 'Created',
  [ContractStatus.Active]: 'Active',
  [ContractStatus.Suspended]: 'Suspended',
  [ContractStatus.Completed]: 'Completed',
  [ContractStatus.Cancelled]: 'Cancelled',
  [ContractStatus.Archived]: 'Archived',
  [ContractStatus.Deleted]: 'Deleted',
} as const

export const ContractStatusValues = [
  ContractStatus.Active,
  ContractStatus.Suspended,
  ContractStatus.Completed,
  ContractStatus.Cancelled,
  ContractStatus.Archived,
  ContractStatus.Deleted,
] as const

export const ContractSlaType = {
  None: 'none',
  ClassA: 'class_a',
  ClassAA: 'class_aa',
  ClassAAA: 'class_aaa',
} as const

export const ContractSlaTypeLabel = {
  [ContractSlaType.None]: 'No SLA',
  [ContractSlaType.ClassA]: 'Class A',
  [ContractSlaType.ClassAA]: 'Class AA',
  [ContractSlaType.ClassAAA]: 'Class AAA',
} as const

export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus]
export type ContractSlaType = (typeof ContractSlaType)[keyof typeof ContractSlaType]

export type ContractDevice = Pick<Device, 'id' | 'name' | 'serialNumber'>

export type ContractDocument = {
  id: string
  name: string
  size: number
  url?: string | null
}

export type ContractDeviceAssignment = {
  id: string
  contractId: string
  deviceId: string
  assignedAt?: string | null
  unassignedAt?: string | null
  assignedBy?: string | null
  unassignedBy?: string | null
  deliveryDate?: string | null
  pickupDate?: string | null
}

export type ContractDeviceHistoryPeriod = {
  id: string
  contractId: string
  deviceId: string
  assignedAt: string
  unassignedAt?: string | null
}

export type ContractDeviceHistory = {
  id: string
  contractId: string
  deviceId: string
  contract: Contract
  status: 'ACTIVE' | 'INACTIVE'
  assignedAt: string
  unassignedAt?: string | null
  history: ContractDeviceHistoryPeriod[]
}

export type Contract = {
  id: string
  name: string
  type: ContractType
  status: ContractStatus
  slaType: ContractSlaType
  slaHours?: number | null
  notes?: string | null
  customer: Customer
  stores: Store[]
  devices: ContractDevice[]
  startDate: string
  endDate: string
  documents?: ContractDocument[]
  isArchived?: boolean
  isDeleted?: boolean
  createdAt?: string
  updatedAt?: string
}

export type CreateContractPayload = Omit<Contract, 'id' | 'documents'> & {
  documents?: ContractDocument[]
  documentFiles?: File[]
  reassignConflictingDevices?: boolean
}
