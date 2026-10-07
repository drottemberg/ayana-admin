import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import type { ClassType } from '@/types/class-type'

const typeLabels: Record<ClassType['type'], string> = {
  GROUP: 'Group',
  SEMI_PRIVATE: 'Semi-private',
  PRIVATE: 'Private',
}

export function getClassTypeColumns(options: { showCustomer?: boolean; showLocation?: boolean } = {}): ColumnDef<ClassType>[] {
  return [
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className={row.original.isActive ? 'border-green-200 text-green-800' : ''}>
          {row.original.isActive ? 'Active' : 'Disabled'}
        </Badge>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => row.original.locationId
        ? <Link to={`/classes/${row.original.id}?locationId=${encodeURIComponent(row.original.locationId)}`} className="font-medium underline-offset-2 hover:underline">{row.original.name}</Link>
        : <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => row.original.category || NO_VALUE_STR,
    },
    {
      accessorKey: 'type',
      header: 'Format',
      cell: ({ row }) => typeLabels[row.original.type] ?? row.original.type,
    },
    { accessorKey: 'duration', header: 'Duration', cell: ({ row }) => `${row.original.duration} min` },
    { accessorKey: 'maxCapacity', header: 'Capacity' },
    { accessorKey: 'creditCost', header: 'Credits', cell: ({ row }) => Number(row.original.creditCost) },
    ...(options.showLocation ? [{
      accessorKey: 'locationName',
      header: 'Location',
      cell: ({ row }) => row.original.locationName && row.original.locationId
        ? <Link to={`/locations/${row.original.locationId}`} className="underline-offset-2 hover:underline">{row.original.locationName}</Link>
        : row.original.locationName ?? NO_VALUE_STR,
    } as ColumnDef<ClassType>] : []),
    ...(options.showCustomer ? [{
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => row.original.customerName && row.original.customerId
        ? <Link to={`/customers/${row.original.customerId}`} className="underline-offset-2 hover:underline">{row.original.customerName}</Link>
        : row.original.customerName ?? NO_VALUE_STR,
    } as ColumnDef<ClassType>] : []),
  ]
}
