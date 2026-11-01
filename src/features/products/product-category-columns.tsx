import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import type { ProductCategory } from '@/types/product'

export function getProductCategoryColumns({ showCustomer = true }: { showCustomer?: boolean } = {}): ColumnDef<ProductCategory>[] {
  return [
    {
      accessorKey: 'sortOrder',
      header: 'Position',
      cell: ({ row }) => Number(row.original.sortOrder ?? 0) + 1,
      enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: 'Category',
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#e7d8c4] text-xl">
            {row.original.imageUrl ? <img src={row.original.imageUrl} alt="" className="size-full object-cover" /> : <span aria-hidden="true">✨</span>}
          </div>
          <span className="truncate font-medium">{row.original.name}</span>
        </div>
      ),
    },
    ...(showCustomer ? [{
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => row.original.customerId && row.original.customerName
        ? <Link to={`/customers/${row.original.customerId}`} className="underline-offset-2 hover:underline">{row.original.customerName}</Link>
        : NO_VALUE_STR,
      enableSorting: false,
    } satisfies ColumnDef<ProductCategory>] : []),
    {
      accessorKey: 'locations',
      header: 'Locations',
      cell: ({ row }) => row.original.allLocations
        ? <Badge variant="outline">All locations</Badge>
        : row.original.locations?.length
          ? <div className="flex flex-wrap gap-x-2 gap-y-1">{row.original.locations.map((location) => <Link key={location.id} to={`/locations/${location.id}`} className="underline-offset-2 hover:underline">{location.name}</Link>)}</div>
          : NO_VALUE_STR,
      enableGlobalFilter: false,
      enableSorting: false,
    },
    {
      accessorKey: 'vatRate',
      header: 'VAT',
      cell: ({ row }) => `${Number(row.original.vatRate) * 100}%`,
    },
    {
      accessorKey: 'productCount',
      header: 'Products',
      cell: ({ row }) => row.original.productCount ?? 0,
      enableSorting: false,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => <Badge variant="outline" className={row.original.isActive ? 'border-green-200 text-green-800' : 'text-muted-foreground'}>{row.original.isActive ? 'Active' : 'Disabled'}</Badge>,
    },
  ]
}
