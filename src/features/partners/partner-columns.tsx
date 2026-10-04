import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { NO_VALUE_STR } from '@/constants'
import type { MaintenancePartner } from '@/types/partner'

export const partnerColumns: ColumnDef<MaintenancePartner>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link to={`/partners/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'users',
    header: 'Users',
    cell: ({ row }) => row.original.users ?? NO_VALUE_STR,
  },
]
