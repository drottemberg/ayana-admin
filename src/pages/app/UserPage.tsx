import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'
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
import { getPartnersRequest } from '@/features/partners/api'
import { partnerColumns } from '@/features/partners/partner-columns'
import { partnersQueryKeys } from '@/features/partners/query-keys'
import { getStoresRequest } from '@/features/stores/api'
import { storeColumns } from '@/features/stores/store-columns'
import { storesQueryKeys } from '@/features/stores/query-keys'
import { getUserRequest } from '@/features/users/api'
import { UserStatusBadge } from '@/features/users/UserStatusBadge'
import { usersQueryKeys } from '@/features/users/query-keys'
import { UserService } from '@/features/users/user-service'
import { Drawer, DrawerId } from '@/providers/drawer'
import { ModalId, Modals } from '@/providers/modal'
import type { SelectTableRow } from '@/providers/modal-types'
import type { Store } from '@/types/store'
import type { User } from '@/types/user'
import { NO_VALUE_STR } from '@/constants'
import { StringUtils, TimezoneUtils } from '@/utils'
import * as GeoUtils from '@/utils/geo-utils'
import { useDetailQuery } from '@/lib/query-hooks'
import { formatDateTime } from '@/utils/date-utils'

const MODULE_ANCHOR_PREFIX = 'module'

function makeViewAllTo(path: string, userId: string) {
  const params = new URLSearchParams({ userId })

  return `${path}?${params.toString()}`
}

function getUserCustomersCount(user?: User) {
  return user?.customerMemberships?.length ?? user?.memberOrganizations?.length ?? 0
}

function getUserStoresCount(user?: User) {
  const storeIds = new Set<string>()

  for (const membership of user?.customerMemberships ?? []) {
    for (const store of membership.stores ?? []) {
      storeIds.add(store.storeId)
    }
  }

  return storeIds.size
}

function getUserPartnersCount(user?: User) {
  return user?.technicianMemberships?.length ?? 0
}

const storeSelectColumns: ColumnDef<SelectTableRow>[] = [
  {
    accessorKey: 'name',
    header: 'Store name',
    cell: ({ row }) => (row.original as Store).name,
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) => {
      const store = row.original as Store

      return store.address ? StringUtils.displayAddress(store.address, { hideCountry: true }) : NO_VALUE_STR
    },
  },
  {
    accessorKey: 'country',
    header: 'Country',
    cell: ({ row }) => GeoUtils.getCountryName((row.original as Store).address?.countryId) ?? NO_VALUE_STR,
  },
  {
    accessorKey: 'timezone',
    header: 'Timezone',
    cell: ({ row }) => TimezoneUtils.getTimezoneLabel((row.original as Store).timezone) || NO_VALUE_STR,
  },
]

async function loadStoreSelectData(
  tableState: DataTableState<SelectTableRow>,
): Promise<DataTableAsyncResult<SelectTableRow>> {
  const result = await getStoresRequest(tableState as unknown as DataTableState<Store>)

  return {
    ...result,
    items: result.items as unknown as SelectTableRow[],
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
        { label: 'Phone number', value: user?.phone ?? NO_VALUE_STR },
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
  const {
    data: user,
    isError,
    isLoading,
  } = useDetailQuery({
    queryKey: usersQueryKeys.detail(userId),
    queryFn: () => getUserRequest(userId),
    enabled: Boolean(userId),
  })
  const openAddStoreModal = () => {
    if (!user) return

    Modals.show(ModalId.SelectTableData, {
      title: 'Add store',
      queryKey: [...storesQueryKeys.all, 'select-for-user', user.id],
      loadData: loadStoreSelectData,
      columns: storeSelectColumns,
      searchPlaceholder: 'Search by ID, name...',
      searchColumns: ['id', 'name'],
      selectionMode: 'multiple',
      tableKey: 'users.detail.add-store',
      loadingMessage: 'Loading stores...',
      emptyMessage: 'No stores found.',
      submitLabel: 'Add',
      onSelect: (stores) => console.log('Add stores for user:', { user, stores }),
    })
  }
  const modules = [
    { key: 'customers', label: 'Customers' },
    { key: 'stores', label: 'Stores' },
    { key: 'partners', label: 'Maintenance partners' },
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
        options: user ? UserService.getDetailHeaderActions(user, permissions, { onAddStore: openAddStoreModal }).options : [],
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
        id={`${MODULE_ANCHOR_PREFIX}-stores`}
        title="Stores"
        initialTotal={getUserStoresCount(user)}
        viewAllTo={makeViewAllTo('/stores', userId)}
        queryKey={[...storesQueryKeys.all, 'user', userId, 'module']}
        loadData={(tableState) => getStoresRequest(tableState, { userId })}
        tableKey={`stores.user.${userId}`}
        columns={storeColumns}
        getRowCommands={(store) =>
          OrganizationService.getActions({
            kind: 'store',
            organization: store,
          })
        }
        action={user ? UserService.getModuleAction(user, 'stores', permissions, { onAddStore: openAddStoreModal }) : undefined}
        loadingMessage="Loading stores..."
        emptyMessage="No stores assigned"
        errorMessage="Failed to load stores."
      />
      <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-partners`}
        title="Maintenance partners"
        initialTotal={getUserPartnersCount(user)}
        viewAllTo={makeViewAllTo('/partners', userId)}
        queryKey={[...partnersQueryKeys.all, 'user', userId, 'module']}
        loadData={(tableState) => getPartnersRequest(tableState, { userId })}
        tableKey={`partners.user.${userId}`}
        columns={partnerColumns}
        getRowCommands={(partner) =>
          OrganizationService.getActions({
            kind: 'partner',
            organization: partner,
          })
        }
        loadingMessage="Loading maintenance partners..."
        emptyMessage="No maintenance partners assigned"
        errorMessage="Failed to load maintenance partners."
      />
    </DetailPageLayout>
  )
}
