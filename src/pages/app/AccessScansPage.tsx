import type { ColumnDef } from '@tanstack/react-table'
import { Link, useSearchParams } from 'react-router-dom'

import { DataTableAsync } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { getAccessScansRequest, type AccessScan } from '@/features/devices/access-api'
import { getLocationFilterOptionsRequest } from '@/features/locations/api'
import { getUserFilterOptionsRequest } from '@/features/users/api'
import { getCustomersListRequest } from '@/features/customers/api'
import { getAppMode } from '@/features/app/app-mode'
import { formatDateTime } from '@/utils/date-utils'

const columns: ColumnDef<AccessScan>[] = [
  { accessorKey: 'createdAt', header: 'Scanned', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  { accessorKey: 'allowed', header: 'Result', cell: ({ row }) => <Badge variant={row.original.allowed ? 'default' : 'destructive'}>{row.original.allowed ? 'Allowed' : 'Denied'}</Badge> },
  { accessorKey: 'reason', header: 'Reason' },
  { accessorKey: 'deviceId', header: 'Device', cell: ({ row }) => row.original.deviceName || row.original.deviceId },
  { accessorKey: 'organizationName', header: 'Location', cell: ({ row }) => row.original.organizationName || '—' },
  { accessorKey: 'userName', header: 'User', cell: ({ row }) => row.original.userId
    ? <Link className="underline-offset-2 hover:underline" to={`/users/${row.original.userId}`}>{row.original.userName || row.original.userId}</Link>
    : '—' },
]

export default function AccessScansPage() {
  const [params] = useSearchParams()
  const filteredUserId = params.get('f.userId') || ''
  const isAdmin = getAppMode() === 'admin'

  return <>
    <PageHeader title="Access scan logs" />
    <section className="space-y-4 p-4 md:p-6">
      {filteredUserId ? <p className="text-sm text-muted-foreground">Showing scans for <Link className="underline" to={`/users/${filteredUserId}`}>{filteredUserId}</Link> · <Link className="underline" to="/access/scans">Clear user filter</Link></p> : null}
      <DataTableAsync<AccessScan>
        queryKey={['access-scans', filteredUserId]}
        loadData={(state) => getAccessScansRequest(state)}
        tableKey="access.scans"
        columns={columns}
        searchPlaceholder="Search by device or reason"
        searchColumns={['deviceId', 'reason']}
        filters={[
          { id: 'allowed', label: 'Result', column: 'allowed', selectionMode: 'single', options: ['true', 'false'], getValue: (scan) => String(scan.allowed) },
          { id: 'locationId', label: 'Location', column: 'organizationId', selectionMode: 'single', queryFn: getLocationFilterOptionsRequest },
          { id: 'userId', label: 'User', column: 'userId', selectionMode: 'single', queryFn: getUserFilterOptionsRequest },
          ...(isAdmin ? [{ id: 'customerId', label: 'Customer', column: 'organizationName' as const,
            selectionMode: 'single' as const, queryFn: async (search: string) => {
              const customers = await getCustomersListRequest(undefined, search)
              return { items: customers.map((customer) => ({ id: customer.id, label: customer.name })), total: customers.length }
            } }] : []),
        ]}
        showPagination
        loadingMessage="Loading scans…"
        emptyMessage="No scans found."
        errorMessage="Could not load scan logs."
      />
    </section>
  </>
}
