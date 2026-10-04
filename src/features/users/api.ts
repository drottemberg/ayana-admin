import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { SortOrder, toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import {
  UserRole,
  type CreateUserPayload,
  type InviteUserPayload,
  type UpdateUserDetailsPayload,
  type User,
  type UserStatus,
} from '@/types/user'
import type {
  CustomerMembershipInput,
  CustomerMembershipRecord,
  OpsMembershipInput,
  OpsMembershipRecord,
  StaffRole,
} from '@/types/membership'
import { apiClient } from '@/lib/api-client'
import type { Customer } from '@/types/customer'

type MemberPermissionRecord = {
  organizationId?: string
  role?: string | null
  position?: string | null
}

type MemberRecord = {
  organizationId?: string
  orgName?: string | null
  position?: string | null
  role?: string | null
  permissions?: Record<string, MemberPermissionRecord>
}

type UserRecord = {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone?: string | null
  role?: User['role'] | null
  position?: string | null
  permissions?: User['permissions'] | null
  customerId?: string | null
  customer?: Customer | null
  status?: UserStatus
  isActive?: boolean
  isArchived?: boolean
  isDeleted?: boolean
  isStaff?: boolean
  staffRole?: StaffRole | null
  customerMemberships?: CustomerMembershipRecord[] | null
  technicianMemberships?: OpsMembershipRecord[] | null
  createdAt?: string | null
  updatedAt?: string | null
  members?: Record<string, MemberRecord>
}

const USERS_LIST_URL = '/users/list'

function toUser(user: UserRecord): User {
  const memberList = Object.values(user.members ?? {})
  const firstMember = memberList[0]

  const permissions: User['permissions'] = []
  for (const member of memberList) {
    for (const [orgId, perm] of Object.entries(member.permissions ?? {})) {
      permissions.push({
        organizationId: perm.organizationId ?? orgId,
        role: (perm.role as UserRole | null) ?? null,
        parentId: member.organizationId ?? undefined,
      })
    }
  }

  const memberOrganizations = memberList.map((m) => m.orgName).filter(Boolean) as string[]

  return {
    id: user.id,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    email: user.email ?? '',
    phone: user.phone ?? undefined,
    position: firstMember?.position ?? user.position ?? undefined,
    customerId: user.customerId ?? undefined,
    customer: user.customer ?? undefined,
    status: user.status ?? undefined,
    isActive: user.isActive ?? undefined,
    isArchived: user.isArchived ?? undefined,
    isDeleted: user.isDeleted ?? undefined,
    isStaff: user.isStaff ?? undefined,
    staffRole: user.staffRole ?? undefined,
    customerMemberships: user.customerMemberships ?? undefined,
    technicianMemberships: user.technicianMemberships ?? undefined,
    role: ((firstMember?.role ?? user.role) as UserRole | null) ?? UserRole.MEMBER,
    permissions: permissions.length > 0 ? permissions : Array.isArray(user.permissions) ? user.permissions : [],
    memberOrganizations: memberOrganizations.length > 0 ? memberOrganizations : undefined,
    createdAt: user.createdAt ?? '',
    updatedAt: user.updatedAt ?? '',
  }
}

export function toUsersTableResult(result: ApiListResult<UserRecord>): DataTableAsyncResult<User> {
  return toDataTableResult({
    ...result,
    items: result.items.map(toUser),
  })
}

export function toUsersListPayload(tableState: DataTableState<User>, hiddenFilters?: Record<string, unknown>) {
  const f = tableState.filters as Record<string, string[] | undefined>
  const filters = {
    organizationId: f.customerId,
    ...hiddenFilters,
  }

  return toApiListDto(
    {
      ...tableState,
      filters: Object.fromEntries(Object.entries(tableState.filters).filter(([key]) => key !== 'customerId')),
    },
    filters,
  )
}

export const usersListConfig = {
  url: USERS_LIST_URL,
  toPayload: toUsersListPayload,
  toResult: (result: ApiListResult<unknown>) => toUsersTableResult(result as ApiListResult<UserRecord>),
}

export async function getUsersListRequest(): Promise<User[]> {
  const result = await apiClient.post<ApiListResult<UserRecord>>(USERS_LIST_URL, {
    limit: 100,
    orderBy: 'createdAt',
    order: SortOrder.desc,
  })

  return result.items.map(toUser)
}

export async function getUsersRequest(
  tableState: DataTableState<User>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<User>> {
  // The filter UI is checkbox-based (multi-select — check Active AND Archived, see both), so
  // filters.status is sent as an array. NOT YET SUPPORTED ON BACKEND: UsersRepository's
  // buildStatusCondition(status: string) does a plain switch/case on a single string — an array
  // doesn't match any case and silently falls through to the default (hide-deleted) branch.
  // Flagged for the backend team: needs to accept string | string[] and OR the per-status
  // conditions together when it's an array.
  const result = await apiClient.post<ApiListResult<UserRecord>>(
    usersListConfig.url,
    usersListConfig.toPayload(tableState, hiddenFilters),
  )

  return toUsersTableResult(result)
}

export async function getUserRequest(userId: string): Promise<User> {
  return toUser(await apiClient.get<UserRecord>(`/users/${userId}`))
}

export async function createUserRequest(payload: CreateUserPayload): Promise<User> {
  const user = await apiClient.post<UserRecord>('/users', payload)

  return toUser(user)
}

export async function checkInviteUserRequest(email: string): Promise<{ user?: User | null; type?: string | null }> {
  const result = await apiClient.post<ApiListResult<UserRecord>>(USERS_LIST_URL, {
    search: email,
    limit: 1,
    orderBy: 'createdAt',
    order: SortOrder.desc,
  })
  const user = result.items.find((item) => item.email?.toLowerCase() === email.trim().toLowerCase())

  return {
    user: user ? toUser(user) : null,
    type: user ? 'existing' : 'new',
  }
}

export async function inviteUserRequest(payload: InviteUserPayload): Promise<User> {
  const existing = await checkInviteUserRequest(payload.email)
  if (existing.user) return existing.user

  const user = await apiClient.post<UserRecord>('/users', {
    email: payload.email,
    position: payload.position,
    role: payload.role,
    permissions: payload.permissions,
  })

  return toUser(user)
}

export async function updateUserRequest(userId: string, payload: CreateUserPayload): Promise<User> {
  const user = await apiClient.patch<UserRecord>(`/users/${userId}`, {
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    phone: payload.phone,
    position: payload.position,
    role: payload.role,
    permissions: payload.permissions,
  })

  return toUser(user)
}

// UpdateUserDto (backend) only accepts firstName/lastName/phone/isActive — email/position/
// role/permissions sent via updateUserRequest above are silently ignored server-side. This is
// the real "edit details" call; role/permissions now go through the dedicated
// updateStaff/updateCustomerMembership/updateOpsMembership calls.
export async function updateUserDetailsRequest(userId: string, payload: UpdateUserDetailsPayload): Promise<User> {
  const user = await apiClient.patch<UserRecord>(`/users/${userId}`, payload)

  return toUser(user)
}

export async function updateStaff(userId: string, payload: { staffRole: StaffRole }): Promise<void> {
  await apiClient.patch<void>(`/users/${userId}/staff`, payload)
}

export async function updateCustomerMembership(userId: string, payload: CustomerMembershipInput): Promise<void> {
  await apiClient.patch<void>(`/users/${userId}/customer`, payload)
}

export async function updateOpsMembership(userId: string, payload: OpsMembershipInput): Promise<void> {
  await apiClient.patch<void>(`/users/${userId}/ops`, payload)
}

export async function deleteUserRequest(userId: string): Promise<void> {
  await apiClient.delete(`/users/${userId}`)
}

export async function activateUserRequest(userId: string): Promise<User> {
  return toUser(await apiClient.patch<UserRecord>(`/users/${userId}/activate`))
}

export async function deactivateUserRequest(userId: string): Promise<User> {
  return toUser(await apiClient.patch<UserRecord>(`/users/${userId}/deactivate`))
}

export async function archiveUserRequest(userId: string): Promise<User> {
  return toUser(await apiClient.post<UserRecord>(`/users/${userId}/archive`))
}

export async function unarchiveUserRequest(userId: string): Promise<User> {
  return toUser(await apiClient.post<UserRecord>(`/users/${userId}/unarchive`))
}

// Super-admin only (backend enforces staffRole === SUPER_ADMIN, ADMIN app context) — forces a
// new temp password on the target user and emails it to them directly, no reset link involved.
export async function resetUserPasswordRequest(userId: string): Promise<void> {
  await apiClient.post(`/users/${userId}/reset-password`)
}
