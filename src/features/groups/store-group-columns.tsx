import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import type { StoreGroup } from '@/types/group'
import { formatDateTime } from '@/utils/date-utils'
import { NO_VALUE_STR } from '@/constants'

export const storeGroupColumns: ColumnDef<StoreGroup>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link to={`/store-groups/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'storeCount',
    header: 'Store count',
    cell: ({ row }) => row.original.storeCount ?? 0,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created at',
    cell: ({ row }) => formatDateTime(row.original.createdAt, NO_VALUE_STR),
  },
]
