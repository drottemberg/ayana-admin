import type { CustomerMembershipRecord, StaffRole } from '@/types/membership'

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

// Backend-computed user status based on deletion and activation state.
export const UserStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  DELETED: 'DELETED',
} as const

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus]

export const UserStatusValues = [UserStatus.ACTIVE, UserStatus.DISABLED, UserStatus.DELETED] as const

export type User = {
  id: number | string
  firstName: string
  lastName: string
  email: string
  emailVerifiedAt?: string | null
  invalidEmail?: boolean
  invalidAt?: string | null
  newsletterEnabled?: boolean
  pushNotificationsEnabled?: boolean
  emailNotificationsEnabled?: boolean
  phone?: string
  preferences?: Record<string, unknown> | null
  position?: string | null
  customerId?: string | null
  source?: string | null
  /** Virtual server-side list filters; not stored on the user record. */
  contractLocationId?: string
  purchaseLocationId?: string
  attendedSessions?: string
  remainingSessions?: string
  contractId?: string[]
  activitySummary?: {
    attendedCount: number
    lastAttendedAt: string | null
    remainingCredits: number
    unlimited: boolean
    contractNames: string[]
    contractPricingOptionIds: string[]
    latestContractName: string | null
    latestContractPricingOptionId?: string | null
    latestContractPrice: number | null
    latestContractCurrency: string | null
  } | null
  customer?: {
    id: string
    name: string
  }
  avatarUrl?: string
  status?: UserStatus
  isActive?: boolean
  isDeleted?: boolean
  isStaff?: boolean
  staffRole?: StaffRole | null
  customerMemberships?: CustomerMembershipRecord[]
  role: UserRole
  hasPassword?: boolean
  mustChangePassword?: boolean
  permissions?: UserOrganizationPermission[]
  memberOrganizations?: string[]
  createdAt: string
  updatedAt: string
}

export type CreateUserPayload = {
  firstName: string
  lastName: string
  email: string
  newsletterEnabled?: boolean
  pushNotificationsEnabled?: boolean
  emailNotificationsEnabled?: boolean
  password?: string
  phone?: string | null
  position?: string | null
  role: UserRole
  permissions?: UserOrganizationPermission[]
}

export type UpdateUserDetailsPayload = {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  emailVerified?: boolean
  invalidEmail?: boolean
  newsletterEnabled?: boolean
  pushNotificationsEnabled?: boolean
  emailNotificationsEnabled?: boolean
  isActive?: boolean
}

export type InviteUserPayload = {
  email: string
  position?: string | null
  role: UserRole
  permissions?: UserOrganizationPermission[]
}
