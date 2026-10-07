export const StaffRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  SUPPORT: 'SUPPORT',
} as const
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole]
export const StaffRoleValues = [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.SUPPORT] as const

export type InviteStaffPayload = {
  email: string
  firstName: string
  lastName: string
  staffRole: StaffRole
}

export const CustomerRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  FRONT_DESK: 'FRONT_DESK',
  INSTRUCTOR: 'INSTRUCTOR',
  MEMBER: 'MEMBER',
} as const
export type CustomerRole = (typeof CustomerRole)[keyof typeof CustomerRole]
export const CustomerRoleValues = [CustomerRole.OWNER, CustomerRole.ADMIN, CustomerRole.MANAGER, CustomerRole.FRONT_DESK, CustomerRole.INSTRUCTOR, CustomerRole.MEMBER] as const

export const StoreScope = {
  ALL: 'ALL',
  SPECIFIC: 'SPECIFIC',
  NONE: 'NONE',
} as const
export type StoreScope = (typeof StoreScope)[keyof typeof StoreScope]
export const LocationScope = StoreScope
export type LocationScope = StoreScope

export type CustomerStoreMembershipInput = {
  storeId: string
  role?: CustomerRole
}

export type CustomerMembershipInput = {
  customerId: string
  role: CustomerRole
  position?: string
  storeScope: StoreScope
  stores?: CustomerStoreMembershipInput[]
}

export type InviteCustomerPayload = {
  email: string
  memberships: CustomerMembershipInput[]
}

// Raw membership shape as it lives on the user entity — used to prefill the edit-permissions tree with a
// user's EXISTING memberships. NOT YET AVAILABLE ON BACKEND: GET /users/:id currently returns
// only UserEntity.toJson(), which excludes this map entirely (confirmed against
// gkManager-backend/src/users/user.entity.ts — toJson() has no customerMemberships field, and UsersRepository.findWithPermissions(), which backs the
// endpoint the frontend actually calls, never populates those maps either). There IS an unused
// UsersRepository.findById() that already builds the right shape — it just isn't wired to any
// controller route yet. Until it is, these fields are always absent and every edit-permissions
// tab opens with nothing pre-checked.
export type CustomerMembershipRecord = {
  customerId: string
  customerName?: string
  role: CustomerRole
  storeScope: StoreScope
  stores?: Array<{ storeId: string; storeName?: string; role?: CustomerRole }>
  locationScope?: LocationScope
  locations?: Array<{ locationId: string; locationName?: string; role?: CustomerRole }>
}
