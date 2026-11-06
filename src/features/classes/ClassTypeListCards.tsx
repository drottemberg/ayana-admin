import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { StatusPill } from '@/components/app/StatusPill'
import { cn } from '@/lib/utils'
import type { ClassSchedule, ClassType } from '@/types/class-type'

const classTypeLabels: Record<ClassType['type'], string> = {
  GROUP: 'Group',
  SEMI_PRIVATE: 'Semi-private',
  PRIVATE: 'Private',
}

function DateValue({ value }: { value?: string | null }) {
  if (!value) return <span>No end date</span>
  const date = new Date(/^\d{4}-\d{2}-\d{2}/.test(value) ? `${value.slice(0, 10)}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return <span>—</span>
  return <time dateTime={value}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)}</time>
}

function classTypeHref(classType: ClassType) {
  return `/classes/${encodeURIComponent(classType.id)}?locationId=${encodeURIComponent(classType.locationId || classType.organizationId)}`
}

export function ClassTypeListCard({
  classType,
  actions,
  showCustomer = false,
}: {
  classType: ClassType
  actions: ReactNode
  showCustomer?: boolean
}) {
  const disabled = !classType.isActive

  return <article className={cn('flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-card-foreground shadow-sm sm:gap-4 sm:px-5', disabled && 'opacity-65')}>
    <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={classTypeHref(classType)} className="truncate text-base font-semibold leading-5 text-foreground hover:underline">{classType.name}</Link>
          <div className="mt-1 truncate text-sm text-[#625b56]">
            {[classType.category, classTypeLabels[classType.type] ?? classType.type].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          <StatusPill status={disabled ? 'DISABLED' : 'ACTIVE'} />
          {actions ? <div className="-mr-2 -mt-2">{actions}</div> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="h-6 rounded-md px-2 text-xs font-medium">{classType.duration} min</Badge>
        <Badge variant="secondary" className="h-6 rounded-md px-2 text-xs font-medium">Capacity {classType.maxCapacity}</Badge>
        <Badge variant="secondary" className="h-6 rounded-md px-2 text-xs font-medium">{Number(classType.creditCost)} credit{Number(classType.creditCost) === 1 ? '' : 's'}</Badge>
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {classType.locationName && classType.locationId
          ? <Link to={`/locations/${encodeURIComponent(classType.locationId)}`} className="truncate underline-offset-2 hover:text-foreground hover:underline">{classType.locationName}</Link>
          : <span className="truncate">{classType.locationName || '—'}</span>}
        {showCustomer && classType.customerName && classType.customerId
          ? <Link to={`/customers/${encodeURIComponent(classType.customerId)}`} className="truncate underline-offset-2 hover:text-foreground hover:underline">{classType.customerName}</Link>
          : null}
      </div>
    </div>
  </article>
}

const weekDays: Record<string, string> = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
}

function recurrenceLabel(schedule: ClassSchedule) {
  const multiplier = Math.max(1, schedule.frequencyMultiplier || 1)
  if (schedule.frequencyUnit === 'DAILY') return multiplier === 1 ? 'Every day' : `Every ${multiplier} days`
  if (schedule.frequencyUnit === 'MONTHLY') return `Monthly · day ${schedule.monthlyDay ?? '—'}`
  const day = schedule.dayOfWeek ? weekDays[schedule.dayOfWeek] ?? schedule.dayOfWeek : 'Weekly'
  return multiplier === 1 ? day : `${day} · every ${multiplier} weeks`
}

function scheduleStatus(schedule: ClassSchedule) {
  if (!schedule.isActive) return { label: 'Disabled', muted: true, pending: false }
  const today = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const pauseFrom = schedule.pauseFrom?.slice(0, 10)
  const pauseUntil = schedule.pauseUntil?.slice(0, 10)
  if (pauseFrom && pauseFrom <= today && (!pauseUntil || pauseUntil >= today)) return { label: 'Paused', muted: true, pending: false }
  if (pauseFrom && pauseFrom > today) return { label: 'Pause scheduled', muted: false, pending: true }
  return { label: 'Active', muted: false, pending: false }
}

export function ClassScheduleListCard({
  schedule,
  classType,
  actions,
}: {
  schedule: ClassSchedule
  classType: ClassType
  actions: ReactNode
}) {
  const status = scheduleStatus(schedule)
  const timeLabel = `${String(schedule.startHour).padStart(2, '0')}:${String(schedule.startMinute).padStart(2, '0')}`

  return <article className={cn('flex min-w-0 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm', status.muted && 'opacity-65')}>
    <div className="flex w-[76px] shrink-0 flex-col items-center justify-start gap-1 border-r border-border bg-background px-2 pt-3 text-center">
      <span className="text-[10px] font-semibold leading-none tracking-wide text-muted-foreground">{schedule.frequencyUnit === 'MONTHLY' ? 'MONTH' : schedule.frequencyUnit === 'DAILY' ? 'DAILY' : 'WEEK'}</span>
      <span className="text-sm font-bold leading-tight text-foreground">{schedule.frequencyUnit === 'MONTHLY' ? schedule.monthlyDay ?? '—' : schedule.frequencyUnit === 'DAILY' ? '7/7' : (schedule.dayOfWeek ?? '—')}</span>
      <time className="text-xs font-semibold leading-4 text-foreground">{timeLabel}</time>
    </div>
    <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <Link to={classTypeHref(classType)} className="min-w-0 truncate text-sm font-semibold leading-5 text-foreground hover:underline">{classType.name}</Link>
          <div className="flex shrink-0 items-center gap-1">
            <StatusPill
              status={status.muted ? (schedule.isActive ? 'PAUSED' : 'DISABLED') : status.pending ? 'PAUSE_SCHEDULED' : 'ACTIVE'}
              label={status.label}
            />
            {schedule.autoGenerateSessions !== false ? <Badge variant="secondary" className="h-5 rounded-md px-2 text-[10px] font-semibold">AUTO</Badge> : null}
            {actions ? <div className="-mr-2 -mt-2 shrink-0">{actions}</div> : null}
          </div>
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4 text-muted-foreground">
          <span className="truncate">{recurrenceLabel(schedule)}</span>
          <Badge variant="secondary" className="h-5 shrink-0 px-2 text-[10px] font-semibold tabular-nums">Capacity {schedule.capacity ?? classType.maxCapacity}</Badge>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {schedule.coachName
            ? <span className="inline-flex min-w-0 items-center gap-1.5"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-foreground">{schedule.coachName.trim().charAt(0).toUpperCase()}</span><span className="truncate">{schedule.coachName}</span></span>
            : <span className="inline-flex items-center gap-1.5 font-medium text-destructive"><span className="size-1.5 rounded-full bg-destructive" />No coach</span>}
          {schedule.autoGenerateSessions === false ? <span>Manual sessions</span> : null}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span>From <DateValue value={schedule.validFrom} /></span>
          <span>Until <DateValue value={schedule.validUntil} /></span>
        </div>
      </div>
    </div>
  </article>
}
