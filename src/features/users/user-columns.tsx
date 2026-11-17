import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { NO_VALUE_STR } from '@/constants'
import { UserScopeCell } from '@/features/users/UserScopeCell'
import { UserStatusBadge } from '@/features/users/UserStatusBadge'
import { Badge } from '@/components/ui/badge'
import { UserService } from '@/features/users/user-service'
import { StoreScope, type CustomerMembershipRecord } from '@/types/membership'
import type { User } from '@/types/user'
import { formatDateTime } from '@/utils/date-utils'
import { getPortalSafe, Portal } from '@/utils/portal-utils'
import { formatPhoneNumber } from '@/lib/phone'
import type { DataTableFilter } from '@/components/data-table'
import { getUserContractFilterOptionsRequest } from '@/features/users/api'

function userActivityColumn(): ColumnDef<User> {
  return {
    id: 'activitySummary',
    header: 'Activity',
    cell: ({ row }) => {
      const activity = row.original.activitySummary
      const attendedCount = activity?.attendedCount ?? 0
      const contractName = activity?.contractNames?.length
        ? activity.contractNames.join(', ')
        : 'Credits'
      const creditLabel = activity?.unlimited
        ? `${contractName} · ∞`
        : `${contractName} · ${activity?.remainingCredits ?? 0} credits`
      const attendedDate = activity?.lastAttendedAt
        ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(activity.lastAttendedAt))
        : '—'

      return <div className="flex min-w-44 flex-col items-start gap-1" title={`${attendedCount} attended sessions · ${creditLabel} · Last attended ${attendedDate}`}>
        <Badge variant="secondary" className="h-5 rounded-full border-0 bg-muted px-2 text-[11px] font-medium">Attended · {attendedCount}</Badge>
        <Badge variant="secondary" className="h-5 max-w-full rounded-full border-0 bg-[#eef3e9] px-2 text-[11px] font-medium text-[#4e6545]">
          <span className="truncate">{creditLabel}</span>
        </Badge>
        <Badge variant="outline" className="h-5 rounded-full px-2 text-[11px] font-medium text-muted-foreground">Last attended · {attendedDate}</Badge>
      </div>
    },
  }
}

export function getUserActivityFilters(customerId?: string): DataTableFilter<User>[] {
  const options = (values: Array<[string, string]>) => async () => ({
    items: values.map(([id, label]) => ({ id, label })),
    total: values.length,
  })
  return [
    {
      id: 'attendedSessions', label: 'Attended sessions', column: 'attendedSessions', selectionMode: 'single',
      queryFn: options([['0', '0'], ['1-4', '1–4'], ['5-9', '5–9'], ['10-24', '10–24'], ['25+', '25+']]),
      getValue: (user) => String(user.activitySummary?.attendedCount ?? 0),
    },
    {
      id: 'remainingSessions', label: 'Sessions remaining', column: 'remainingSessions', selectionMode: 'single',
      queryFn: options([['0', '0 credits'], ['1-4', '1–4 credits'], ['5-9', '5–9 credits'], ['10-24', '10–24 credits'], ['25+', '25+ credits'], ['UNLIMITED', 'Unlimited']]),
      getValue: (user) => user.activitySummary?.unlimited ? 'UNLIMITED' : String(user.activitySummary?.remainingCredits ?? 0),
    },
    {
      id: 'contractId', label: 'Contract', column: 'contractId', selectionMode: 'single',
      queryFn: (search, page) => getUserContractFilterOptionsRequest(search, page, customerId),
      getValue: (user) => user.activitySummary?.contractPricingOptionIds ?? [],
    },
  ]
}

export type UserTableUsage = 'users' | 'staff' | 'customer-details' | 'store-details'

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
    accessorKey: 'source',
    header: 'Source',
    cell: ({ row }) => {
      const source = row.original.source ?? 'DIRECT'
      const label = source === 'CLASSPASS' ? 'ClassPass' : source === 'DIRECT' ? 'Direct' : source.replaceAll('_', ' ')
      return <Badge variant="outline">{label}</Badge>
    },
  },
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const name = [row.original.firstName, row.original.lastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ')
      const label = name || String(row.original.id)

      return (
        <Link
          to={`/users/${row.original.id}`}
          title={label}
          className={name ? 'font-medium underline-offset-2 hover:underline' : 'font-mono text-xs underline-offset-2 hover:underline'}
        >
          {label}
        </Link>
      )
    },
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
  {
    id: 'customer',
    header: 'Customer',
    cell: ({ row }) => {
      const customer = row.original.customer
      if (!customer) return NO_VALUE_STR

      return <Link to={`/customers/${customer.id}`} className="underline-offset-2 hover:underline">{customer.name}</Link>
    },
  },
]

const adminStaffColumns: ColumnDef<User>[] = [
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
    if (portal === Portal.ADMIN) return [...userColumns, userActivityColumn(), ...adminUsersColumns]
    if (portal === Portal.CUSTOMER) return [...userColumns, userActivityColumn()]

    return [...userColumns, userActivityColumn()]
  }

  if (usage === 'staff') {
    if (portal === Portal.ADMIN) return [...userColumns, ...adminStaffColumns]
    if (portal === Portal.CUSTOMER) {
      return [...userColumns, customerRoleColumn(options.customerId), customerScopeColumn(options.customerId, canEdit)]
    }

    return userColumns
  }

  if (usage === 'customer-details') {
    return [...userColumns, userActivityColumn(), customerRoleColumn(options.customerId), customerScopeColumn(options.customerId, canEdit)]
  }

  if (usage === 'store-details') {
    return [...userColumns, customerStoreRoleColumn(options.customerId, options.storeId)]
  }

  return userColumns
}
