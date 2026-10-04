import { OrganizationType } from '@/types/organization'
import type { OrganizationCounters } from '@/types/organization'
import type { Customer, Store } from '@/types/customer'

export type AddressDto = {
  id?: string | null
  name?: string | null
  street?: string | null
  suite?: string | null
  line1?: string | null
  city?: string | null
  zip?: string | null
  zipCode?: string | null
  state?: string | null
  stateId?: string | null
  country?: string | null
  countryId?: string | null
  access?: string | null
  isBusiness?: boolean | null
  isDefault?: boolean | null
  coordinates?: { latitude: number; longitude: number } | null
}

export type OrganizationShortDto = {
  id?: string | null
  name?: string | null
  type?: OrganizationType | null
  status?: string | null
  parentId?: string | null
  parent?: OrganizationShortDto | null
  isActive?: boolean | null
  isMaster?: boolean | null
  isCustomer?: boolean | null
  isStore?: boolean | null
  isRoot?: boolean | null
}

export type OrganizationDto = OrganizationShortDto & {
  phone?: string | null
  email?: string | null
  contactName?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  isSuper?: boolean | null
  createdBy?: string | null
  deletedBy?: string | null
  isDeleted?: boolean | null
  deletedAt?: string | null
  addressId?: string | null
  attachmentId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  address?: AddressDto | null
  timezone?: string
  cover?: unknown
  counters?: OrganizationCounters
  users?: number | null
  stores?: number | null
}

function formatAddress(address: AddressDto | null | undefined): string {
  if (!address) return ''

  return [
    address.line1 ?? address.street,
    address.suite,
    [address.zipCode ?? address.zip, address.city].filter(Boolean).join(' '),
    address.country ?? address.countryId,
  ]
    .filter(Boolean)
    .join(', ')
}

export class OrganizationEntity {
  readonly dto: OrganizationDto
  readonly id: string
  readonly name: string
  readonly type: OrganizationType | ''
  readonly status: string
  readonly parentId: string | null
  readonly parent?: OrganizationEntity
  readonly phone?: string
  readonly email?: string
  readonly address: AddressDto | null
  readonly timezone?: string
  readonly users: number
  readonly stores: number

  constructor(dto: OrganizationDto = {}) {
    this.dto = dto
    this.id = dto.id ?? ''
    this.name = dto.name ?? ''
    this.type = dto.type ?? ''
    this.status = dto.status ?? ''
    this.parentId = dto.parentId ?? null
    this.parent = dto.parent ? new OrganizationEntity(dto.parent) : undefined
    this.phone = dto.phone ?? undefined
    this.email = dto.email ?? undefined
    this.address = dto.address ?? null
    this.timezone = dto.timezone ?? undefined
    this.users = dto.users ?? 0
    this.stores = dto.stores ?? 0
  }

  get isActive(): boolean {
    return this.dto.isActive ?? this.status === 'ACTIVE'
  }

  get isMaster(): boolean {
    return this.dto.isMaster ?? this.type === OrganizationType.MASTER
  }

  get isCustomer(): boolean {
    return this.dto.isCustomer ?? this.type === OrganizationType.CUSTOMER
  }

  get isStore(): boolean {
    return this.dto.isStore ?? this.type === OrganizationType.STORE
  }

  get typeLabel(): string {
    if (this.isMaster) return 'Master'
    if (this.isCustomer) return 'Customer'
    if (this.isStore) return 'Store'
    return this.type || 'Organization'
  }

  get subtitle(): string {
    return [this.typeLabel, this.status].filter(Boolean).join(' - ')
  }

  get location(): string {
    return formatAddress(this.address)
  }

  toCustomer(): Customer {
    return {
      id: this.id,
      name: this.name,
      type: OrganizationType.CUSTOMER,
      status: this.status as any,
      isDeleted: this.dto.isDeleted ?? false,
      email: this.email,
      phone: this.phone,
      timezone: this.timezone,
      users: this.users,
      stores: this.stores,
    }
  }

  toStore(): Store {
    return {
      id: this.id,
      name: this.name,
      type: OrganizationType.STORE,
      orgStatus: this.status as any,
      isDeleted: this.dto.isDeleted ?? false,
      email: this.email,
      phone: this.phone,
      parentId: this.parentId ?? undefined,
      parent: this.parent?.toCustomer(),
      address: this.address
        ? {
            street: this.address.street ?? this.address.line1 ?? undefined,
            suite: this.address.suite ?? undefined,
            city: this.address.city ?? undefined,
            zip: this.address.zip ?? this.address.zipCode ?? undefined,
            stateId: this.address.stateId ?? undefined,
            countryId: this.address.countryId ?? undefined,
          }
        : undefined,
      timezone: this.timezone,
      counters: this.dto.counters,
    }
  }

  toJSON(): OrganizationDto | Customer | Store {
    return { ...this.dto }
  }
}

export class CustomerEntity extends OrganizationEntity {
  toJSON(): Customer {
    return this.toCustomer()
  }
}

export class StoreEntity extends OrganizationEntity {
  toJSON(): Store {
    return this.toStore()
  }
}
