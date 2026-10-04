import type { CustomerMembershipRecord, OpsMembershipRecord, StaffRole } from '@/types/membership'

export const UserRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
  MEMBER: 'MEMBER',
  DISABLED: 'DISABLED',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const UserRoleValues = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MODERATOR,
  UserRole.MEMBER,
  UserRole.DISABLED,
] as const

export type UserOrganizationPermission = {
  organizationId: string
  role: UserRole | null
  parentId?: string
}

// Backend-computed (UserEntity.getStatus(), not a stored column) from isDeleted/isArchived/
// isActive — deleted wins over archived, which wins over active/disabled. Matches the exact
// values gkManager-backend's own UserStatus enum uses, including for filters.status server-side.
export const UserStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
} as const

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus]

export const UserStatusValues = [UserStatus.ACTIVE, UserStatus.DISABLED, UserStatus.ARCHIVED, UserStatus.DELETED] as const

export type User = {
  id: number | string
  firstName: string
  lastName: string
  email: string
  phone?: string
  position?: string | null
  customerId?: string | null
  customer?: {
    id: string
    name: string
  }
  avatarUrl?: string
  status?: UserStatus
  isActive?: boolean
  isArchived?: boolean
  isDeleted?: boolean
  isStaff?: boolean
  staffRole?: StaffRole | null
  customerMemberships?: CustomerMembershipRecord[]
  technicianMemberships?: OpsMembershipRecord[]
  role: UserRole
  hasPassword?: boolean
  permissions?: UserOrganizationPermission[]
  memberOrganizations?: string[]
  createdAt: string
  updatedAt: string
}

export type CreateUserPayload = {
  firstName: string
  lastName: string
  email: string
  password?: string
  phone?: string | null
  position?: string | null
  role: UserRole
  permissions?: UserOrganizationPermission[]
}

export type UpdateUserDetailsPayload = {
  firstName: string
  lastName: string
  phone?: string | null
  isActive?: boolean
}

export type InviteUserPayload = {
  email: string
  position?: string | null
  role: UserRole
  permissions?: UserOrganizationPermission[]
}
