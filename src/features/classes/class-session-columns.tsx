import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon'
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon'
import { HugeiconsIcon } from '@hugeicons/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NO_VALUE_STR } from '@/constants'
import type { ClassBooking, ClassSchedule, ClassSession } from '@/types/class-type'
import { formatClassSessionTime } from '@/features/classes/time-zone'
import { cn } from '@/lib/utils'

const sessionTypeLabels = { GROUP: 'Group', SEMI_PRIVATE: 'Semi-private', PRIVATE: 'Private' } as const

export function getClassSessionColumns(options: {
  showCustomer?: boolean
  showLocation?: boolean
  allowClaim?: boolean
  claimingSessionId?: string | null
  onClaim?: (session: ClassSession) => void
} = {}): ColumnDef<ClassSession>[] {
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
    {
      accessorKey: 'coachName',
      header: 'Coach',
      cell: ({ row }) => {
        const session = row.original
        const canClaim = options.allowClaim
          && !session.coachId
          && session.status === 'SCHEDULED'
          && new Date(session.startTime).getTime() >= Date.now()
          && options.onClaim
        if (canClaim) {
          return <Button type="button" size="sm" variant="outline" disabled={options.claimingSessionId === session.id} onClick={(event) => { event.stopPropagation(); options.onClaim?.(session) }}>{options.claimingSessionId === session.id ? 'Claiming…' : 'Claim'}</Button>
        }
        return session.coachName || NO_VALUE_STR
      },
    },
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

export function getClassBookingColumns(options: {
  canEditAttendance: boolean
  isPast: boolean
  instructorView?: boolean
  savingBookingId?: string | null
  onSetAttendance: (bookingId: string, attended: boolean | null) => void
}): ColumnDef<ClassBooking>[] {
  const statusColumn: ColumnDef<ClassBooking> = {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge variant="outline">{row.original.status.replaceAll('_', ' ')}</Badge>,
  }
  const sourceColumn: ColumnDef<ClassBooking> = {
    accessorKey: 'source',
    header: 'Source',
    cell: ({ row }) => <Badge variant="outline">{row.original.source === 'CLASSPASS' ? 'ClassPass' : 'Direct'}</Badge>,
  }
  const trialColumn: ColumnDef<ClassBooking> = {
    accessorKey: 'isFreeTrial',
    header: 'Trial',
    cell: ({ row }) => row.original.isFreeTrial ? <Badge variant="outline">Free trial</Badge> : '—',
  }
  const bookingColumn: ColumnDef<ClassBooking> = {
    id: 'booking', header: 'Booking',
    cell: ({ row }) => <Link to={`/bookings/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">{row.original.id}</Link>,
  }
  const memberColumn: ColumnDef<ClassBooking> = {
    id: 'member', header: 'Member',
    cell: ({ row }) => {
      const name = [row.original.firstName, row.original.lastName].filter(Boolean).join(' ')
      return <div className="flex min-w-0 items-center gap-2">
        <Link to={`/users/${row.original.userId}`} className="min-w-0 truncate font-medium underline-offset-2 hover:underline">{name || row.original.userId}</Link>
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
  }
  const attendanceColumn: ColumnDef<ClassBooking> = {
    id: 'attendance',
    header: 'Attendance',
    cell: ({ row }) => {
      const booking = row.original
      const canUpdate = options.canEditAttendance && options.isPast && !['CANCELLED', 'LATE_CANCELLED', 'WAITLISTED'].includes(booking.status)
      if (!canUpdate) return NO_VALUE_STR
      const isSaving = options.savingBookingId === booking.id
      return (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={cn(
              'size-8 rounded-full p-0',
              booking.attended === true && 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white',
            )}
            aria-label={booking.attended === true ? 'Clear attended status' : 'Mark attended'}
            aria-pressed={booking.attended === true}
            title={booking.attended === true ? 'Attended (click to clear)' : 'Mark attended'}
            disabled={isSaving}
            onClick={() => options.onSetAttendance(booking.id, booking.attended === true ? null : true)}
          >
            <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={cn(
              'size-8 rounded-full p-0',
              booking.attended === false && 'border-red-600 text-red-600 hover:bg-red-50 hover:text-red-700',
            )}
            aria-label={booking.attended === false ? 'Clear absent status' : 'Mark absent'}
            aria-pressed={booking.attended === false}
            title={booking.attended === false ? 'Absent (click to clear)' : 'Mark absent'}
            disabled={isSaving}
            onClick={() => options.onSetAttendance(booking.id, booking.attended === false ? null : false)}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
          </Button>
        </div>
      )
    },
  }
  const bookedColumn: ColumnDef<ClassBooking> = {
    accessorKey: 'createdAt',
    header: 'Booked',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
  }

  return options.instructorView
    ? [statusColumn, sourceColumn, memberColumn, attendanceColumn]
    : [statusColumn, sourceColumn, trialColumn, bookingColumn, memberColumn, attendanceColumn, bookedColumn]
}
