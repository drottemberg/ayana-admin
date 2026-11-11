import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon'
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon'
import { HugeiconsIcon } from '@hugeicons/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/app/StatusPill'
import { NO_VALUE_STR } from '@/constants'
import { cn } from '@/lib/utils'
import type { Booking } from '@/types/booking'
import type { ClassBooking } from '@/types/class-type'
import { memberAvatarColor, memberAvatarInitials } from './member-avatar'

export function bookingCreatedDateKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${values.year}-${values.month}-${values.day}`
}

function bookingDateGroupLabel(key: string) {
  if (key === 'unknown') return 'Unknown date'
  const date = new Date(`${key}T12:00:00`)
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(date)
}

export function BookingCardDayGroup({ dateKey, count, children }: { dateKey: string; count: number; children: ReactNode }) {
  return <section className="space-y-2.5">
    <header className="flex items-center justify-between gap-3 px-1">
      <h3 className="text-sm font-semibold text-foreground">{bookingDateGroupLabel(dateKey)}</h3>
      <span className="shrink-0 text-sm text-muted-foreground">{count} {count === 1 ? 'booking' : 'bookings'}</span>
    </header>
    <div className="overflow-hidden rounded-[26px] bg-card shadow-sm divide-y divide-border/70">{children}</div>
  </section>
}

function classSessionTime(value?: string, timezone?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { timeZone: timezone || undefined, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function bookingSessionDateParts(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', weekday: 'short' }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return {
    month: (values.month ?? '').toUpperCase(),
    day: values.day ?? '',
    weekday: values.weekday ?? '',
    time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date),
  }
}

function bookingCreatedDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function bookingDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function sourceLabel(source?: string) {
  return source === 'CLASSPASS' ? 'ClassPass' : source === 'EGYM' ? 'EGYM Wellpass' : 'Direct'
}

function SourcePill({ source }: { source?: string }) {
  return <Badge variant="secondary" className="h-6 rounded-full border-0 bg-[#f4f1ee] px-3 text-xs font-medium text-[#5f5954]">{sourceLabel(source)}</Badge>
}

function FreeTrialPill() {
  return <Badge variant="secondary" className="h-6 rounded-full border-0 bg-[#fff0e9] px-3 text-xs font-medium text-[#a85a39]">Free trial</Badge>
}

function StudioVisitPill({ previousVisits = 0 }: { previousVisits?: number }) {
  const visitNumber = previousVisits + 1
  return <Badge
    variant="outline"
    className="h-5 min-w-5 shrink-0 justify-center rounded-full px-1 text-[10px] font-medium text-muted-foreground"
    title={`Studio visit number ${visitNumber}`}
    aria-label={`Studio visit number ${visitNumber}`}
  >
    {visitNumber}
  </Badge>
}

function CoachVisitPill({ previousVisits }: { previousVisits?: number | null }) {
  if (previousVisits == null) return null
  const visitNumber = previousVisits + 1
  return <Badge
    variant="outline"
    className="h-5 min-w-5 shrink-0 justify-center rounded-full border-[#d7e4d2] bg-[#f1f6ee] px-1 text-[10px] font-medium text-[#4e6545]"
    title={`Class with this coach number ${visitNumber}`}
    aria-label={`Class with this coach number ${visitNumber}`}
  >
    {visitNumber}
  </Badge>
}

type CurrentContractData = Pick<Booking, 'currentContractName' | 'currentContractCreditsRemaining' | 'hasCurrentContractBalance'>

function CurrentContractPill({ booking }: { booking: CurrentContractData }) {
  if (!booking.hasCurrentContractBalance) return null
  const balance = booking.currentContractCreditsRemaining === null
    ? 'Unlimited credits'
    : `${booking.currentContractCreditsRemaining ?? 0} credits left`
  const label = [booking.currentContractName || 'Credits', balance].join(' · ')
  return <Badge variant="secondary" className="h-6 max-w-full rounded-full border-0 bg-[#eef3e9] px-3 text-xs font-medium text-[#4e6545]" title={label}>
    <span className="truncate">{label}</span>
  </Badge>
}

export function BookingListCard({
  booking,
  actions,
  showUser = true,
  showCustomer = false,
  showSessionDateAside = false,
  showContractDetails = false,
  grouped = false,
}: {
  booking: Booking
  actions: ReactNode
  showUser?: boolean
  showCustomer?: boolean
  showSessionDateAside?: boolean
  showContractDetails?: boolean
  grouped?: boolean
}) {
  const memberName = [booking.user.firstName, booking.user.lastName].filter(Boolean).join(' ') || booking.user.email || booking.user.id
  const classTime = classSessionTime(booking.startsAt)
  const sessionDate = showSessionDateAside ? bookingSessionDateParts(booking.startsAt) : null
  const secondaryDetails = [booking.location.name, showCustomer ? booking.customer.name : null].filter(Boolean).join(' · ')
  const isCancelled = booking.status === 'CANCELLED' || booking.status === 'LATE_CANCELLED'

  return <article className={cn('flex min-w-0 items-stretch gap-3 sm:gap-4', !sessionDate && 'px-4 py-3.5 sm:px-5', !grouped && (sessionDate ? 'overflow-hidden rounded-2xl border border-border bg-card shadow-sm' : 'rounded-2xl bg-card shadow-sm'), isCancelled && 'opacity-60')}>
    {sessionDate ? <div className="flex w-[72px] shrink-0 flex-col items-center justify-start gap-0.5 border-r border-border bg-background px-2 pt-3 text-center">
      <span className="text-[10px] font-semibold leading-none tracking-wide text-muted-foreground">{sessionDate.month}</span>
      <span className="text-xl font-bold leading-tight text-foreground">{sessionDate.day}</span>
      <span className="text-xs leading-none text-muted-foreground">{sessionDate.weekday}</span>
      <span className="mt-1 whitespace-nowrap text-xs font-semibold leading-4 text-foreground">{sessionDate.time}</span>
    </div> : null}
    {showUser ? <div className={cn('mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold', memberAvatarColor(booking.user.id))} aria-hidden="true">{memberAvatarInitials(memberName)}</div> : null}
    <div className={cn('min-w-0 flex-1', sessionDate && 'py-3.5 pr-4 sm:pr-5')}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          {showUser ? <div className="flex min-w-0 items-center gap-1.5">
            <Link to={`/users/${encodeURIComponent(booking.user.id)}`} className="min-w-0 truncate text-base font-semibold leading-5 text-foreground hover:underline">{memberName}</Link>
            <StudioVisitPill previousVisits={booking.studioVisitCount} />
            <CoachVisitPill previousVisits={booking.coachVisitCount} />
          </div> : null}
          <Link to={`/class-sessions/${encodeURIComponent(booking.sessionId)}?locationId=${encodeURIComponent(booking.location.id)}`} className={cn('block truncate text-sm leading-5 text-[#625b56] hover:underline', showUser && 'mt-0.5 font-medium')}>
            {booking.className || booking.sessionId}
          </Link>
          {!sessionDate && classTime ? <div className="mt-0.5 text-xs leading-4 text-muted-foreground">{classTime}</div> : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <SourcePill source={booking.source} />
            {booking.isFreeTrial ? <FreeTrialPill /> : null}
            {showContractDetails && booking.source === 'DIRECT' ? <CurrentContractPill booking={booking} /> : null}
            <Link to={`/bookings/${encodeURIComponent(booking.id)}`} className="max-w-48 truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" title={booking.id}>#{booking.id}</Link>
          </div>
          {secondaryDetails ? <div className="mt-1 truncate text-xs text-muted-foreground">{secondaryDetails}</div> : null}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <StatusPill status={booking.status} />
          {actions ? <div className="-mr-2 -mt-2">{actions}</div> : null}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[#a29b96]">
        <span>{Number(booking.creditsUsed ?? 0)} credit{Number(booking.creditsUsed ?? 0) === 1 ? '' : 's'} used</span>
        {isCancelled && booking.cancelledAt
          ? <time dateTime={booking.cancelledAt} className="font-medium text-red-600">Cancelled {bookingDateTime(booking.cancelledAt)}</time>
          : <time dateTime={booking.createdAt}>{bookingCreatedDateTime(booking.createdAt)}</time>}
      </div>
    </div>
  </article>
}

function AttendanceButtons({
  booking,
  disabled,
  onSetAttendance,
}: {
  booking: ClassBooking
  disabled: boolean
  onSetAttendance: (bookingId: string, attended: boolean | null) => void
}) {
  return <div className="flex items-center gap-1.5">
    <Button type="button" size="icon" variant="outline" className={cn('size-8 rounded-full p-0', booking.attended === true && 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white')} aria-label={booking.attended === true ? 'Clear attended status' : 'Mark attended'} aria-pressed={booking.attended === true} title={booking.attended === true ? 'Attended (click to clear)' : 'Mark attended'} disabled={disabled} onClick={() => onSetAttendance(booking.id, booking.attended === true ? null : true)}>
      <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" />
    </Button>
    <Button type="button" size="icon" variant="outline" className={cn('size-8 rounded-full p-0', booking.attended === false && 'border-red-600 text-red-600 hover:bg-red-50 hover:text-red-700')} aria-label={booking.attended === false ? 'Clear absent status' : 'Mark absent'} aria-pressed={booking.attended === false} title={booking.attended === false ? 'Absent (click to clear)' : 'Mark absent'} disabled={disabled} onClick={() => onSetAttendance(booking.id, booking.attended === false ? null : false)}>
      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
    </Button>
  </div>
}

export function ClassBookingListCard({
  booking,
  actions,
  locationName,
  showContractDetails = false,
  instructorView = false,
  canUpdateAttendance = false,
  attendanceAvailable = false,
  saving = false,
  onSetAttendance,
  grouped = false,
}: {
  booking: ClassBooking
  actions: ReactNode
  locationName?: string | null
  showContractDetails?: boolean
  instructorView?: boolean
  canUpdateAttendance?: boolean
  attendanceAvailable?: boolean
  saving?: boolean
  onSetAttendance: (bookingId: string, attended: boolean | null) => void
  grouped?: boolean
}) {
  const canUpdate = canUpdateAttendance && attendanceAvailable && !['CANCELLED', 'LATE_CANCELLED', 'WAITLISTED'].includes(booking.status)
  const isCancelled = booking.status === 'CANCELLED' || booking.status === 'LATE_CANCELLED'
  const name = [booking.firstName, booking.lastName].filter(Boolean).join(' ') || booking.userId
  const attendance = canUpdate
    ? <AttendanceButtons booking={booking} disabled={saving} onSetAttendance={onSetAttendance} />
    : <span className="text-sm text-muted-foreground">{NO_VALUE_STR}</span>

  if (instructorView) {
    return <article className={cn('flex min-w-0 items-center justify-between gap-3 px-4 py-3 sm:px-5', !grouped && 'rounded-2xl bg-card shadow-sm', isCancelled && 'opacity-60')}>
      <div className="flex min-w-0 items-center gap-3">
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold', memberAvatarColor(booking.userId))} aria-hidden="true">{memberAvatarInitials(name)}</div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link to={`/users/${encodeURIComponent(booking.userId)}`} className="truncate text-sm font-semibold text-foreground underline-offset-2 hover:underline">{name}</Link>
            <StudioVisitPill previousVisits={booking.studioVisitCount} />
            <CoachVisitPill previousVisits={booking.coachVisitCount} />
          </div>
          <StatusPill status={booking.status} />
          <SourcePill source={booking.source} />
          {showContractDetails && booking.source === 'DIRECT' && booking.hasCurrentContractBalance ? <CurrentContractPill booking={booking} /> : null}
          {isCancelled && booking.cancelledAt ? <time dateTime={booking.cancelledAt} className="text-xs font-medium text-red-600">Cancelled {bookingDateTime(booking.cancelledAt)}</time> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="sr-only">Attendance</span>{attendance}
        {actions ? <div className="-mr-2 -mt-2">{actions}</div> : null}
      </div>
    </article>
  }

  return <article className={cn('flex min-w-0 items-start gap-3 px-4 py-3.5 sm:gap-4 sm:px-5', !grouped && 'rounded-2xl bg-card shadow-sm', isCancelled && 'opacity-60')}>
    <div className={cn('mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold', memberAvatarColor(booking.userId))} aria-hidden="true">{memberAvatarInitials(name)}</div>
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link to={`/users/${encodeURIComponent(booking.userId)}`} className="min-w-0 truncate text-base font-semibold leading-5 text-foreground hover:underline">{name}</Link>
            <StudioVisitPill previousVisits={booking.studioVisitCount} />
            <CoachVisitPill previousVisits={booking.coachVisitCount} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <SourcePill source={booking.source} />
            {booking.isFreeTrial ? <FreeTrialPill /> : null}
            {showContractDetails && booking.source === 'DIRECT' && booking.hasCurrentContractBalance ? <CurrentContractPill booking={booking} /> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <StatusPill status={booking.status} />
          {actions ? <div className="-mr-2 -mt-2">{actions}</div> : null}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[#a29b96]">
        <span>{locationName || NO_VALUE_STR}</span>
        {isCancelled && booking.cancelledAt
          ? <time dateTime={booking.cancelledAt} className="font-medium text-red-600">Cancelled {bookingDateTime(booking.cancelledAt)}</time>
          : <time dateTime={booking.createdAt}>{bookingDateTime(booking.createdAt)}</time>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <Link to={`/bookings/${encodeURIComponent(booking.id)}`} className="max-w-full truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">#{booking.id}</Link>
        <div className="flex items-center gap-2">{attendance}</div>
      </div>
    </div>
  </article>
}
