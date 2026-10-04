import { UserRole, type User, type UserOrganizationPermission, type UserRole as UserRoleType } from '@/types/user'

export type UserDto = {
  id?: string | number | null
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  customerId?: string | null
  role?: UserRoleType | null
  permissions?: UserOrganizationPermission[] | null
  isActive?: boolean | null
  hasPassword?: boolean | null
  mfaEnabled?: boolean | null
  lastLoginAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export class UserEntity {
  readonly dto: UserDto
  readonly id: string | number
  readonly firstName: string
  readonly lastName: string
  readonly name: string
  readonly email: string
  readonly phone?: string
  readonly customerId?: string
  readonly role: UserRoleType
  readonly permissions: UserOrganizationPermission[]
  readonly isActive: boolean
  readonly hasPassword: boolean
  readonly mfaEnabled: boolean
  readonly lastLoginAt?: string
  readonly createdAt: string
  readonly updatedAt: string

  constructor(dto: UserDto = {}) {
    this.dto = dto
    this.id = dto.id ?? ''
    this.firstName = dto.firstName ?? ''
    this.lastName = dto.lastName ?? ''
    this.name = dto.name ?? [this.firstName, this.lastName].filter(Boolean).join(' ')
    this.email = dto.email ?? ''
    this.phone = dto.phone ?? undefined
    this.customerId = dto.customerId ?? undefined
    this.role = dto.role ?? UserRole.MEMBER
    this.permissions = dto.permissions ?? []
    this.isActive = dto.isActive ?? false
    this.hasPassword = dto.hasPassword ?? false
    this.mfaEnabled = dto.mfaEnabled ?? false
    this.lastLoginAt = dto.lastLoginAt ?? undefined
    this.createdAt = dto.createdAt ?? ''
    this.updatedAt = dto.updatedAt ?? ''
  }

  get fullName(): string {
    return this.name || [this.firstName, this.lastName].filter(Boolean).join(' ')
  }

  toJSON(): User {
    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phone: this.phone,
      customerId: this.customerId,
      role: this.role,
      hasPassword: this.hasPassword,
      permissions: this.permissions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
