import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import type { Booking } from '@/types/booking'

export function getBookingColumns(options: { showUser?: boolean; showCustomer?: boolean; showLocation?: boolean } = {}): ColumnDef<Booking>[] {
  return [
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant="outline">{row.original.status.replaceAll('_', ' ')}</Badge> },
    { accessorKey: 'source', header: 'Source', cell: ({ row }) => <Badge variant="outline">{row.original.source === 'CLASSPASS' ? 'ClassPass' : row.original.source === 'EGYM' ? 'EGYM Wellpass' : 'Direct'}</Badge> },
    { accessorKey: 'isFreeTrial', header: 'Trial', cell: ({ row }) => row.original.isFreeTrial ? <Badge variant="outline">Free trial</Badge> : '—' },
    {
      id: 'booking', header: 'Booking',
      cell: ({ row }) => <Link to={`/bookings/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">{row.original.id}</Link>,
    },
    ...(options.showUser === false ? [] : [{
      id: 'member', header: 'Member',
      cell: ({ row }) => {
        const user = row.original.user
        return <div className="flex min-w-0 items-center gap-2">
          <Link to={`/users/${user.id}`} className="min-w-0 truncate font-medium underline-offset-2 hover:underline">
            {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.id}
          </Link>
          <Badge
            variant="outline"
            className="shrink-0"
            title={`Class visit number ${(row.original.classVisitCount ?? 0) + 1}`}
            aria-label={`Class visit number ${(row.original.classVisitCount ?? 0) + 1}`}
          >
            {(row.original.classVisitCount ?? 0) + 1}
          </Badge>
        </div>
      },
    } as ColumnDef<Booking>]),
    {
      id: 'className', header: 'Class session',
      cell: ({ row }) => <Link
        to={`/class-sessions/${row.original.sessionId}?locationId=${encodeURIComponent(row.original.location.id)}`}
        className="underline-offset-2 hover:underline"
      >
        <span className="block font-medium">{row.original.className || row.original.sessionId}</span>
        {row.original.startsAt ? <span className="text-xs text-muted-foreground">{new Date(row.original.startsAt).toLocaleString()}</span> : null}
      </Link>,
    },
    {
      id: 'creditsUsed', header: 'Credits used',
      cell: ({ row }) => <span>{Number(row.original.creditsUsed ?? 0)}{row.original.creditContractNames ? <span className="block text-xs text-muted-foreground">{row.original.creditContractNames}</span> : null}</span>,
    },
    ...(options.showLocation === false ? [] : [{
      id: 'locationName', header: 'Location',
      cell: ({ row }) => <Link to={`/locations/${row.original.location.id}`} className="underline-offset-2 hover:underline">{row.original.location.name}</Link>,
    } as ColumnDef<Booking>]),
    ...(options.showCustomer === false ? [] : [{
      id: 'customerName', header: 'Customer',
      cell: ({ row }) => <Link to={`/customers/${row.original.customer.id}`} className="underline-offset-2 hover:underline">{row.original.customer.name}</Link>,
    } as ColumnDef<Booking>]),
    { accessorKey: 'createdAt', header: 'Booked', cell: ({ row }) => new Date(row.original.createdAt).toLocaleString() },
  ]
}
