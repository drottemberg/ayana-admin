import type { Customer, Store } from '@/types/customer'
import type { Device, DeviceType } from '@/types/device'

export const IssueSeverity = {
  Alert: 'alert',
  Warning: 'warning',
} as const

export const IssueSeverityLabel = {
  [IssueSeverity.Alert]: 'Alert',
  [IssueSeverity.Warning]: 'Warning',
} as const

export const IssueStatus = {
  Open: 'open',
  Resolved: 'resolved',
} as const

export const IssueStatusLabel = {
  [IssueStatus.Open]: 'Open',
  [IssueStatus.Resolved]: 'Resolved',
} as const

export const IssueSlaClass = {
  ClassA: 'class_a',
  ClassAA: 'class_aa',
  ClassAAA: 'class_aaa',
} as const

export const IssueSlaClassLabel = {
  [IssueSlaClass.ClassA]: 'Class A',
  [IssueSlaClass.ClassAA]: 'Class AA',
  [IssueSlaClass.ClassAAA]: 'Class AAA',
} as const

export type IssueSeverity = (typeof IssueSeverity)[keyof typeof IssueSeverity]
export type IssueStatus = (typeof IssueStatus)[keyof typeof IssueStatus]
export type IssueSlaClass = (typeof IssueSlaClass)[keyof typeof IssueSlaClass]

export type IssueResolutionStep = {
  id: string
  description: string
  imageUrl?: string
}

export type IssueResolutionGuide = {
  id: string
  title: string
  steps: IssueResolutionStep[]
}

export type Issue = {
  id: string
  title: string
  severity: IssueSeverity
  status: IssueStatus
  device?: Device
  serialNumber?: string
  deviceType?: DeviceType
  customer?: Customer
  store?: Store
  slaClass?: IssueSlaClass
  createdAt?: string
  resolvedAt?: string
  resolutionGuide?: IssueResolutionGuide
}
