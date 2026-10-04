import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { NO_VALUE_STR } from '@/constants'
import { OrganizationStatusBadge } from '@/features/organizations/OrganizationStatusBadge'
import type { Store, StoreDeviceHistory } from '@/types/store'
import { StringUtils, TimezoneUtils } from '@/utils'
import * as GeoUtils from '@/utils/geo-utils'
import { formatDateTime } from '@/utils/date-utils'
import { Badge } from '@/components/ui/badge'

export const storeColumns: ColumnDef<Store>[] = [
  {
    accessorKey: 'orgStatus',
    header: 'Status',
    cell: ({ row }) => (
      <OrganizationStatusBadge
        status={row.original.orgStatus}
        isDeleted={row.original.isDeleted}
        isArchived={row.original.isArchived}
      />
    ),
  },
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
    accessorKey: 'customer',
    header: 'Customer',
    cell: ({ row }) => row.original.customer?.name || NO_VALUE_STR,
    sortingFn: (a, b) => StringUtils.safeLocaleCompare(a.original.customer?.name, b.original.customer?.name),
  },
  {
    accessorKey: 'retailer',
    header: 'Retailer',
    cell: ({ row }) => row.original.retailer ?? NO_VALUE_STR,
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) => (row.original.address ? StringUtils.displayAddress(row.original.address) : NO_VALUE_STR),
  },
  {
    id: 'city',
    header: 'City',
    accessorFn: (store) => store.address?.city,
    cell: ({ row }) => row.original.address?.city ?? NO_VALUE_STR,
  },
  {
    id: 'region',
    header: 'Region',
    accessorFn: (store) => store.address?.stateId,
    cell: ({ row }) => row.original.address?.stateId ?? NO_VALUE_STR,
  },
  {
    id: 'country',
    header: 'Country',
    accessorFn: (store) => store.address?.countryId,
    cell: ({ row }) => GeoUtils.getCountryName(row.original.address?.countryId) ?? NO_VALUE_STR,
  },
  {
    accessorKey: 'timezone',
    header: 'Timezone',
    cell: ({ row }) => TimezoneUtils.getTimezoneLabel(row.original.timezone) || NO_VALUE_STR,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created at',
    cell: ({ row }) => formatDateTime(row.original.createdAt, NO_VALUE_STR),
  },
]

const deviceStoreStatusClassName: Record<StoreDeviceHistory['status'], string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  INACTIVE: 'bg-muted text-muted-foreground border-border',
}

export const storeDeviceHistoryColumns: ColumnDef<StoreDeviceHistory>[] = [
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant="outline" className={deviceStoreStatusClassName[row.original.status]}>
        {row.original.status === 'ACTIVE' ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    accessorKey: 'store',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.original.store.name || NO_VALUE_STR}</span>,
    enableSorting: false,
  },
  {
    accessorKey: 'assignedAt',
    header: 'Assigned',
    cell: ({ row }) => formatDateTime(row.original.assignedAt, NO_VALUE_STR),
  },
  {
    accessorKey: 'unassignedAt',
    header: 'Unassigned',
    cell: ({ row }) => formatDateTime(row.original.unassignedAt ?? undefined, NO_VALUE_STR),
  },
]
