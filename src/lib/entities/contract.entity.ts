import {
  ContractSlaType,
  ContractSlaTypeLabel,
  ContractStatus,
  ContractStatusLabel,
  ContractType,
  type Contract,
} from '@/types/contract'
import { CustomerEntity, type OrganizationDto } from '@/lib/entities/organization.entity'
import { OrganizationType } from '@/types/organization'

export type ContractDto = {
  id?: string | null
  organizationId?: string | null
  name?: string | null
  type?: string | null
  status?: string | ContractStatus | null
  startDate?: string | null
  endDate?: string | null
  customer?: OrganizationDto | null
  stores?: Contract['stores']
  devices?: Contract['devices']
  documents?: Contract['documents']
}

function toContractStatus(status?: string | null): ContractStatus {
  if (status === 'ENDED' || status === ContractStatus.Completed) return ContractStatus.Completed
  if (status === 'ACTIVE' || status === ContractStatus.Active) return ContractStatus.Active
  return ContractStatus.Created
}

function toContractType(type?: string | null): ContractType {
  if (type === ContractType.Purchase) return ContractType.Purchase
  return ContractType.Rental
}

export class ContractEntity {
  readonly dto: ContractDto
  readonly id: string
  readonly name: string
  readonly type: ContractType
  readonly status: ContractStatus
  readonly slaType: ContractSlaType
  readonly startDate: string
  readonly endDate: string

  constructor(dto: ContractDto = {}) {
    this.dto = dto
    this.id = dto.id ?? ''
    this.name = dto.name ?? ''
    this.type = toContractType(dto.type)
    this.status = toContractStatus(dto.status)
    this.slaType = ContractSlaType.None
    this.startDate = dto.startDate ?? ''
    this.endDate = dto.endDate ?? ''
  }

  get statusLabel(): string {
    return ContractStatusLabel[this.status]
  }

  get slaTypeLabel(): string {
    return ContractSlaTypeLabel[this.slaType]
  }

  get isActive(): boolean {
    return this.status === ContractStatus.Active
  }

  toJSON(): Contract {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      slaType: this.slaType,
      customer: this.dto.customer
        ? new CustomerEntity(this.dto.customer).toCustomer()
        : { id: this.dto.organizationId ?? '', name: '', type: OrganizationType.CUSTOMER },
      stores: this.dto.stores ?? [],
      devices: this.dto.devices ?? [],
      startDate: this.startDate,
      endDate: this.endDate,
      documents: this.dto.documents ?? [],
    }
  }
}
