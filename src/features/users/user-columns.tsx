import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { NO_VALUE_STR } from '@/constants'
import { UserScopeCell } from '@/features/users/UserScopeCell'
import { UserStatusBadge } from '@/features/users/UserStatusBadge'
import { UserService } from '@/features/users/user-service'
import { StoreScope, type CustomerMembershipRecord } from '@/types/membership'
import type { User } from '@/types/user'
import { formatDateTime } from '@/utils/date-utils'
import { getPortalSafe, Portal } from '@/utils/portal-utils'
import { formatPhoneNumber } from '@/lib/phone'

export type UserTableUsage = 'users' | 'customer-details' | 'store-details'

export type UserListColumnOptions = {
  usage?: UserTableUsage
  portal?: Portal | null
  customerId?: string
  storeId?: string
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
    cell: ({ row }) => formatPhoneNumber(row.original.phone) || NO_VALUE_STR,
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
    id: 'customers',
    header: 'Customers',
    cell: ({ row }) => {
      const customers = Array.from(
        new Map(
          (row.original.customerMemberships ?? [])
            .filter((membership) => membership.customerName)
            .map((membership) => [membership.customerId, membership.customerName!]),
        ),
      ).map(([id, name]) => ({ id, name }))
      const visibleCustomers = customers.slice(0, 2)
      const hiddenCount = customers.length - visibleCustomers.length

      if (!customers.length) return NO_VALUE_STR

      return (
        <div className="flex max-w-64 flex-wrap items-center gap-1" title={customers.map((customer) => customer.name).join(', ')}>
          {visibleCustomers.map((customer) => (
            <Link
              key={customer.id}
              to={`/customers/${customer.id}`}
              className="max-w-36 truncate rounded-md bg-muted px-2 py-0.5 text-xs underline-offset-2 hover:underline"
            >
              {customer.name}
            </Link>
          ))}
          {hiddenCount > 0 && <span className="text-xs text-muted-foreground">+{hiddenCount}</span>}
        </div>
      )
    },
  },
]

function customerMembership(user: User, customerId?: string): CustomerMembershipRecord | undefined {
  if (!customerId) return undefined

  return (user.customerMemberships ?? []).find((membership) => membership.customerId === customerId)
}

function customerStoreRole(user: User, customerId?: string, storeId?: string): string {
  const membership = customerMembership(user, customerId)
  if (!membership || !storeId || membership.storeScope === StoreScope.NONE) return NO_VALUE_STR
  if (membership.storeScope === StoreScope.ALL) return UserService.customerRoleToString(membership.role)

  const store = (membership.stores ?? []).find((item) => item.storeId === storeId)
  if (!store) return NO_VALUE_STR

  return UserService.customerRoleToString(store.role ?? membership.role)
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

  return userColumns
}
