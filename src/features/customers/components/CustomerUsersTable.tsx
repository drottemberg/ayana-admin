import { useCallback, useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Link, useSearchParams } from 'react-router-dom'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { Checkbox } from '@/components/ui/checkbox'
import { NO_VALUE_STR } from '@/constants'
import { formatPhoneNumber } from '@/lib/phone'
import { getUsersRequest } from '@/features/users/api'
import { UserStatusBadge } from '@/features/users/UserStatusBadge'
import { usersQueryKeys } from '@/features/users/query-keys'
import { Drawer, DrawerId } from '@/providers/drawer'
import { UserService } from '@/features/users/user-service'
import type { Customer } from '@/types/customer'
import type { User } from '@/types/user'

const userColumns: ColumnDef<User>[] = [
  {
    id: 'fullName',
    header: 'Full name',
    cell: ({ row }) => (
      <Link to={`/users/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
        {row.original.firstName} {row.original.lastName}
      </Link>
    ),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => UserService.roleToString(row.original.role) || NO_VALUE_STR,
  },
  { accessorKey: 'email', header: 'Email' },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }) => formatPhoneNumber(row.original.phone) || NO_VALUE_STR,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <UserStatusBadge status={UserService.getUserStatus(row.original)} />,
  },
]

export function CustomerUsersTable({ customer }: { customer: Customer }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const showDeleted = searchParams.get('usersShowDeleted') === 'true'

  const setShowDeleted = (v: boolean) => {
    const next = new URLSearchParams(searchParams)
    v ? next.set('usersShowDeleted', 'true') : next.delete('usersShowDeleted')
    setSearchParams(next, { replace: true })
  }

  const hiddenFilters = useMemo(
    () => ({ organizationId: customer.id, ...(showDeleted ? {} : { isActive: true }) }),
    [customer.id, showDeleted],
  )

  const loadData = useCallback(
    (state: DataTableState<User>) => getUsersRequest(state, hiddenFilters),
    [hiddenFilters],
  )

  return (
    <DataTableAsync
      key={`users-${showDeleted}`}
      queryKey={[...usersQueryKeys.organization(customer.id), showDeleted]}
      loadData={loadData}
      tableKey="customers.detail.users"
      columns={userColumns}
      searchPlaceholder="Search by name, email..."
      searchColumns={['id', 'firstName', 'lastName', 'email']}
      filters={[{ id: 'role', label: 'Role', column: 'role', getValue: (u) => u.role }]}
      toolbarExtra={
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
          <Checkbox checked={showDeleted} onCheckedChange={(v) => setShowDeleted(Boolean(v))} />
          Show inactive
        </label>
      }
      getCommands={() => []}
      loadingMessage="Loading users..."
      emptyMessage="No users found"
      emptyAction={{ name: 'Add user', onClick: () => Drawer.show(DrawerId.CreateUser, { customerId: customer.id }) }}
    />
  )
}
