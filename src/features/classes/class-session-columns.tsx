import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import type { ClassBooking, ClassSchedule, ClassSession } from '@/types/class-type'
import { formatClassSessionTime } from '@/features/classes/time-zone'

const sessionTypeLabels = { GROUP: 'Group', SEMI_PRIVATE: 'Semi-private', PRIVATE: 'Private' } as const

export function getClassSessionColumns(options: { showCustomer?: boolean; showLocation?: boolean } = {}): ColumnDef<ClassSession>[] {
  return [
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge> },
    {
      accessorKey: 'className',
      header: 'Class',
      cell: ({ row }) => <Link className="font-medium underline-offset-2 hover:underline" to={`/class-sessions/${row.original.id}?locationId=${encodeURIComponent(row.original.locationId ?? row.original.organizationId)}`}>{row.original.className || row.original.classTypeId}</Link>,
    },
    { accessorKey: 'classCategory', header: 'Category', cell: ({ row }) => row.original.classCategory || NO_VALUE_STR },
    { accessorKey: 'type', header: 'Format', cell: ({ row }) => sessionTypeLabels[row.original.type] ?? row.original.type },
    {
      accessorKey: 'startTime', header: 'Starts',
      cell: ({ row }) => formatClassSessionTime(row.original.startTime, row.original.timezone),
    },
    {
      id: 'capacity', header: 'Bookings',
      cell: ({ row }) => `${row.original.bookedCount} / ${row.original.capacity}`,
    },
    { accessorKey: 'coachName', header: 'Coach', cell: ({ row }) => row.original.coachName || NO_VALUE_STR },
    ...(options.showLocation ? [{
      accessorKey: 'locationName', header: 'Location',
      cell: ({ row }) => row.original.locationName && row.original.locationId
        ? <Link to={`/locations/${row.original.locationId}`} className="underline-offset-2 hover:underline">{row.original.locationName}</Link>
        : row.original.locationName || NO_VALUE_STR,
    } as ColumnDef<ClassSession>] : []),
    ...(options.showCustomer ? [{
      accessorKey: 'customerName', header: 'Customer',
      cell: ({ row }) => row.original.customerName && row.original.customerId
        ? <Link to={`/customers/${row.original.customerId}`} className="underline-offset-2 hover:underline">{row.original.customerName}</Link>
        : row.original.customerName || NO_VALUE_STR,
    } as ColumnDef<ClassSession>] : []),
  ]
}

export const classScheduleColumns: ColumnDef<ClassSchedule>[] = [
  { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => {
    const schedule = row.original
    const pauseFrom = schedule.pauseFrom ? new Date(schedule.pauseFrom).toISOString().slice(0, 10) : null
    const pauseUntil = schedule.pauseUntil ? new Date(schedule.pauseUntil).toISOString().slice(0, 10) : null
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const label = !schedule.isActive ? 'Disabled'
      : pauseFrom && pauseFrom <= today && (!pauseUntil || pauseUntil >= today)
        ? pauseUntil ? `Paused until ${new Date(`${pauseUntil}T12:00:00`).toLocaleDateString()}` : 'Paused'
        : pauseFrom && pauseFrom > today
          ? pauseUntil
            ? `Pauses ${new Date(`${pauseFrom}T12:00:00`).toLocaleDateString()} – ${new Date(`${pauseUntil}T12:00:00`).toLocaleDateString()}`
            : `Pauses from ${new Date(`${pauseFrom}T12:00:00`).toLocaleDateString()}`
          : 'Active'
    return <Badge variant="outline">{label}</Badge>
  } },
  { accessorKey: 'autoGenerateSessions', header: 'Availability', cell: ({ row }) => <Badge variant="outline">{row.original.autoGenerateSessions === false ? 'Manual only' : 'Auto generation on'}</Badge> },
  { accessorKey: 'dayOfWeek', header: 'Day', cell: ({ row }) => row.original.dayOfWeek ?? NO_VALUE_STR },
  { id: 'time', header: 'Time', cell: ({ row }) => `${String(row.original.startHour).padStart(2, '0')}:${String(row.original.startMinute).padStart(2, '0')}` },
  { accessorKey: 'coachName', header: 'Default coach', cell: ({ row }) => row.original.coachName || NO_VALUE_STR },
  { accessorKey: 'capacity', header: 'Capacity', cell: ({ row }) => row.original.capacity ?? NO_VALUE_STR },
  { accessorKey: 'validFrom', header: 'Valid from', cell: ({ row }) => new Date(row.original.validFrom).toLocaleDateString() },
  { accessorKey: 'validUntil', header: 'Until', cell: ({ row }) => row.original.validUntil ? new Date(row.original.validUntil).toLocaleDateString() : 'No end date' },
]

export const classBookingColumns: ColumnDef<ClassBooking>[] = [
  {
    id: 'booking', header: 'Booking',
    cell: ({ row }) => <Link to={`/bookings/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">{row.original.id}</Link>,
  },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge> },
  {
    id: 'member', header: 'Member',
    cell: ({ row }) => {
      const name = [row.original.firstName, row.original.lastName].filter(Boolean).join(' ')
      return <Link to={`/users/${row.original.userId}`} className="font-medium underline-offset-2 hover:underline">{name || row.original.email || row.original.userId}</Link>
    },
  },
  { accessorKey: 'email', header: 'Email', cell: ({ row }) => row.original.email || NO_VALUE_STR },
  { accessorKey: 'phone', header: 'Phone', cell: ({ row }) => row.original.phone || NO_VALUE_STR },
  { accessorKey: 'createdAt', header: 'Booked', cell: ({ row }) => new Date(row.original.createdAt).toLocaleString() },
]
