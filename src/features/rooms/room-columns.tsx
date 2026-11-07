import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import type { Room } from './api'

export const roomColumns: ColumnDef<Room>[] = [
  {
    accessorKey: 'name',
    header: 'Room',
    cell: ({ row }) => <span className="font-medium">{row.original.name || NO_VALUE_STR}</span>,
  },
  {
    accessorKey: 'isDefault',
    header: 'Default',
    cell: ({ row }) => row.original.isDefault ? <Badge variant="secondary">Default</Badge> : NO_VALUE_STR,
  },
  {
    accessorKey: 'isEnabled',
    header: 'Status',
    cell: ({ row }) => <Badge variant={row.original.isEnabled ? 'outline' : 'secondary'}>{row.original.isEnabled ? 'Enabled' : 'Disabled'}</Badge>,
  },
]
