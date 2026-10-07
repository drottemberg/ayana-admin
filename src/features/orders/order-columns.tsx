import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import type { Order } from '@/types/order'

const statusTone: Partial<Record<Order['status'], string>> = {
  RECEIVED: 'border-blue-200 text-blue-800',
  PREPARING: 'border-amber-200 text-amber-800',
  READY: 'border-green-200 text-green-800',
  PICKED_UP: 'border-green-200 text-green-800',
  DELIVERED: 'border-green-200 text-green-800',
}

export function getOrderColumns(options: { showCustomer?: boolean; showLocation?: boolean; showUser?: boolean } = {}): ColumnDef<Order>[] {
  return [
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant="outline" className={statusTone[row.original.status]}>{row.original.status}</Badge> },
    { accessorKey: 'paymentStatus', header: 'Payment', cell: ({ row }) => <Badge variant="outline">{row.original.paymentStatus}</Badge> },
    {
      accessorKey: 'shortCode',
      header: 'Order',
      cell: ({ row }) => <Link to={`/orders/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">{row.original.shortCode ?? row.original.id}</Link>,
    },
    { accessorKey: 'type', header: 'Type' },
    {
      accessorKey: 'total',
      header: 'Total incl. VAT',
      cell: ({ row }) => {
        const currency = row.original.currency || 'EUR'
        const format = (value: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
        return <span className="grid"><span>{format(row.original.total)}</span><span className="text-xs text-muted-foreground">VAT {format(row.original.totalVat)}</span></span>
      },
    },
    ...(options.showUser === false ? [] : [{
      id: 'userName', header: 'User',
      cell: ({ row }) => row.original.user
        ? <Link to={`/users/${row.original.user.id}`} className="underline-offset-2 hover:underline">
            {[row.original.user.firstName, row.original.user.lastName].filter(Boolean).join(' ') || row.original.user.email || row.original.user.id}
          </Link>
        : NO_VALUE_STR,
    } as ColumnDef<Order>]),
    ...(options.showLocation === false ? [] : [{
      id: 'locationName', header: 'Location',
      cell: ({ row }) => <Link to={`/locations/${row.original.location.id}`} className="underline-offset-2 hover:underline">{row.original.location.name}</Link>,
    } as ColumnDef<Order>]),
    ...(options.showCustomer === false ? [] : [{
      id: 'customerName', header: 'Customer',
      cell: ({ row }) => <Link to={`/customers/${row.original.customer.id}`} className="underline-offset-2 hover:underline">{row.original.customer.name}</Link>,
    } as ColumnDef<Order>]),
    { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => new Date(row.original.createdAt).toLocaleString() },
  ]
}
