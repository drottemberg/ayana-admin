import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { NO_VALUE_STR } from '@/constants'
import { UserScopeCell } from '@/features/users/UserScopeCell'
import { UserStatusBadge } from '@/features/users/UserStatusBadge'
import { UserService } from '@/features/users/user-service'
import { StoreScope, type CustomerMembershipRecord, type OpsMembershipRecord } from '@/types/membership'
import type { User } from '@/types/user'
import { formatDateTime } from '@/utils/date-utils'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

export type UserTableUsage = 'users' | 'customer-details' | 'store-details' | 'partner-details'

export type UserListColumnOptions = {
  usage?: UserTableUsage
  portal?: Portal | null
  customerId?: string
  storeId?: string
  partnerId?: string
  canEditPermissions?: boolean
}

export const userColumns: ColumnDef<User>[] = [
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <UserStatusBadge status={UserService.getUserStatus(row.original)} />,
  },
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link to={`/users/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
        {row.original.firstName} {row.original.lastName}
      </Link>
    ),
  },
  { accessorKey: 'email', header: 'Email' },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }) => row.original.phone ?? NO_VALUE_STR,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created at',
    cell: ({ row }) => formatDateTime(row.original.createdAt, NO_VALUE_STR),
  },
]

export const adminOnlyUserColumns: ColumnDef<User>[] = [
  {
    id: 'isStaff',
    header: 'Staff',
    cell: ({ row }) => (row.original.isStaff ? 'Yes' : 'No'),
  },
  {
    id: 'staffRole',
    header: 'Staff role',
    cell: ({ row }) => (row.original.staffRole ? UserService.staffRoleToString(row.original.staffRole) : NO_VALUE_STR),
  },
]

const adminUsersColumns: ColumnDef<User>[] = [
  ...adminOnlyUserColumns,
  {
    id: 'customerCount',
    header: 'Customers',
    cell: ({ row }) =>
      new Set((row.original.customerMemberships ?? []).map((membership) => membership.customerId)).size,
  },
  {
    id: 'partnerCount',
    header: 'Partners',
    cell: ({ row }) =>
      new Set((row.original.technicianMemberships ?? []).map((membership) => membership.partnerId)).size,
  },
]

function customerMembership(user: User, customerId?: string): CustomerMembershipRecord | undefined {
  if (!customerId) return undefined

  return (user.customerMemberships ?? []).find((membership) => membership.customerId === customerId)
}

function opsMembership(user: User, partnerId?: string): OpsMembershipRecord | undefined {
  if (!partnerId) return undefined

  return (user.technicianMemberships ?? []).find((membership) => membership.partnerId === partnerId)
}

function opsCustomerScope(membership: OpsMembershipRecord | undefined, customerId?: string) {
  if (!membership || !customerId) return undefined

  return (membership.customerScopes ?? []).find((scope) => scope.customerId === customerId)
}

function customerStoreRole(user: User, customerId?: string, storeId?: string): string {
  const membership = customerMembership(user, customerId)
  if (!membership || !storeId || membership.storeScope === StoreScope.NONE) return NO_VALUE_STR
  if (membership.storeScope === StoreScope.ALL) return UserService.customerRoleToString(membership.role)

  const store = (membership.stores ?? []).find((item) => item.storeId === storeId)
  if (!store) return NO_VALUE_STR

  return UserService.customerRoleToString(store.role ?? membership.role)
}

function opsHasCustomerAccess(membership: OpsMembershipRecord | undefined, customerId?: string): boolean {
  if (!membership || !customerId || membership.scopeType === StoreScope.NONE) return false
  if (membership.scopeType === StoreScope.ALL) return true

  const scope = opsCustomerScope(membership, customerId)
  return Boolean(scope && scope.storeScope !== StoreScope.NONE)
}

function opsHasStoreAccess(
  membership: OpsMembershipRecord | undefined,
  customerId?: string,
  storeId?: string,
): boolean {
  if (!membership || !customerId || !storeId || membership.scopeType === StoreScope.NONE) return false
  if (membership.scopeType === StoreScope.ALL) return true

  const scope = opsCustomerScope(membership, customerId)
  if (!scope || scope.storeScope === StoreScope.NONE) return false
  if (scope.storeScope === StoreScope.ALL) return true

  return (scope.storeIds ?? []).includes(storeId)
}

function opsScopeForCustomer(user: User, partnerId?: string, customerId?: string): StoreScope | undefined {
  const membership = opsMembership(user, partnerId)
  if (!membership || !opsHasCustomerAccess(membership, customerId)) return undefined
  if (membership.scopeType === StoreScope.ALL) return StoreScope.ALL

  return opsCustomerScope(membership, customerId)?.storeScope
}

function opsScopeForStore(
  user: User,
  partnerId?: string,
  customerId?: string,
  storeId?: string,
): StoreScope | undefined {
  const membership = opsMembership(user, partnerId)
  if (!membership || !opsHasStoreAccess(membership, customerId, storeId)) return undefined
  if (membership.scopeType === StoreScope.ALL) return StoreScope.ALL

  return opsCustomerScope(membership, customerId)?.storeScope
}

function customerRoleColumn(customerId?: string): ColumnDef<User> {
  return {
    id: 'customerRole',
    header: 'Role',
    cell: ({ row }) => {
      const membership = customerMembership(row.original, customerId)
      return membership ? UserService.customerRoleToString(membership.role) : NO_VALUE_STR
    },
  }
}

function customerScopeColumn(customerId?: string, canEdit?: boolean): ColumnDef<User> {
  return {
    id: 'customerScope',
    header: 'Scope',
    cell: ({ row }) => {
      const membership = customerMembership(row.original, customerId)
      return (
        <UserScopeCell
          user={row.original}
          kind="customer"
          organizationId={customerId}
          scope={membership?.storeScope}
          canEdit={canEdit}
        />
      )
    },
  }
}

function customerStoreRoleColumn(customerId?: string, storeId?: string): ColumnDef<User> {
  return {
    id: 'storeRole',
    header: 'Role',
    cell: ({ row }) => customerStoreRole(row.original, customerId, storeId),
  }
}

function opsRoleColumn(partnerId?: string, customerId?: string): ColumnDef<User> {
  return {
    id: 'opsRole',
    header: 'Role',
    cell: ({ row }) => {
      const membership = opsMembership(row.original, partnerId)
      if (!membership || (customerId && !opsHasCustomerAccess(membership, customerId))) return NO_VALUE_STR

      return UserService.technicianRoleToString(membership.role)
    },
  }
}

function opsScopeColumn(partnerId?: string, canEdit?: boolean, customerId?: string, storeId?: string): ColumnDef<User> {
  return {
    id: 'opsScope',
    header: 'Scope',
    cell: ({ row }) => {
      const membership = opsMembership(row.original, partnerId)
      const scope = storeId
        ? opsScopeForStore(row.original, partnerId, customerId, storeId)
        : customerId
          ? opsScopeForCustomer(row.original, partnerId, customerId)
          : membership?.scopeType

      return (
        <UserScopeCell user={row.original} kind="partner" organizationId={partnerId} scope={scope} canEdit={canEdit} />
      )
    },
  }
}

export function getUserListColumns(options: UserListColumnOptions = {}) {
  const portal = options.portal ?? getPortalSafe()
  const usage = options.usage ?? 'users'
  const canEdit = options.canEditPermissions

  if (usage === 'users') {
    if (portal === Portal.ADMIN) return [...userColumns, ...adminUsersColumns]
    if (portal === Portal.CUSTOMER) {
      return [...userColumns, customerRoleColumn(options.customerId), customerScopeColumn(options.customerId, canEdit)]
    }

    return userColumns
  }

  if (usage === 'customer-details') {
    return [...userColumns, customerRoleColumn(options.customerId), customerScopeColumn(options.customerId, canEdit)]
  }

  if (usage === 'store-details') {
    return [...userColumns, customerStoreRoleColumn(options.customerId, options.storeId)]
  }

  if (usage === 'partner-details') {
    return [...userColumns, opsRoleColumn(options.partnerId), opsScopeColumn(options.partnerId, canEdit)]
  }

  return userColumns
}
