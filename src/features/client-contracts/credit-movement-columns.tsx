import type { ColumnDef } from '@tanstack/react-table'

import { NO_VALUE_STR } from '@/constants'
import { Link } from 'react-router-dom'
import type { ClientContractCreditMovement } from '@/types/client-contract'
import { DateUtils } from '@/utils'

const activityLabels: Record<ClientContractCreditMovement['type'], string> = {
  OPENING_BALANCE: 'Opening balance',
  PURCHASE_GRANT: 'Purchased credits',
  PERIOD_GRANT: 'Periodic allowance',
  PERIOD_EXPIRY: 'Expired credits',
  BOOKING_CONSUMPTION: 'Booking consumption',
  BOOKING_REFUND: 'Booking credit return',
  MANUAL_GRANT: 'Manual credit gift',
  MANUAL_DEDUCTION: 'Manual credit removal',
  CREDIT_EXPIRY: 'Expired credits',
}

export function getCreditMovementColumns(options: { showUser?: boolean; showCustomer?: boolean } = {}): ColumnDef<ClientContractCreditMovement>[] {
  return [
    {
      accessorKey: 'createdAt',
      header: 'Date',
      enableSorting: false,
      cell: ({ row }) => DateUtils.formatDateTime(row.original.createdAt, NO_VALUE_STR),
    },
    {
      accessorKey: 'type',
      header: 'Activity',
      enableSorting: false,
      cell: ({ row }) => activityLabels[row.original.type] ?? row.original.type,
    },
    ...(options.showUser === false ? [] : [{
      id: 'user',
      header: 'User',
      enableSorting: false,
      cell: ({ row }) => row.original.user ? (
        <Link to={`/users/${row.original.user.id}`} className="underline-offset-2 hover:underline">
          {[row.original.user.firstName, row.original.user.lastName].filter(Boolean).join(' ') || row.original.user.email || row.original.user.id}
        </Link>
      ) : NO_VALUE_STR,
    } as ColumnDef<ClientContractCreditMovement>]),
    {
      accessorKey: 'contractName',
      header: 'Client contract',
      enableSorting: false,
      cell: ({ row }) => row.original.contractName ?? 'Complimentary credits',
    },
    {
      accessorKey: 'locationName',
      header: 'Location',
      enableSorting: false,
      cell: ({ row }) => row.original.organizationId && row.original.locationName
        ? <Link to={`/locations/${row.original.organizationId}`} className="underline-offset-2 hover:underline">{row.original.locationName}</Link>
        : NO_VALUE_STR,
    },
    {
      id: 'creditScope',
      header: 'Availability',
      enableSorting: false,
      cell: ({ row }) => row.original.creditScope === 'SPECIFIC'
        ? row.original.creditLocations?.map((location) => location.name).join(', ') || `${row.original.creditLocationIds?.length ?? 0} selected location(s)`
        : 'All customer locations',
    },
    {
      accessorKey: 'expiresAt',
      header: 'Expires',
      enableSorting: false,
      cell: ({ row }) => row.original.expiresAt ? DateUtils.formatDateTime(row.original.expiresAt) : 'Never',
    },
    ...(options.showCustomer === false ? [] : [{
      id: 'customer',
      header: 'Customer',
      enableSorting: false,
      cell: ({ row }) => row.original.customer
        ? <Link to={`/customers/${row.original.customer.id}`} className="underline-offset-2 hover:underline">{row.original.customer.name}</Link>
        : NO_VALUE_STR,
    } as ColumnDef<ClientContractCreditMovement>]),
    {
      id: 'details',
      header: 'Details',
      enableSorting: false,
      cell: ({ row }) => {
        const movement = row.original
        const booking = movement.bookingInfo
        return (
          <div className="min-w-36 text-sm">
            <div>{booking?.className ?? movement.reason ?? (movement.bookingId ? `Booking ${movement.bookingId}` : NO_VALUE_STR)}</div>
            {movement.reason && booking?.className ? <div className="text-xs text-muted-foreground">{movement.reason}</div> : null}
            {booking?.startTime ? <div className="text-xs text-muted-foreground">{DateUtils.formatDateTime(booking.startTime)}</div> : null}
          </div>
        )
      },
    },
    {
      accessorKey: 'amount',
      header: 'Change',
      enableSorting: false,
      cell: ({ row }) => {
        const amount = row.original.amount
        return (
          <span className={`font-medium ${amount < 0 ? 'text-destructive' : 'text-green-700'}`}>
            {amount > 0 ? '+' : ''}{amount}
          </span>
        )
      },
    },
    {
      accessorKey: 'balanceAfter',
      header: 'Balance',
      enableSorting: false,
      cell: ({ row }) => row.original.balanceAfter ?? 'Unlimited',
    },
  ]
}
