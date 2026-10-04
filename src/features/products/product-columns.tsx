import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import {
  ProductStatus,
  type Product,
  type ProductDeviceHistory,
  type ProductStatus as ProductStatusType,
} from '@/types/product'
import { formatDateTime } from '@/utils/date-utils'

const statusBadgeClassName: Record<ProductStatusType, string> = {
  [ProductStatus.ACTIVE]: 'bg-green-100 text-green-800 border-green-200',
  [ProductStatus.DISABLED]: 'bg-orange-100 text-orange-800 border-orange-200',
  [ProductStatus.ARCHIVED]: 'bg-muted text-muted-foreground border-border',
  [ProductStatus.DELETED]: 'bg-red-100 text-red-800 border-red-200',
}

const statusLabel: Record<ProductStatusType, string> = {
  [ProductStatus.ACTIVE]: 'Active',
  [ProductStatus.DISABLED]: 'Disabled',
  [ProductStatus.ARCHIVED]: 'Archived',
  [ProductStatus.DELETED]: 'Deleted',
}

export function renderProductStatusBadge(product: Pick<Product, 'status'>) {
  const status = product.status ?? ProductStatus.ACTIVE

  return (
    <Badge variant="outline" className={statusBadgeClassName[status]}>
      {statusLabel[status]}
    </Badge>
  )
}

export function getProductColumns({ showCustomer = true }: { showCustomer?: boolean } = {}): ColumnDef<Product>[] {
  return [
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => renderProductStatusBadge(row.original),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link to={`/products/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    ...(showCustomer
      ? [
          {
            accessorKey: 'customer',
            header: 'Customer',
            cell: ({ row }) => row.original.customer.name || NO_VALUE_STR,
            enableSorting: false,
          } satisfies ColumnDef<Product>,
        ]
      : []),
    {
      accessorKey: 'brand',
      header: 'Brand',
      cell: ({ row }) => row.original.brand?.name || NO_VALUE_STR,
      enableSorting: false,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created at',
      cell: ({ row }) => formatDateTime(row.original.createdAt, NO_VALUE_STR),
    },
  ]
}

export const productColumns: ColumnDef<Product>[] = getProductColumns()

const deviceProductStatusClassName: Record<ProductDeviceHistory['status'], string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  INACTIVE: 'bg-muted text-muted-foreground border-border',
}

export const productDeviceHistoryColumns: ColumnDef<ProductDeviceHistory>[] = [
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant="outline" className={deviceProductStatusClassName[row.original.status]}>
        {row.original.status === 'ACTIVE' ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    accessorKey: 'product',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.original.product.name}</span>,
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
