import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import type { BroadcastHistoryItem } from '@/features/customer-messaging/api'

export function getCampaignColumns(onOpen: (campaignId: string) => void): ColumnDef<BroadcastHistoryItem>[] {
  return [
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <CampaignStatus status={row.original.status} />,
    },
    {
      accessorKey: 'message',
      header: 'Campaign',
      cell: ({ row }) => (
        <div className="grid min-w-40 gap-0.5">
          <button type="button" className="w-fit max-w-full truncate text-left font-medium underline-offset-2 hover:underline" onClick={() => onOpen(row.original.id)}>
            {row.original.message || 'Image campaign'}
          </button>
          <span className="text-xs text-muted-foreground">{row.original.id}</span>
        </div>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => row.original.customerName
        ? <Link to={`/customers/${row.original.customerId}`} className="underline-offset-2 hover:underline">{row.original.customerName}</Link>
        : row.original.customerId,
    },
    {
      id: 'audience',
      header: 'Audience',
      enableSorting: false,
      cell: ({ row }) => {
        const filters = row.original.filters
        const activity = filters?.activity ?? 'ALL'
        const locationCount = filters?.locationIds?.length ?? 0
        return <span className="text-sm text-muted-foreground">{locationCount ? `${locationCount} location${locationCount === 1 ? '' : 's'}` : 'All locations'} · {activityLabel(activity)}</span>
      },
    },
    {
      accessorKey: 'total',
      header: 'Recipients',
      cell: ({ row }) => <span>{row.original.total}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
  ]
}

function CampaignStatus({ status }: { status: BroadcastHistoryItem['status'] }) {
  const variant = status === 'FAILED' ? 'destructive' : status === 'SENDING' ? 'outline' : status === 'PARTIAL' ? 'secondary' : 'default'
  return <Badge variant={variant}>{({ SENDING: 'Sending', SENT: 'Sent', PARTIAL: 'Partial', FAILED: 'Failed' } as const)[status]}</Badge>
}

function activityLabel(activity: string) {
  return ({ ALL: 'Everyone', CLASS_BOOKING: 'Class bookings', PRODUCT_PURCHASE: 'Product purchases', BOTH: 'Classes and products' } as Record<string, string>)[activity] ?? activity
}
