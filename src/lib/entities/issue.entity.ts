import { CustomerEntity, StoreEntity, type OrganizationDto } from '@/lib/entities/organization.entity'
import { DeviceEntity, type DeviceDto } from '@/lib/entities/device.entity'
import { OrganizationType } from '@/types/organization'
import {
  IssueSeverity,
  IssueStatus,
  type Issue,
  type IssueResolutionGuide,
  type IssueSlaClass,
} from '@/types/issue'

export type IssueDto = {
  id?: string | null
  title?: string | null
  name?: string | null
  severity?: string | IssueSeverity | null
  status?: string | IssueStatus | null
  priority?: string | null
  device?: DeviceDto | null
  serialNumber?: string | null
  deviceType?: Issue['deviceType'] | null
  customer?: OrganizationDto | null
  store?: OrganizationDto | null
  slaClass?: string | IssueSlaClass | null
  resolutionGuide?: IssueResolutionGuide | null
  createdAt?: string | null
  updatedAt?: string | null
  resolvedAt?: string | null
}

function toIssueSeverity(value?: string | null): IssueSeverity {
  if (value === IssueSeverity.Warning) return IssueSeverity.Warning

  return IssueSeverity.Alert
}

function toIssueStatus(value?: string | null): IssueStatus {
  if (value === IssueStatus.Resolved) return IssueStatus.Resolved

  return IssueStatus.Open
}

export class IssueEntity {
  readonly dto: IssueDto
  readonly id: string
  readonly title: string
  readonly severity: IssueSeverity
  readonly status: IssueStatus
  readonly priority: string

  constructor(dto: IssueDto = {}) {
    this.dto = dto
    this.id = dto.id ?? ''
    this.title = dto.title ?? dto.name ?? ''
    this.severity = toIssueSeverity(dto.severity ?? dto.priority)
    this.status = toIssueStatus(dto.status)
    this.priority = dto.priority ?? ''
  }

  toJSON(): Issue {
    const device = this.dto.device ? new DeviceEntity(this.dto.device).toJSON() : undefined
    const customer = this.dto.customer
      ? new CustomerEntity(this.dto.customer).toCustomer()
      : device?.customer.id
        ? device.customer
        : undefined
    const store = this.dto.store
      ? new StoreEntity(this.dto.store).toStore()
      : device?.store.id
        ? device.store
        : undefined

    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: this.status,
      device,
      serialNumber: this.dto.serialNumber ?? device?.serialNumber,
      deviceType: this.dto.deviceType ?? device?.type,
      customer: customer ?? { id: '', name: '', type: OrganizationType.CUSTOMER },
      store: store ?? { id: '', name: '', type: OrganizationType.STORE },
      slaClass: this.dto.slaClass as IssueSlaClass | undefined,
      createdAt: this.dto.createdAt ?? undefined,
      resolvedAt: this.dto.resolvedAt ?? undefined,
      resolutionGuide: this.dto.resolutionGuide ?? undefined,
    }
  }
}
