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
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  OPERATOR: 'OPERATOR',
} as const
export type CustomerRole = (typeof CustomerRole)[keyof typeof CustomerRole]
export const CustomerRoleValues = [CustomerRole.ADMIN, CustomerRole.MEMBER, CustomerRole.OPERATOR] as const

export const StoreScope = {
  ALL: 'ALL',
  SPECIFIC: 'SPECIFIC',
  NONE: 'NONE',
} as const
export type StoreScope = (typeof StoreScope)[keyof typeof StoreScope]

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

export const TechnicianRole = {
  ADMIN: 'ADMIN',
  TECHNICIAN: 'TECHNICIAN',
} as const
export type TechnicianRole = (typeof TechnicianRole)[keyof typeof TechnicianRole]
export const TechnicianRoleValues = [TechnicianRole.ADMIN, TechnicianRole.TECHNICIAN] as const

export type OpsCustomerScopeInput = {
  customerId: string
  storeScope: StoreScope
  storeIds?: string[]
}

export type OpsMembershipInput = {
  partnerId: string
  role: TechnicianRole
  scopeType: StoreScope
  customerScopes?: OpsCustomerScopeInput[]
}

export type InviteOpsPayload = {
  email: string
  memberships: OpsMembershipInput[]
}

// Raw membership shape as it lives on the user entity (UserEntity.customerMemberships /
// .technicianMemberships on the backend) — used to prefill the edit-permissions tree with a
// user's EXISTING memberships. NOT YET AVAILABLE ON BACKEND: GET /users/:id currently returns
// only UserEntity.toJson(), which excludes both maps entirely (confirmed against
// gkManager-backend/src/users/user.entity.ts — toJson() has no customerMemberships/
// technicianMemberships field, and UsersRepository.findWithPermissions(), which backs the
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
}

export type OpsMembershipRecord = {
  partnerId: string
  partnerName?: string
  role: TechnicianRole
  scopeType: StoreScope
  customerScopes?: Array<{ customerId: string; customerName?: string; storeScope: StoreScope; storeIds?: string[] }>
}
