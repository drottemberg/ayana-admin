import type { ColumnDef } from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import type { ProductLocationSettings } from './location-products'

export function getLocationProductColumns(currency = 'EUR'): ColumnDef<ProductLocationSettings>[] {
  return [
    {
      id: 'status',
      header: 'Availability',
      cell: ({ row }) => {
        const available = row.original.isAvailable && row.original.isSellable
        return <Badge variant="outline" className={available ? 'border-green-200 text-green-800' : ''}>{available ? 'Available' : 'Unavailable'}</Badge>
      },
    },
    { accessorKey: 'name', header: 'Product', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    {
      id: 'variants',
      header: 'Variants · price · stock',
      cell: ({ row }) => row.original.variants.length
        ? <span>{row.original.variants.map((variant) => `${variant.sku || variant.id.slice(-5)} · ${new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(variant.price)} · ${variant.stock === -1 ? '∞' : variant.stock}`).join(' / ')}</span>
        : NO_VALUE_STR,
    },
  ]
}
