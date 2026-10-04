import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DataTableAsync } from '@/components/data-table'
import type { DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { useConnect } from '@/features/app/use-connect'
import { getCustomersListRequest } from '@/features/customers/api'
import { getUsersRequest } from '@/features/users/api'
import { getUserListColumns } from '@/features/users/user-columns'
import { usersQueryKeys } from '@/features/users/query-keys'
import { UserService } from '@/features/users/user-service'
import { Drawer, DrawerId } from '@/providers/drawer'
import type { User } from '@/types/user'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

export default function UsersPage() {
  const [searchParams] = useSearchParams()
  const storeId = searchParams.get('storeId') || undefined
  const hiddenFilters = useMemo(() => (storeId ? { storeId } : undefined), [storeId])

  return (
    <>
      <PageHeader
        title="Users"
        primaryAction={{
          children: 'Create new user',
          onClick: () => Drawer.show(DrawerId.CreateUser, {}),
        }}
      />
      <section className="p-4 md:p-6">
        <UsersTable key={storeId ?? 'all'} hiddenFilters={hiddenFilters} />
      </section>
    </>
  )
}

export function UsersTable({
  hiddenFilters,
  initialFilters,
  tableKey = 'users.root',
}: {
  hiddenFilters?: Record<string, unknown>
  initialFilters?: Partial<Record<keyof User & string, string[]>>
  tableKey?: string
}) {
  const { session } = useConnect()
  const permissions = session?.permissions.users
  const portal = getPortalSafe()
  const currentOrganizationId = session?.currentOrganization?.id ?? undefined
  const loadUsers = (tableState: DataTableState<User>) => getUsersRequest(tableState, hiddenFilters)
  const tableColumns = getUserListColumns({
    usage: 'users',
    portal,
    customerId: portal === Portal.CUSTOMER ? currentOrganizationId : undefined,
    partnerId: portal === Portal.OPS ? currentOrganizationId : undefined,
    canEditPermissions: permissions?.edit,
  })

  return (
    <DataTableAsync
      queryKey={[...usersQueryKeys.all, 'table', hiddenFilters]}
      loadData={loadUsers}
      tableKey={tableKey}
      initialFilters={initialFilters}
      columns={tableColumns}
      searchPlaceholder="Search by ID, name, email, phone"
      searchColumns={['id', 'firstName', 'lastName', 'email', 'phone']}
      filters={[
        {
          id: 'customerId',
          label: 'Customer',
          column: 'customer',
          selectionMode: 'single',
          queryFn: async (search) => {
            const customers = await getCustomersListRequest(undefined, search)
            return {
              items: customers.map((customer) => ({ id: customer.id, label: customer.name })),
              total: customers.length,
            }
          },
        },
        {
          id: 'status',
          label: 'Status',
          column: 'status',
          // Static, not derived from the current page's rows — otherwise a status with zero
          // matches on the loaded page (e.g. no Archived users yet) silently disappears from
          // the dropdown, with no way to pick it or clear back to it.
          // Raw UserStatus values, not display labels — this filter's options/getValue are the
          // exact strings forwarded as filters.status to the backend's buildStatusCondition
          // switch (see getUsersRequest), which matches on ACTIVE/DISABLED/ARCHIVED/DELETED
          // verbatim, not "Active"/"Disabled"/etc.
          options: UserService.userStatusKeys(),
          getValue: (user) => UserService.getUserStatus(user),
        },
      ]}
      getCommands={(selectedUsers) => UserService.getTableActions(selectedUsers, permissions)}
      getRowCommands={(user) => UserService.getActions(user, permissions)}
      loadingMessage="Loading users..."
      emptyMessage="No users found."
      errorMessage="Failed to load users."
    />
  )
}
