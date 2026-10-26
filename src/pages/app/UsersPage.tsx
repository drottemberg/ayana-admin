import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { DataTableAsync } from '@/components/data-table'
import type { DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import { getCustomersListRequest } from '@/features/customers/api'
import { getUsersRequest } from '@/features/users/api'
import { getLocationFilterOptionsRequest } from '@/features/locations/api'
import { getUserListColumns } from '@/features/users/user-columns'
import { usersQueryKeys } from '@/features/users/query-keys'
import { UserService } from '@/features/users/user-service'
import { Drawer, DrawerId } from '@/providers/drawer'
import type { User } from '@/types/user'
import { getPortalSafe, Portal } from '@/utils/portal-utils'
import { CoachProfileDrawer } from '@/features/coaches/CoachProfileDrawer'
import { getCoachProfileRequest } from '@/features/coaches/api'
import type { CoachProfile } from '@/features/coaches/types'
import { ApiError } from '@/lib/api-client'

export default function UsersPage() {
  const { session } = useConnect()
  const isCustomerContext = getAppMode() === 'customer'
  const currentCustomerId = session?.currentOrganization?.id
  const canAddUser = Boolean(session?.can('users', 'create')) && (!isCustomerContext || Boolean(currentCustomerId))
  const hiddenFilters = useMemo(() => ({
    ...(isCustomerContext && currentCustomerId ? { organizationId: currentCustomerId } : {}),
    userDirectory: 'users',
  }), [currentCustomerId, isCustomerContext])

  return (
    <>
      <PageHeader
        title="Users"
        primaryAction={canAddUser ? {
          children: 'Add user',
          onClick: () => Drawer.show(DrawerId.CreateUser, isCustomerContext
            ? { mode: 'customer-user', customerId: currentCustomerId }
            : { mode: 'invite' }),
        } : undefined}
      />
      <section className="p-4 md:p-6">
        <UsersTable hiddenFilters={hiddenFilters} />
      </section>
    </>
  )
}

export function UsersTable({
  hiddenFilters,
  initialFilters,
  tableKey = 'users.root',
  userDirectory = 'users',
}: {
  hiddenFilters?: Record<string, unknown>
  initialFilters?: Partial<Record<keyof User & string, string[]>>
  tableKey?: string
  userDirectory?: 'users' | 'staff'
}) {
  const { session } = useConnect()
  const permissions = session?.permissions.users
  const portal = getPortalSafe()
  const isCustomerContext = getAppMode() === 'customer'
  const currentOrganizationId = session?.currentOrganization?.id ?? undefined
  const [coachEditor, setCoachEditor] = useState<{
    customerId: string
    customerName: string
    profile: CoachProfile | null
    userId: string
    userName: string
  } | null>(null)
  const openCoachEditor = async (user: User, customerId: string, customerName: string) => {
    let profile: CoachProfile | null = null
    try {
      profile = await getCoachProfileRequest(customerId, String(user.id))
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        toast.error(error instanceof Error ? error.message : 'Could not load the coach profile.')
        return
      }
    }
    setCoachEditor({
      customerId,
      customerName,
      profile,
      userId: String(user.id),
      userName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Instructor',
    })
  }
  const loadUsers = (tableState: DataTableState<User>) => getUsersRequest(tableState, { ...hiddenFilters, userDirectory })
  const tableColumns = getUserListColumns({
    usage: userDirectory === 'staff' ? 'staff' : 'users',
    portal,
    customerId: portal === Portal.CUSTOMER ? currentOrganizationId : undefined,
    canEditPermissions: permissions?.edit,
  })

  return <>
    <DataTableAsync
      queryKey={[...usersQueryKeys.all, 'table', userDirectory, hiddenFilters]}
      loadData={loadUsers}
      refetchOnMount="always"
      tableKey={tableKey}
      initialFilters={initialFilters}
      columns={tableColumns}
      searchPlaceholder="Search by ID, name, email, phone"
      searchColumns={['id', 'firstName', 'lastName', 'email', 'phone']}
      filters={[
        ...(isCustomerContext || userDirectory === 'staff' ? [] : [{
          id: 'customerId',
          label: 'Customer',
          column: 'customer' as const,
          selectionMode: 'single' as const,
          queryFn: async (search: string) => {
            const customers = await getCustomersListRequest(undefined, search)
            return {
              items: customers.map((customer) => ({ id: customer.id, label: customer.name })),
              total: customers.length,
            }
          },
        }]),
        {
          id: 'contractLocationId',
          label: 'Contract location',
          column: 'contractLocationId',
          selectionMode: 'single',
          queryFn: getLocationFilterOptionsRequest,
        },
        {
          id: 'purchaseLocationId',
          label: 'Purchase location',
          column: 'purchaseLocationId',
          selectionMode: 'single',
          queryFn: getLocationFilterOptionsRequest,
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
      getRowCommands={(user) => [
        ...UserService.getActions(user, permissions),
        ...(session?.permissions.coaches?.edit
          ? (user.customerMemberships ?? [])
            .filter((membership) => membership.role === 'INSTRUCTOR' && (!isCustomerContext || membership.customerId === currentOrganizationId))
            .map((membership) => ({
              label: `Edit coach profile${isCustomerContext ? '' : ` · ${membership.customerName || 'Customer'}`}`,
              onClick: () => { void openCoachEditor(user, membership.customerId, membership.customerName || 'Customer') },
            }))
          : []),
      ]}
      loadingMessage="Loading users..."
      emptyMessage={userDirectory === 'staff' ? 'No staff found.' : 'No users found.'}
      errorMessage={userDirectory === 'staff' ? 'Failed to load staff.' : 'Failed to load users.'}
    />
    {coachEditor ? <CoachProfileDrawer
      customerId={coachEditor.customerId}
      customerName={coachEditor.customerName}
      profile={coachEditor.profile}
      initialUserId={coachEditor.profile ? undefined : coachEditor.userId}
      initialUserName={coachEditor.userName}
      open
      onOpenChange={(open) => { if (!open) setCoachEditor(null) }}
    /> : null}
  </>
}
