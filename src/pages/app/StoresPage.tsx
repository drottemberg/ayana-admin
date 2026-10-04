import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { OrganizationService } from '@/features/organizations/organization-service'
import { fetchStoreFilterOptions, getStoresRequest } from '@/features/stores/api'
import { storeColumns } from '@/features/stores/store-columns'
import { storesQueryKeys } from '@/features/stores/query-keys'
import { Drawer, DrawerId } from '@/providers/drawer'
import type { Store } from '@/types/customer'
import { TimezoneUtils } from '@/utils'
import { NO_VALUE_STR } from '@/constants'

type StoresTableProps = {
  hiddenFilters?: Record<string, unknown>
  initialFilters?: Partial<Record<keyof Store & string, string[]>>
  tableKey?: string
  queryKey?: readonly unknown[]
  emptyAction?: {
    name: string
    onClick: () => void
  }
}

export default function StoresPage() {
  return (
    <>
      <PageHeader
        title="Stores"
        primaryAction={{
          children: 'Create new store',
          onClick: () => Drawer.show(DrawerId.CreateStore, {}),
        }}
      />

      <section className="p-4 md:p-6">
        <StoresTable />
      </section>
    </>
  )
}

export function StoresTable({
  hiddenFilters,
  initialFilters,
  tableKey = 'stores.root',
  queryKey = [...storesQueryKeys.all, 'table', hiddenFilters],
  emptyAction,
}: StoresTableProps) {
  return (
    <DataTableAsync
      queryKey={queryKey}
      loadData={(tableState: DataTableState<Store>) => getStoresRequest(tableState, hiddenFilters)}
      tableKey={tableKey}
      initialFilters={initialFilters}
      columns={storeColumns}
      searchPlaceholder="Search by name..."
      searchColumns={['name', 'address', 'customer']}
      filters={[
        {
          id: 'customerId',
          label: 'Customer',
          column: 'customer',
          queryFn: (search, page) => fetchStoreFilterOptions('customer', search, page),
        },
        {
          id: 'timezone',
          label: 'Timezone',
          column: 'timezone',
          getValue: (store) => TimezoneUtils.getTimezoneLabel(store.timezone) || NO_VALUE_STR,
        },
      ]}
      getCommands={(stores) =>
        OrganizationService.getTableActions({
          kind: 'store',
          organizations: stores,
        })
      }
      getRowCommands={(store) =>
        OrganizationService.getActions({
          kind: 'store',
          organization: store,
        })
      }
      loadingMessage="Loading stores..."
      emptyMessage="No stores found."
      emptyAction={emptyAction}
      errorMessage="Failed to load stores."
    />
  )
}
