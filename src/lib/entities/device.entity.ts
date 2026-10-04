import { ContractEntity, type ContractDto } from '@/lib/entities/contract.entity'
import { CustomerEntity, StoreEntity, type OrganizationDto } from '@/lib/entities/organization.entity'

import {
  DeviceEntityStatus,
  DeviceStatus,
  DeviceStatusLabel,
  type Device,
  type DeviceConfiguration,
  type DeviceTypeOption,
} from '@/types/device'
import { ContractSlaType, ContractStatus, ContractType } from '@/types/contract'
import { OrganizationType } from '@/types/organization'
import { getDeviceTypeLabel } from '@/features/device-types/utils'

export type DeviceDto = {
  id?: string | null
  serialNumber?: string | null
  name?: string | null
  note?: string | null
  type?: string | DeviceTypeOption | null
  status?: string | DeviceStatus | null
  isArchived?: boolean
  isDeleted?: boolean
  isSet?: boolean
  devicesCount?: number
  parentId?: string | null
  storeId?: string | null
  isOnline?: boolean
  lastSeen?: string | null
  customer?: OrganizationDto | null
  store?: OrganizationDto | null
  contract?: ContractDto | null
  tags?: string[]
  deviceItems?: DeviceDto[]
  configuration?: DeviceConfiguration
  activeIssue?: Device['activeIssue']
  maintenanceDocuments?: Device['maintenanceDocuments']
  activityFeed?: Device['activityFeed']
  data?: Device['data']
}

function toDeviceStatus(dto: DeviceDto): DeviceStatus {
  if (dto.isOnline && !isLastSeenStale(dto.lastSeen)) return DeviceStatus.Online
  if (dto.status === 'ACTIVE' || dto.status === DeviceStatus.Disconnected) return DeviceStatus.Disconnected
  if (dto.status === DeviceStatus.Online) return DeviceStatus.Online
  return DeviceStatus.NotConnected
}

function isLastSeenStale(lastSeen?: string | null): boolean {
  if (!lastSeen) return true
  const timestamp = new Date(lastSeen).getTime()
  if (Number.isNaN(timestamp)) return true
  return Date.now() - timestamp > 10 * 60 * 1000
}

function toDeviceEntityStatus(dto: DeviceDto): Device['entityStatus'] {
  if (dto.isDeleted) return DeviceEntityStatus.Deleted
  if (dto.isArchived) return DeviceEntityStatus.Archived
  if (dto.status === 'ACTIVE') return DeviceEntityStatus.Active
  if (dto.status === 'MAINTENANCE') return DeviceEntityStatus.Maintenance
  if (dto.status === 'PROVISIONING') return DeviceEntityStatus.Provisioning
  return DeviceEntityStatus.Disabled
}

function toDeviceTypeOption(type: DeviceDto['type']): DeviceTypeOption {
  if (typeof type === 'object' && type !== null) return type

  const id = type ?? ''
  return {
    id,
    name: getDeviceTypeLabel(id),
  }
}

function toDeviceConfiguration(dto: DeviceDto): DeviceConfiguration | undefined {
  const configuration: DeviceConfiguration = { ...(dto.configuration ?? {}) }

  return Object.keys(configuration).length ? configuration : undefined
}

export class DeviceEntity {
  readonly dto: DeviceDto
  readonly id: string
  readonly name: string
  readonly serialNumber: string
  readonly type: DeviceTypeOption
  readonly status: DeviceStatus
  readonly storeId: string

  constructor(dto: DeviceDto = {}) {
    this.dto = dto
    this.id = dto.id ?? ''
    this.name = dto.name ?? ''
    this.serialNumber = dto.serialNumber ?? ''
    this.type = toDeviceTypeOption(dto.type)
    this.status = toDeviceStatus(dto)
    this.storeId = dto.storeId ?? dto.store?.id ?? ''
  }

  get statusLabel(): string {
    return DeviceStatusLabel[this.status]
  }

  get store(): StoreEntity | null {
    return this.dto.store ? new StoreEntity(this.dto.store) : null
  }

  get customer(): CustomerEntity | null {
    return this.dto.customer ? new CustomerEntity(this.dto.customer) : null
  }

  get contract(): ContractEntity | null {
    return this.dto.contract ? new ContractEntity(this.dto.contract) : null
  }

  toJSON(): Device {
    return {
      id: this.id,
      name: this.name,
      serialNumber: this.serialNumber,
      type: this.type,
      isSet: this.dto.isSet,
      devicesCount: this.dto.devicesCount,
      deviceItems: this.dto.deviceItems?.map((device) => new DeviceEntity(device).toJSON()),
      status: this.status,
      entityStatus: toDeviceEntityStatus(this.dto),
      tags: this.dto.tags,
      customer: this.customer?.toCustomer() ?? { id: '', name: '', type: OrganizationType.CUSTOMER },
      store: this.store?.toStore() ?? {
        id: this.storeId,
        name: '',
        type: OrganizationType.STORE,
      },
      contract: this.contract?.toJSON() ?? {
        id: '',
        name: '',
        type: ContractType.Rental,
        status: ContractStatus.Active,
        slaType: ContractSlaType.None,
        customer: { id: '', name: '', type: OrganizationType.CUSTOMER },
        stores: [],
        devices: [],
        startDate: '',
        endDate: '',
      },
      configuration: toDeviceConfiguration(this.dto),
      activeIssue: this.dto.activeIssue,
      lastSeen: this.dto.lastSeen ?? undefined,
      maintenanceDocuments: this.dto.maintenanceDocuments,
      activityFeed: this.dto.activityFeed,
      data: this.dto.data,
    }
  }
}
