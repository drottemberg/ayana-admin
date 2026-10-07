import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import type { ClientContract } from '@/types/client-contract'
import { DateUtils } from '@/utils'

const statusStyles: Record<ClientContract['status'], string> = {
  ACTIVE: 'border-green-200 text-green-800',
  PENDING: 'border-amber-200 text-amber-800',
  PAUSED: 'border-blue-200 text-blue-800',
  EXPIRED: '',
  CANCELLED: '',
}

export function getClientContractColumns(options: { showCustomer?: boolean; showLocation?: boolean; showUser?: boolean } = {}): ColumnDef<ClientContract>[] {
  return [
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant="outline" className={statusStyles[row.original.status]}>{row.original.status}</Badge>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created at',
      cell: ({ row }) => DateUtils.formatDateTime(row.original.createdAt, NO_VALUE_STR),
    },
    {
      id: 'pricingOptionName',
      header: 'Pricing option',
      cell: ({ row }) => <span className="font-medium">{row.original.pricingOption?.name ?? NO_VALUE_STR}</span>,
    },
    ...(options.showUser === false ? [] : [{
      id: 'userName',
      header: 'User',
      cell: ({ row }) => row.original.user
        ? <Link to={`/users/${row.original.user.id}`} className="underline-offset-2 hover:underline">
            {[row.original.user.firstName, row.original.user.lastName].filter(Boolean).join(' ') || row.original.user.email || row.original.user.id}
          </Link>
        : NO_VALUE_STR,
    } as ColumnDef<ClientContract>]),
    ...(options.showLocation === false ? [] : [{
      id: 'locationName',
      header: 'Location',
      cell: ({ row }) => <Link to={`/locations/${row.original.location.id}`} className="underline-offset-2 hover:underline">{row.original.location.name}</Link>,
    } as ColumnDef<ClientContract>]),
    ...(options.showCustomer === false ? [] : [{
      id: 'customerName',
      header: 'Customer',
      cell: ({ row }) => <Link to={`/customers/${row.original.customer.id}`} className="underline-offset-2 hover:underline">{row.original.customer.name}</Link>,
    } as ColumnDef<ClientContract>]),
    {
      accessorKey: 'creditsRemaining',
      header: 'Credits remaining',
      cell: ({ row }) => row.original.creditsRemaining === null ? 'Unlimited' : row.original.creditsRemaining,
    },
    {
      accessorKey: 'validUntil',
      header: 'Valid until',
      cell: ({ row }) => row.original.validUntil ? new Date(row.original.validUntil).toLocaleDateString() : NO_VALUE_STR,
    },
    { accessorKey: 'id', header: 'ID', cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
  ]
}
