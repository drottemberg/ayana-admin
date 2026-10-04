import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { NO_VALUE_STR } from '@/constants'
import { OrganizationStatusBadge } from '@/features/organizations/OrganizationStatusBadge'
import type { Customer } from '@/types/customer'
import { formatDateTime } from '@/utils/date-utils'

export const customerColumns: ColumnDef<Customer>[] = [
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
      <Link to={`/customers/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'contactName',
    header: 'Contact name',
    cell: ({ row }) => row.original.contactName ?? NO_VALUE_STR,
  },
  {
    accessorKey: 'contactEmail',
    header: 'Contact email',
    cell: ({ row }) => row.original.contactEmail ?? NO_VALUE_STR,
  },
  {
    accessorKey: 'contactPhone',
    header: 'Contact phone',
    cell: ({ row }) => row.original.contactPhone ?? NO_VALUE_STR,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created at',
    cell: ({ row }) => formatDateTime(row.original.createdAt, NO_VALUE_STR),
  },
]
