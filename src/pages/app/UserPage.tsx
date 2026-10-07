import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'
import { HugeiconsIcon } from '@hugeicons/react'
import { useParams } from 'react-router-dom'

import {
  DetailPageLayout,
  DetailSidePanel,
  RelatedEntityModule,
  type DetailPanelSection,
} from '@/components/app/detail-page-layout'
import { type DataTableAsyncResult, type DataTableState } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { useConnect } from '@/features/app/use-connect'
import { getCustomersRequest } from '@/features/customers/api'
import { customerColumns } from '@/features/customers/customer-columns'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { OrganizationService } from '@/features/organizations/organization-service'
import { getAllLocationsForCustomerRequest, getLocationRequest } from '@/features/locations/api'
import { locationColumns } from '@/features/locations/location-columns'
import { locationsQueryKeys } from '@/features/locations/query-keys'
import { getUserRequest } from '@/features/users/api'
import { UserStatusBadge } from '@/features/users/UserStatusBadge'
import { usersQueryKeys } from '@/features/users/query-keys'
import { UserService } from '@/features/users/user-service'
import { Drawer, DrawerId } from '@/providers/drawer'
import { LocationScope } from '@/types/membership'
import type { Location } from '@/types/location'
import type { User } from '@/types/user'
import { NO_VALUE_STR } from '@/constants'
import { useDetailQuery } from '@/lib/query-hooks'
import { formatDateTime } from '@/utils/date-utils'
import { formatPhoneNumber } from '@/lib/phone'
import { getClientContractsRequest } from '@/features/client-contracts/api'
import { getClientContractColumns } from '@/features/client-contracts/client-contract-columns'
import { ClientContractService } from '@/features/client-contracts/client-contract-service'
import { clientContractsQueryKeys } from '@/features/client-contracts/query-keys'
import type { ClientContract } from '@/types/client-contract'
import { getOrdersRequest } from '@/features/orders/api'
import { getOrderColumns } from '@/features/orders/order-columns'
import { OrderService } from '@/features/orders/order-service'
import { ordersQueryKeys } from '@/features/orders/query-keys'
import type { Order } from '@/types/order'
import { EntityIcon } from '@/components/app/entity-icons'

const MODULE_ANCHOR_PREFIX = 'module'

function makeViewAllTo(path: string, userId: string) {
  const params = new URLSearchParams({ userId })

  return `${path}?${params.toString()}`
}

function getUserCustomersCount(user?: User) {
  return user?.customerMemberships?.length ?? user?.memberOrganizations?.length ?? 0
}

async function getUserLocations(user: User): Promise<Location[]> {
  const memberships = user.customerMemberships ?? []
  const locationSets = await Promise.all(
    memberships.map(async (membership) => {
      const scope = membership.locationScope ?? membership.storeScope
      if (scope === LocationScope.NONE) return []
      if (scope === LocationScope.SPECIFIC) {
        return Promise.all((membership.locations ?? []).map((location) => getLocationRequest(location.locationId)))
      }

      return getAllLocationsForCustomerRequest(membership.customerId)
    }),
  )

  return [...new Map(locationSets.flat().map((location) => [location.id, location])).values()]
}

async function loadUserLocations(
  user: User | undefined,
  tableState: DataTableState<Location>,
): Promise<DataTableAsyncResult<Location>> {
  const locations = user ? await getUserLocations(user) : []
  const search = tableState.search.trim().toLocaleLowerCase()
  const filtered = locations
    .filter((location) =>
      [location.name, location.email, location.phone].some((value) => value?.toLocaleLowerCase().includes(search)),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
  const { pageIndex, pageSize } = tableState.pagination
  const start = pageIndex * pageSize

  return {
    items: filtered.slice(start, start + pageSize),
    count: filtered.length,
    pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)),
  }
}

function getUserDetailSections(user?: User): DetailPanelSection[] {
  return [
    {
      title: 'Details',
      actions: user ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit user details"
          onClick={() => Drawer.show(DrawerId.CreateUser, { mode: 'edit-details', user })}
        >
          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
        </Button>
      ) : null,
      fields: [
        { label: 'Status', value: user ? <UserStatusBadge status={UserService.getUserStatus(user)} /> : NO_VALUE_STR },
        { label: 'ID', value: user?.id ?? NO_VALUE_STR },
        { label: 'First name', value: user?.firstName ?? NO_VALUE_STR },
        { label: 'Last name', value: user?.lastName ?? NO_VALUE_STR },
        { label: 'Email', value: user?.email ?? NO_VALUE_STR },
        { label: 'Phone number', value: formatPhoneNumber(user?.phone) || NO_VALUE_STR },
        {
          label: 'Created at',
          value: user?.createdAt ? formatDateTime(user.createdAt, NO_VALUE_STR) : NO_VALUE_STR,
        },
      ],
    },
  ]
}

