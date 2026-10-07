import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { NO_VALUE_STR } from '@/constants'
import { OrganizationStatusBadge } from '@/features/organizations/OrganizationStatusBadge'
import type { Location } from '@/types/location'
import { formatPhoneNumber } from '@/lib/phone'
import { StringUtils, TimezoneUtils } from '@/utils'
import * as GeoUtils from '@/utils/geo-utils'
import { formatDateTime } from '@/utils/date-utils'

export const locationColumns: ColumnDef<Location>[] = [
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <OrganizationStatusBadge
        status={row.original.status}
        isDeleted={row.original.isDeleted}
        isArchived={row.original.isArchived}
      />
    ),
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link to={`/locations/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'parentId',
    header: 'Customer',
    cell: ({ row }) => row.original.customerName && row.original.parentId
      ? <Link to={`/customers/${row.original.parentId}`} className="underline-offset-2 hover:underline">{row.original.customerName}</Link>
      : row.original.customerName ?? NO_VALUE_STR,
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) => (row.original.address ? StringUtils.displayAddress(row.original.address) : NO_VALUE_STR),
  },
  {
    id: 'city',
    header: 'City',
    accessorFn: (location) => location.address?.city,
    cell: ({ row }) => row.original.address?.city ?? NO_VALUE_STR,
  },
  {
    id: 'country',
    header: 'Country',
    accessorFn: (location) => location.address?.countryId,
    cell: ({ row }) => GeoUtils.getCountryName(row.original.address?.countryId) ?? NO_VALUE_STR,
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => row.original.email ?? NO_VALUE_STR,
  },
  {
    accessorKey: 'phone',
    header: 'Phone',
    cell: ({ row }) => formatPhoneNumber(row.original.phone) || NO_VALUE_STR,
  },
  {
    accessorKey: 'timezone',
    header: 'Timezone',
    cell: ({ row }) => TimezoneUtils.getTimezoneLabel(row.original.timezone) || NO_VALUE_STR,
  },
  {
    accessorKey: 'currency',
    header: 'Currency',
    cell: ({ row }) => row.original.currency ?? NO_VALUE_STR,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created at',
    cell: ({ row }) => formatDateTime(row.original.createdAt, NO_VALUE_STR),
  },
]
