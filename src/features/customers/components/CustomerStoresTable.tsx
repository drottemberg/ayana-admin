import { useCallback, useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Link, useSearchParams } from 'react-router-dom'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { Checkbox } from '@/components/ui/checkbox'
import { NO_VALUE_STR } from '@/constants'
import { OrganizationStatusBadge } from '@/features/organizations/OrganizationStatusBadge'
import { getStoresRequest } from '@/features/stores/api'
import { storesQueryKeys } from '@/features/stores/query-keys'
import { StringUtils, TimezoneUtils } from '@/utils'
import type { Customer, Store } from '@/types/customer'

const storeColumns: ColumnDef<Store>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link to={`/stores/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) =>
      row.original.address ? StringUtils.displayAddress(row.original.address, { splitter: ', ' }) : NO_VALUE_STR,
  },
  {
    accessorKey: 'timezone',
    header: 'Timezone',
    cell: ({ row }) => TimezoneUtils.getTimezoneLabel(row.original.timezone) || NO_VALUE_STR,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <OrganizationStatusBadge
        status={row.original.orgStatus}
        isDeleted={row.original.isDeleted}
        isArchived={row.original.isArchived}
      />
    ),
  },
]

export function CustomerStoresTable({ customer }: { customer: Customer }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const showDeleted = searchParams.get('storesShowDeleted') === 'true'

  const setShowDeleted = (v: boolean) => {
    const next = new URLSearchParams(searchParams)
    v ? next.set('storesShowDeleted', 'true') : next.delete('storesShowDeleted')
    setSearchParams(next, { replace: true })
  }

  const hiddenFilters = useMemo(
    () => ({ customerId: customer.id, ...(showDeleted ? { showDeleted: true } : {}) }),
    [customer.id, showDeleted],
  )

  const loadData = useCallback(
    (state: DataTableState<Store>) => getStoresRequest(state, hiddenFilters),
    [hiddenFilters],
  )

  return (
    <DataTableAsync
      key={`stores-${showDeleted}`}
      queryKey={[...storesQueryKeys.customer(customer.id), showDeleted]}
      loadData={loadData}
      tableKey="customers.detail.stores"
      columns={storeColumns}
      searchPlaceholder="Search by name..."
      searchColumns={['name', 'address']}
      toolbarExtra={
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={showDeleted} onCheckedChange={(v) => setShowDeleted(Boolean(v))} />
          Show deleted
        </label>
      }
      loadingMessage="Loading stores..."
      emptyMessage="No stores found"
    />
  )
}
