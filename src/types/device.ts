import { type Contract } from '@/types/contract'
import type { Customer, Store } from '@/types/customer'
import type { Issue } from '@/types/issue'
import type { Kpi } from './kpi'

export const DeviceStatus = {
  Online: 'online',
  Rebooting: 'rebooting',
  Disconnected: 'disconnected',
  NotConnected: 'not_connected',
} as const

export const DeviceStatusLabel = {
  [DeviceStatus.Online]: 'Online',
  [DeviceStatus.Rebooting]: 'Rebooting',
  [DeviceStatus.Disconnected]: 'Disconnected',
  [DeviceStatus.NotConnected]: 'Not connected',
} as const

export type DeviceStatus = (typeof DeviceStatus)[keyof typeof DeviceStatus]

export const DeviceEntityStatus = {
  Provisioning: 'PROVISIONING',
  Active: 'ACTIVE',
  Maintenance: 'MAINTENANCE',
  Disabled: 'DISABLED',
  Archived: 'ARCHIVED',
  Deleted: 'DELETED',
} as const

export const DeviceEntityStatusLabel = {
  [DeviceEntityStatus.Provisioning]: 'Provisioning',
  [DeviceEntityStatus.Active]: 'Active',
  [DeviceEntityStatus.Maintenance]: 'Maintenance',
  [DeviceEntityStatus.Disabled]: 'Disabled',
  [DeviceEntityStatus.Archived]: 'Archived',
  [DeviceEntityStatus.Deleted]: 'Deleted',
} as const

export type DeviceEntityStatus = (typeof DeviceEntityStatus)[keyof typeof DeviceEntityStatus]

export const DeviceCondition = {
  Available: 'AVAILABLE',
  Rented: 'RENTED',
  Sold: 'SOLD',
  ToClean: 'TO_CLEAN',
  ToRepair: 'TO_REPAIR',
  PartialLoss: 'PARTIAL_LOSS',
  TotalLoss: 'TOTAL_LOSS',
} as const

export const DeviceConditionLabel = {
  [DeviceCondition.Available]: 'Available',
  [DeviceCondition.Rented]: 'Rented',
  [DeviceCondition.Sold]: 'Sold',
  [DeviceCondition.ToClean]: 'To clean',
  [DeviceCondition.ToRepair]: 'To repair',
  [DeviceCondition.PartialLoss]: 'Partial loss',
  [DeviceCondition.TotalLoss]: 'Total loss',
} as const

export type DeviceCondition = (typeof DeviceCondition)[keyof typeof DeviceCondition]

export type DeviceTypeOption = {
  id: string
  name: string
  code?: string
  group?: { id: string; name: string } | null
}

export type DeviceType = string | DeviceTypeOption

export type DeviceConfigurationValue = string | number | boolean | null

export type DeviceConfiguration = Record<string, DeviceConfigurationValue | undefined>

export type Device = {
  id: string
  name: string
  serialNumber: string
  type: DeviceType
  typeGroupId?: string
  isSet?: boolean
  devicesCount?: number
  parentId?: string | null
  parentSet?: { id: string; name?: string | null; serialNumber?: string | null } | null
  deviceItems?: Device[]
  tags?: string[]
  status: DeviceStatus
  entityStatus: DeviceEntityStatus
  condition?: DeviceCondition
  customer: Customer
  store: Store
  contract: Contract
  activeProduct?: { id: string; name: string; status?: string } | null
  activeCampaign?: { id: string; name: string; status?: string } | null
  configuration?: DeviceConfiguration
  activeIssue?: Issue
  rawStatus?: Record<string, unknown> | null
  rawInfo?: Record<string, unknown> | null
  rawSetup?: Record<string, unknown> | null
  firmwareVersion?: string
  selectMode?: string
  deviceMode?: string
  dispensedDoses?: number
  lastDistance?: string
  connectedDevice?: string | null
  broker?: string
  lastSeen?: string
  maintenanceDocuments?: DeviceDocument[]
  activityFeed?: DeviceActivity[]
  data?: DeviceData
}

export type CreateDevicePayload = Omit<
  Device,
  'id' | 'customer' | 'store' | 'status' | 'entityStatus' | 'contract' | 'name' | 'serialNumber' | 'type' | 'tags'
> & {
  name?: string
  serialNumber?: string
  type?: DeviceType
  status?: 'PROVISIONING' | 'ACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED'
  tags?: string[]
}

export type DeviceDocument = {
  id: string
  name: string
  size: number
  url?: string | null
}

export type DeviceActivity = {
  id: string
  message: string
  createdAt: string
  type?: 'intervention' | 'comment'
}

export type DeviceDataPeriod = {
  totalTests: Kpi
  averageTestsPerDevice: Kpi
  averageTestsPerDay: Kpi
}

export type DeviceData = {
  weekData: DeviceDataPeriod
  monthData: DeviceDataPeriod
}