export default function UserPage() {
  const { userId = '' } = useParams()
  const { session } = useConnect()
  const permissions = session?.permissions.users
  const canManageOrdersAndContracts = Boolean(session?.permissions.customers?.edit)
  const {
    data: user,
    isError,
    isLoading,
  } = useDetailQuery({
    queryKey: usersQueryKeys.detail(userId),
    queryFn: () => getUserRequest(userId),
    enabled: Boolean(userId),
  })
  const locationMembershipKey = (user?.customerMemberships ?? [])
    .map((membership) =>
      [membership.customerId, membership.locationScope ?? membership.storeScope, ...(membership.locations ?? []).map((location) => location.locationId)].join(':'),
    )
    .sort()
    .join('|')
  const modules = [
    { key: 'customers', label: 'Customers' },
    { key: 'locations', label: 'Locations' },
    ...(canManageOrdersAndContracts
      ? [{ key: 'client-contracts', label: 'Client contracts' }, { key: 'orders', label: 'Orders' }]
      : []),
  ]

  if (isError && !user) {
    return (
      <>
        <PageHeader title="User not found" subtitle={userId} backTo="/users" />
        <section className="p-4 md:p-6">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Failed to load this user.
          </div>
        </section>
      </>
    )
  }

  return (
    <DetailPageLayout
      header={{
        title: user ? `${user.firstName} ${user.lastName}` : 'User',
        subtitle: user ? UserService.roleToString(user.role) : userId,
        backTo: '/users',
        options: user ? UserService.getDetailHeaderActions(user, permissions).options : [],
      }}
      modules={modules}
      aside={<DetailSidePanel sections={getUserDetailSections(user)} isLoading={isLoading} />}
    >
      <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-customers`}
        title="Customers"
        initialTotal={getUserCustomersCount(user)}
        viewAllTo={makeViewAllTo('/customers', userId)}
        queryKey={[...customersQueryKeys.all, 'user', userId, 'module']}
        loadData={(tableState) => getCustomersRequest(tableState, { userId })}
        tableKey={`customers.user.${userId}`}
        columns={customerColumns}
        getRowCommands={(customer) =>
          OrganizationService.getActions({
            kind: 'customer',
            organization: customer,
          })
        }
        loadingMessage="Loading customers..."
        emptyMessage="No customers assigned"
        errorMessage="Failed to load customers."
      />
      <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-locations`}
        title="Locations"
        viewAllTo="/locations"
        queryKey={[...locationsQueryKeys.user(userId), 'module', locationMembershipKey]}
        loadData={(tableState: DataTableState<Location>) => loadUserLocations(user, tableState)}
        tableKey={`locations.user.${userId}`}
        columns={locationColumns}
        loadingMessage="Loading locations..."
        emptyMessage="No locations assigned"
        errorMessage="Failed to load locations."
      />
      {canManageOrdersAndContracts ? <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-client-contracts`}
        title="Client contracts"
        icon={EntityIcon.clientContracts}
        viewAllTo={makeViewAllTo('/client-contracts', userId)}
        queryKey={clientContractsQueryKeys.user(userId)}
        loadData={(state: DataTableState<ClientContract>) => getClientContractsRequest(state, { userId })}
        tableKey={`client-contracts.user.${userId}`}
        columns={getClientContractColumns({ showUser: false })}
        getRowCommands={(contract) => ClientContractService.getRowActions(contract, Boolean(session?.permissions.customers?.edit))}
        loadingMessage="Loading client contracts..."
        emptyMessage="No client contracts found."
      /> : null}
      {canManageOrdersAndContracts ? <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-orders`}
        title="Orders"
        icon={EntityIcon.orders}
        viewAllTo={makeViewAllTo('/orders', userId)}
        queryKey={ordersQueryKeys.user(userId)}
        loadData={(state: DataTableState<Order>) => getOrdersRequest(state, { userId })}
        tableKey={`orders.user.${userId}`}
        columns={getOrderColumns({ showUser: false })}
        getRowCommands={(order) => OrderService.getRowActions(order, Boolean(session?.permissions.customers?.edit))}
        loadingMessage="Loading orders..."
        emptyMessage="No orders found."
      /> : null}
    </DetailPageLayout>
  )
}
