import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import CalendarRemove01Icon from '@hugeicons/core-free-icons/CalendarRemove01Icon'
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'

import { RelatedEntityModule, DetailPageLayout, DetailSidePanel, type DetailPanelSection } from '@/components/app/detail-page-layout'
import { Badge } from '@/components/ui/badge'
import { PageHeader, PageHeaderIconAction } from '@/components/ui/page-header'
import { EntityIcon } from '@/components/app/entity-icons'
import { NO_VALUE_STR } from '@/constants'
import { getClassBookingColumns } from '@/features/classes/class-session-columns'
import { ClassBookingListCard } from '@/features/bookings/BookingListCard'
import { CreateManualBookingDrawer } from '@/features/bookings/CreateManualBookingDrawer'
import { cancelBookingWithChoice, cancelClassPassBookingWithConfirmation, getBookingRowActions, rebookClientForSession, updateBookingAttendance } from '@/features/bookings/booking-row-actions'
import { bookingsQueryKeys } from '@/features/bookings/query-keys'
import { ClassSessionEditDrawer } from '@/features/classes/ClassSessionEditDrawer'
import { CancelSessionConfirmation } from '@/features/classes/CancelSessionConfirmation'
import { deleteClassSessionWithConfirmation } from '@/features/classes/delete-class-session'
import { cancelClassSessionRequest, getClassBookingsRequest, getClassSessionRequest, reactivateClassSessionRequest, resumeClassSessionRequest } from '@/features/classes/api'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import { useDetailQuery } from '@/lib/query-hooks'
import { useConnect } from '@/features/app/use-connect'
import { Modals } from '@/providers/modal'
import type { ClassPassScheduleInsight, ClassSession } from '@/types/class-type'
import { formatClassSessionTime } from '@/features/classes/time-zone'
import { saveCoachSessionAttendanceRequest } from '@/features/coaches/api'
import { claimCoachSession } from '@/features/coaches/claim-coach-session'
import { CoachAttendanceDrawer } from '@/features/coaches/CoachAttendanceDrawer'
import { CoachRosterMemberProfileDrawer } from '@/features/coaches/CoachRosterMemberProfileDrawer'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  cancelClassPassScheduleRequest,
  enableClassPassScheduleRequest,
  refreshClassPassScheduleInsightsRequest,
  setClassPassScheduleFullRequest,
  updateClassPassScheduleSpotsRequest,
  type ClassPassScheduleCancelReason,
} from '@/features/integrations/api'

function formatDate(value?: string | null, timeZone?: string | null) {
  return value ? formatClassSessionTime(value, timeZone) : NO_VALUE_STR
}

const classPassScheduleColumns: ColumnDef<ClassPassScheduleInsight>[] = [
  { accessorKey: 'scheduleId', header: 'Schedule ID' },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const schedule = row.original
      return <div className="flex flex-wrap gap-1.5">
        <Badge variant={schedule.isCancelled === true ? 'destructive' : 'outline'}>{schedule.isCancelled === null ? 'Cancellation unknown' : schedule.isCancelled ? 'Cancelled' : 'Active'}</Badge>
        <Badge variant={schedule.isDisabled === true ? 'secondary' : 'outline'}>{schedule.isDisabled === null ? 'Availability unknown' : schedule.isDisabled ? 'Disabled' : 'Enabled'}</Badge>
        {schedule.isFull ? <Badge variant="secondary">Full</Badge> : null}
      </div>
    },
  },
  { accessorKey: 'networkReservations', header: 'Spots', cell: ({ row }) => row.original.networkReservations ?? NO_VALUE_STR },
  { accessorKey: 'networkReservationsCap', header: 'Max spots', cell: ({ row }) => row.original.networkReservationsCap ?? NO_VALUE_STR },
  {
    accessorKey: 'totalRevenue',
    header: 'Revenue',
    cell: ({ row }) => {
      const value = row.original.totalRevenue
      if (value == null) return NO_VALUE_STR
      if (typeof value === 'number') return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
      if (typeof value === 'string') return value
      if (typeof value === 'object') {
        const amount = value as { currency_code?: unknown; minor_units?: unknown }
        if (typeof amount.currency_code === 'string' && typeof amount.minor_units === 'number') {
          return new Intl.NumberFormat(undefined, { style: 'currency', currency: amount.currency_code }).format(amount.minor_units / 100)
        }
        return JSON.stringify(value)
      }
      return String(value)
    },
  },
]

const scheduleCancelReasons: Array<{ base: string; label: string }> = [
  { base: 'INSTRUCTOR_UNWELL_NO_SHOW', label: 'Instructor unwell / no-show' },
  { base: 'OVERBOOKED_CLASS', label: 'Overbooked class' },
  { base: 'LOW_ATTENDANCE', label: 'Low attendance' },
  { base: 'SCHEDULE_INCORRECT', label: 'Incorrect schedule' },
  { base: 'VENUE_TECHNICAL_ISSUE', label: 'Venue technical issue' },
  { base: 'WEATHER_CONDITIONS', label: 'Weather conditions' },
  { base: 'OTHER', label: 'Other' },
]

const classPassCancelReasonLabels: Record<ClassPassScheduleCancelReason, string> = Object.fromEntries(
  scheduleCancelReasons.flatMap(({ base, label }) => [[base, label], [`POST_${base}`, `${label} (after the class)`]]),
) as Record<ClassPassScheduleCancelReason, string>

type ClassPassScheduleAction = { kind: 'SPOTS' | 'CANCEL'; schedule: ClassPassScheduleInsight }

export default function ClassSessionPage() {
  const { sessionId = '' } = useParams()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAddBookingOpen, setIsAddBookingOpen] = useState(false)
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false)
  const [memberProfileUserId, setMemberProfileUserId] = useState<string | null>(null)
  const [attendanceSavingId, setAttendanceSavingId] = useState<string | null>(null)
  const [isClaimingSession, setIsClaimingSession] = useState(false)
  const [bookingSourceSummary, setBookingSourceSummary] = useState('')
  const [bookingStatusFilter, setBookingStatusFilter] = useState<'CONFIRMED' | 'ALL'>('CONFIRMED')
  const [classPassScheduleAction, setClassPassScheduleAction] = useState<ClassPassScheduleAction | null>(null)
  const [spotChange, setSpotChange] = useState<'ADD' | 'REMOVE'>('ADD')
  const [spotCount, setSpotCount] = useState('1')
  const [scheduleCancelReason, setScheduleCancelReason] = useState<ClassPassScheduleCancelReason | ''>('')
  const [scheduleCancelMessage, setScheduleCancelMessage] = useState('')
  const [classPassActionSaving, setClassPassActionSaving] = useState(false)
  const cancellationMessageRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const locationId = searchParams.get('locationId') ?? ''
  const memberUserIdFromUrl = searchParams.get('memberUserId')
  useEffect(() => setMemberProfileUserId(memberUserIdFromUrl), [memberUserIdFromUrl])
  const { session: appSession } = useConnect()
  const { data, isLoading, isError } = useDetailQuery({
    queryKey: classSessionsQueryKeys.detail(sessionId),
    queryFn: () => getClassSessionRequest(sessionId, locationId),
    enabled: Boolean(sessionId && locationId),
  })
  const classSession = data as ClassSession | undefined
  const resolvedLocationId = classSession?.organizationId ?? locationId
  const instructorMembership = classSession?.customerId
    ? appSession?.user.customerMemberships.find((membership) => membership.customerId === classSession.customerId)
    : undefined
  const isInstructorContext = instructorMembership?.role === 'INSTRUCTOR'
  const isAssignedInstructor = instructorMembership?.role === 'INSTRUCTOR'
    && classSession?.coachId === appSession?.user.id
  const attendanceAvailable = Boolean(
    classSession?.startTime
    && new Date(classSession.startTime).getTime() <= Date.now() + 90 * 60 * 1000,
  )
  const canTakeAttendance = Boolean(
    isAssignedInstructor
    && classSession
    && ['SCHEDULED', 'COMPLETED'].includes(classSession.status)
    && attendanceAvailable,
  )
  const canClaimSession = Boolean(
    isInstructorContext
    && classSession
    && !classSession.coachId
    && !classSession.coachName
    && classSession.status === 'SCHEDULED'
    && new Date(classSession.startTime).getTime() >= Date.now(),
  )
  const canManageClassPassSchedules = Boolean(classSession?.customerId && appSession?.permissions.integrations?.edit)

  const invalidateBookingViews = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: [...classSessionsQueryKeys.detail(sessionId), 'bookings'] }),
  ])

  const setBookingAttendance = async (bookingId: string, attended: boolean | null) => {
    setAttendanceSavingId(bookingId)
    try {
      if (isInstructorContext && classSession) {
        await saveCoachSessionAttendanceRequest(classSession.id, [{ bookingId, present: attended }])
        await invalidateBookingViews()
        toast.success(attended === true ? 'Booking marked present.' : attended === false ? 'Booking marked absent.' : 'Attendance cleared.')
      } else {
        await updateBookingAttendance(bookingId, resolvedLocationId, attended, invalidateBookingViews)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update attendance.')
    } finally {
      setAttendanceSavingId(null)
    }
  }

  const claimSession = async () => {
    if (!classSession || isClaimingSession) return
    await claimCoachSession(classSession, queryClient, (id) => setIsClaimingSession(id !== null))
  }

  const cancelSession = async () => {
    if (!classSession) return
    let cancellationMessage = ''
    const confirmed = await Modals.confirm({
      title: 'Cancel this class session?',
      content: <CancelSessionConfirmation messageRef={cancellationMessageRef} />,
      okText: 'Cancel session',
      cancelText: 'Keep session',
      okButtonProps: { variant: 'destructive' },
      onOk: () => { cancellationMessage = cancellationMessageRef.current?.value.trim() ?? '' },
    })
    if (!confirmed) return
    try {
      const result = await cancelClassSessionRequest(classSession.id, resolvedLocationId, cancellationMessage)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: [...classSessionsQueryKeys.detail(sessionId), 'bookings'] }),
      ])
      toast.success(`Session cancelled. ${result.bookingCount} booking(s) cancelled; ${result.creditsReturned} credit(s) returned.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cancel the class session.')
    }
  }

  const resumeSession = async () => {
    if (!classSession) return
    try {
      await resumeClassSessionRequest(classSession.id, resolvedLocationId)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.detail(sessionId) }),
      ])
      toast.success('Session resumed. It will stay active through its schedule pause window.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not resume the session.')
    }
  }

  const reactivateSession = async () => {
    if (!classSession) return
    const confirmed = await Modals.confirm({ operation: 'reactivate this class session' })
    if (!confirmed) return
    try {
      await reactivateClassSessionRequest(classSession.id, resolvedLocationId)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.detail(sessionId) }),
        queryClient.invalidateQueries({ queryKey: [...classSessionsQueryKeys.detail(sessionId), 'bookings'] }),
      ])
      toast.success('Session reactivated. Previous bookings remain cancelled.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reactivate the session.')
    }
  }

  const refreshClassPassScheduleRows = async () => {
    const detailKey = classSessionsQueryKeys.detail(sessionId)
    await queryClient.invalidateQueries({ queryKey: detailKey, exact: true })
    await queryClient.invalidateQueries({ queryKey: [...detailKey, 'classpass-schedules'] })
  }

  const refreshClassPassInsights = async (schedule: ClassPassScheduleInsight) => {
    if (!classSession?.customerId) return
    setClassPassActionSaving(true)
    try {
      await refreshClassPassScheduleInsightsRequest(classSession.customerId, schedule.integrationId, schedule.scheduleMappingId)
      await refreshClassPassScheduleRows()
      toast.success('ClassPass insights refreshed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not refresh ClassPass insights.')
    } finally { setClassPassActionSaving(false) }
  }

  const runClassPassScheduleAction = async (action: 'FULL' | 'REOPEN' | 'ENABLE', schedule: ClassPassScheduleInsight) => {
    if (!classSession?.customerId) return
    if (action === 'FULL') {
      const confirmed = await Modals.confirm({
        operation: `mark ClassPass schedule ${schedule.scheduleId} as full`,
        okText: 'Mark full',
      })
      if (!confirmed) return
    }
    setClassPassActionSaving(true)
    try {
      const result = action === 'FULL'
        ? await setClassPassScheduleFullRequest(classSession.customerId, schedule.integrationId, schedule.scheduleMappingId, true)
        : action === 'REOPEN'
          ? await setClassPassScheduleFullRequest(classSession.customerId, schedule.integrationId, schedule.scheduleMappingId, false)
          : await enableClassPassScheduleRequest(classSession.customerId, schedule.integrationId, schedule.scheduleMappingId)
      await refreshClassPassScheduleRows()
      toast.success(action === 'FULL' ? 'ClassPass schedule marked as full.' : action === 'REOPEN' ? 'ClassPass reservations reopened.' : 'ClassPass schedule enabled.')
      setClassPassScheduleAction(null)
      return result
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the ClassPass schedule.')
    } finally { setClassPassActionSaving(false) }
  }

  const saveClassPassScheduleSpots = async () => {
    if (!classSession?.customerId || classPassScheduleAction?.kind !== 'SPOTS') return
    const count = Number(spotCount)
    if (!Number.isInteger(count) || count < 1) {
      toast.error('Choose a whole number greater than zero.')
      return
    }
    setClassPassActionSaving(true)
    try {
      const result = await updateClassPassScheduleSpotsRequest(
        classSession.customerId,
        classPassScheduleAction.schedule.integrationId,
        classPassScheduleAction.schedule.scheduleMappingId,
        spotChange,
        count,
      )
      await refreshClassPassScheduleRows()
      toast.success(`ClassPass spot limit updated to ${result.networkReservationsCap ?? 'the latest value'}.`)
      setClassPassScheduleAction(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update ClassPass spots.')
    } finally { setClassPassActionSaving(false) }
  }

  const cancelClassPassSchedule = async () => {
    if (!classSession?.customerId || classPassScheduleAction?.kind !== 'CANCEL' || !scheduleCancelReason) return
    setClassPassActionSaving(true)
    try {
      await cancelClassPassScheduleRequest(
        classSession.customerId,
        classPassScheduleAction.schedule.integrationId,
        classPassScheduleAction.schedule.scheduleMappingId,
        scheduleCancelReason,
        scheduleCancelMessage.trim() || undefined,
      )
      await refreshClassPassScheduleRows()
      toast.success('ClassPass schedule cancelled.')
      setClassPassScheduleAction(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cancel the ClassPass schedule.')
    } finally { setClassPassActionSaving(false) }
  }

  const openClassPassScheduleAction = (kind: ClassPassScheduleAction['kind'], schedule: ClassPassScheduleInsight) => {
    setClassPassScheduleAction({ kind, schedule })
    if (kind === 'SPOTS') {
      setSpotChange('ADD')
      setSpotCount('1')
    } else {
      const isPast = Boolean(classSession?.startTime && new Date(classSession.startTime).getTime() < Date.now())
      const reason = isPast ? 'POST_OTHER' : 'OTHER'
      setScheduleCancelReason(reason)
      setScheduleCancelMessage('')
    }
  }

  const getClassPassScheduleCommands = (schedule: ClassPassScheduleInsight) => {
    if (!canManageClassPassSchedules) return []
    return [
      { label: 'Refresh insights', onClick: () => { void refreshClassPassInsights(schedule) } },
      { type: 'separator' as const },
      { label: 'Add or remove spots…', onClick: () => openClassPassScheduleAction('SPOTS', schedule) },
      { type: 'separator' as const },
      ...(schedule.isFull === true
        ? [{ label: 'Reopen reservations', onClick: () => { void runClassPassScheduleAction('REOPEN', schedule) } }]
        : [{ label: 'Mark as full', onClick: () => { void runClassPassScheduleAction('FULL', schedule) } }]),
      ...(schedule.isDisabled === true
        ? [{ label: 'Enable schedule', onClick: () => { void runClassPassScheduleAction('ENABLE', schedule) } }]
        : []),
      ...(schedule.isCancelled === true
        ? []
        : [{ type: 'separator' as const }, { label: 'Cancel schedule…', icon: CalendarRemove01Icon, variant: 'destructive' as const, onClick: () => openClassPassScheduleAction('CANCEL', schedule) }]),
    ]
  }

  const sections: DetailPanelSection[] = [{
    title: 'Session details',
    icon: EntityIcon.classes,
    fields: [
      { label: 'Status', value: classSession ? <Badge variant="outline">{classSession.status}</Badge> : NO_VALUE_STR },
      { label: 'Customer', value: classSession?.customerId ? <Link to={`/customers/${classSession.customerId}`} className="underline-offset-2 hover:underline">{classSession.customerName || 'Customer'}</Link> : NO_VALUE_STR },
      { label: 'ID', value: classSession?.id ?? sessionId },
      { label: 'Class', value: classSession?.classTypeId ? <Link to={`/classes/${classSession.classTypeId}?locationId=${encodeURIComponent(resolvedLocationId)}`} className="underline-offset-2 hover:underline">{classSession.className || classSession.classTypeId}</Link> : NO_VALUE_STR },
      { label: 'Category', value: classSession?.classCategory || NO_VALUE_STR },
      { label: 'Format', value: classSession?.type ?? NO_VALUE_STR },
      { label: 'Starts', value: formatDate(classSession?.startTime, classSession?.timezone) },
      { label: 'Ends', value: formatDate(classSession?.endTime, classSession?.timezone) },
      { label: 'Capacity', value: classSession ? `${classSession.bookedCount} / ${classSession.capacity}` : NO_VALUE_STR },
      { label: 'Coach', value: classSession?.coachName || classSession?.coachId
        ? classSession?.coachName || 'Instructor'
        : canClaimSession
          ? <Button type="button" size="sm" variant="outline" disabled={isClaimingSession} onClick={() => { void claimSession() }}>{isClaimingSession ? 'Claiming…' : 'Claim'}</Button>
          : NO_VALUE_STR },
      { label: 'Schedule', value: classSession?.scheduleId ?? NO_VALUE_STR },
      { label: 'Location', value: resolvedLocationId ? <Link to={`/locations/${resolvedLocationId}`} className="underline-offset-2 hover:underline">{classSession?.locationName || 'Location'}</Link> : NO_VALUE_STR },
    ],
  }]

  if (isError || (!isLoading && !classSession)) {
    return <><PageHeader title="Session not found" subtitle={sessionId} backTo="/class-sessions" /><section className="p-4 md:p-6"><div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Failed to load this class session.</div></section></>
  }

  return <DetailPageLayout
    header={{
      title: classSession?.className ?? 'Class session',
      subtitle: formatDate(classSession?.startTime, classSession?.timezone),
      backTo: '/class-sessions',
      commands: (classSession?.status === 'SCHEDULED' && appSession?.permissions.classSessions?.edit)
        || ((classSession?.status === 'SCHEDULED' || classSession?.status === 'PAUSED') && appSession?.permissions.classSessions?.delete)
        || (classSession && String(classSession.status) !== 'DELETED' && String(classSession.status) !== 'COMPLETED' && new Date(classSession.startTime).getTime() > Date.now() && appSession?.permissions.classSessions?.delete)
        ? <>
            {classSession?.status === 'SCHEDULED' && appSession?.permissions.classSessions?.edit
              ? <PageHeaderIconAction icon={PencilEdit02Icon} label="Edit session" onClick={() => setIsEditOpen(true)} />
              : null}
            {(classSession?.status === 'SCHEDULED' || classSession?.status === 'PAUSED') && appSession?.permissions.classSessions?.delete
              ? <PageHeaderIconAction icon={CalendarRemove01Icon} label="Cancel session" variant="destructive" onClick={cancelSession} />
              : null}
            {classSession && String(classSession.status) !== 'DELETED' && String(classSession.status) !== 'COMPLETED' && new Date(classSession.startTime).getTime() > Date.now() && appSession?.permissions.classSessions?.delete
              ? <PageHeaderIconAction
                  icon={Delete02Icon}
                  label="Delete session"
                  variant="destructive"
                  onClick={async () => {
                    try {
                      const result = await deleteClassSessionWithConfirmation(classSession, resolvedLocationId, queryClient)
                      if (result) navigate('/class-sessions')
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Could not delete the class session.')
                    }
                  }}
                />
              : null}
          </>
        : undefined,
      primaryAction: classSession?.status === 'CANCELLED'
        && new Date(classSession.startTime).getTime() > Date.now()
        && appSession?.permissions.classSessions?.edit
        ? { children: 'Reactivate session', onClick: reactivateSession }
        : classSession?.status === 'PAUSED' && appSession?.permissions.classSessions?.edit
          ? { children: 'Resume session', onClick: resumeSession }
          : undefined,
    }}
    modules={[
      { key: 'bookings', label: 'Bookings', count: classSession?.bookedCount },
      ...(!isInstructorContext && classSession?.classPassSchedules?.length ? [{ key: 'classpass', label: 'ClassPass', count: classSession.classPassSchedules.length }] : []),
    ]}
    aside={<DetailSidePanel sections={sections} isLoading={isLoading} />}
  >
    <RelatedEntityModule
      key={`bookings-${bookingStatusFilter}`}
      id="module-bookings"
      title={<>Bookings{bookingSourceSummary ? <span className="ml-2 text-sm font-normal text-muted-foreground">{bookingSourceSummary}</span> : null}</>}
      icon={EntityIcon.users}
      action={classSession?.status === 'PAUSED' && appSession?.permissions.classSessions?.edit
        ? { label: 'Resume session', onClick: resumeSession }
          : isAssignedInstructor
          ? { label: attendanceAvailable ? 'Take attendance' : 'View roster', onClick: () => setIsAttendanceOpen(true) }
        : classSession?.status === 'SCHEDULED' && appSession?.permissions.bookings?.create
          ? { label: 'Add booking', iconOnly: true, onClick: () => setIsAddBookingOpen(true) }
          : undefined}
      queryKey={[...classSessionsQueryKeys.detail(sessionId), 'bookings', bookingStatusFilter]}
      loadData={async (state) => {
        const rows = await getClassBookingsRequest(resolvedLocationId, sessionId)
        const filteredRows = bookingStatusFilter === 'ALL'
          ? rows
          : rows.filter((booking) => !['CANCELLED', 'LATE_CANCELLED'].includes(booking.status))
        const sortedRows = [...filteredRows].sort((left, right) =>
          (left.firstName ?? '').localeCompare(right.firstName ?? '', undefined, { sensitivity: 'base' })
          || (left.lastName ?? '').localeCompare(right.lastName ?? '', undefined, { sensitivity: 'base' })
          || left.userId.localeCompare(right.userId),
        )
        const classPassCount = filteredRows.filter((booking) => booking.source === 'CLASSPASS').length
        const egymCount = filteredRows.filter((booking) => booking.source === 'EGYM').length
        const directCount = filteredRows.length - classPassCount - egymCount
        const summary = [classPassCount ? `${classPassCount} ClassPass` : '', egymCount ? `${egymCount} EGYM` : '', directCount ? `${directCount} Direct` : ''].filter(Boolean).join(' · ')
        setBookingSourceSummary((current) => current === summary ? current : summary)
        const { pageIndex, pageSize } = state.pagination
        return { items: sortedRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), count: sortedRows.length, pageCount: Math.ceil(sortedRows.length / pageSize) }
      }}
      tableKey={`class-sessions.detail.bookings.${sessionId}.25.${bookingStatusFilter}`}
      columns={getClassBookingColumns({
        canEditAttendance: Boolean(appSession?.permissions.bookings?.edit),
        attendanceAvailable,
        instructorView: isInstructorContext,
        canInstructorTakeAttendance: canTakeAttendance,
        savingBookingId: attendanceSavingId,
        onSetAttendance: (bookingId, attended) => { void setBookingAttendance(bookingId, attended) },
      })}
      renderCard={(booking, actions, grouped) => <ClassBookingListCard
        booking={booking}
        actions={actions}
        grouped={grouped}
        locationName={classSession?.locationName}
        instructorView={isInstructorContext}
        canUpdateAttendance={isInstructorContext ? canTakeAttendance : Boolean(appSession?.permissions.bookings?.edit)}
        attendanceAvailable={attendanceAvailable}
        saving={attendanceSavingId === booking.id}
        onSetAttendance={(bookingId, attended) => { void setBookingAttendance(bookingId, attended) }}
      />}
      getRowCommands={(booking) => getBookingRowActions({
        status: booking.status,
        canEdit: Boolean(appSession?.permissions.bookings?.edit),
        canCreate: Boolean(appSession?.permissions.bookings?.create),
        isPast: Boolean(classSession?.startTime && new Date(classSession.startTime).getTime() < Date.now()),
        source: booking.source,
        showAttendanceActionsInMenu: false,
        onCancel: () => { void cancelBookingWithChoice(booking.id, resolvedLocationId, invalidateBookingViews) },
        onSetAttendance: (attended) => { void setBookingAttendance(booking.id, attended) },
        onCancelClassPass: () => { void cancelClassPassBookingWithConfirmation(booking.id, resolvedLocationId, invalidateBookingViews) },
        onRebook: () => {
          if (!classSession?.customerId) {
            toast.error('Could not determine the customer for this class session.')
            return
          }
          const clientName = [booking.firstName, booking.lastName].filter(Boolean).join(' ') || booking.userId
          void rebookClientForSession({
            customerId: classSession.customerId,
            locationId: resolvedLocationId,
            sessionId: classSession.id,
            userId: booking.userId,
            clientName,
            invalidate: invalidateBookingViews,
          })
        },
      })}
      loadingMessage="Loading bookings..."
      emptyMessage="No bookings for this session."
      errorMessage="Failed to load bookings."
      pageSize={25}
      toolbarExtra={(
        <Select value={bookingStatusFilter} onValueChange={(value) => {
          if (value === 'CONFIRMED' || value === 'ALL') setBookingStatusFilter(value)
        }}>
          <SelectTrigger className="h-8 w-[140px]" aria-label="Filter bookings by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="ALL">All</SelectItem>
          </SelectContent>
        </Select>
      )}
      showPagination
      refetchOnMount="always"
    />
    {!isInstructorContext && classSession?.classPassSchedules?.length ? <RelatedEntityModule<ClassPassScheduleInsight>
      id="module-classpass"
      title="ClassPass schedules"
      icon={EntityIcon.classes}
      initialTotal={classSession.classPassSchedules.length}
      queryKey={[...classSessionsQueryKeys.detail(sessionId), 'classpass-schedules']}
      loadData={async (state) => {
        const { pageIndex, pageSize } = state.pagination
        const currentSession = queryClient.getQueryData<ClassSession>(classSessionsQueryKeys.detail(sessionId)) ?? classSession
        const schedules = currentSession.classPassSchedules ?? []
        const items = schedules.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
        return { items, count: schedules.length, pageCount: Math.ceil(schedules.length / pageSize) }
      }}
      tableKey={`class-sessions.detail.classpass.${sessionId}`}
      columns={classPassScheduleColumns}
      getRowCommands={getClassPassScheduleCommands}
      emptyMessage="No ClassPass schedule data is available."
      loadingMessage="Loading ClassPass schedule data..."
      showPagination
    /> : null}
    <ClassSessionEditDrawer
      session={classSession ?? null}
      locationId={resolvedLocationId}
      timeZone={classSession?.timezone ?? 'Europe/Paris'}
      open={isEditOpen}
      onOpenChange={setIsEditOpen}
    />
    <CreateManualBookingDrawer
      open={isAddBookingOpen}
      onOpenChange={setIsAddBookingOpen}
      initialSession={classSession ?? null}
    />
    {isAssignedInstructor && classSession ? <CoachAttendanceDrawer
      session={classSession}
      open={isAttendanceOpen}
      onOpenChange={setIsAttendanceOpen}
    /> : null}
    {isInstructorContext && classSession ? <CoachRosterMemberProfileDrawer
      sessionId={classSession.id}
      userId={memberProfileUserId}
      open={Boolean(memberProfileUserId)}
      onOpenChange={(open) => {
        if (!open) {
          setMemberProfileUserId(null)
          const nextParams = new URLSearchParams(searchParams)
          nextParams.delete('memberUserId')
          setSearchParams(nextParams, { replace: true })
        }
      }}
    /> : null}
    <Dialog
      open={Boolean(classPassScheduleAction)}
      onOpenChange={(open) => { if (!open && !classPassActionSaving) setClassPassScheduleAction(null) }}
    >
      <DialogContent className="sm:max-w-lg">
        {classPassScheduleAction?.kind === 'SPOTS' ? <>
          <DialogHeader showCloseButton>
            <DialogTitle>Update ClassPass spots</DialogTitle>
            <DialogDescription>
              Schedule {classPassScheduleAction.schedule.scheduleId}. Current reservations: {classPassScheduleAction.schedule.networkReservations ?? '—'}; limit: {classPassScheduleAction.schedule.networkReservationsCap ?? '—'}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <label className="grid gap-2 text-sm font-medium">
              Change
              <Select value={spotChange} onValueChange={(value) => setSpotChange(value as 'ADD' | 'REMOVE')}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADD">Add spots</SelectItem>
                  <SelectItem value="REMOVE">Remove spots</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Number of spots
              <Input type="number" min="1" step="1" value={spotCount} onChange={(event) => setSpotCount(event.target.value)} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={classPassActionSaving} onClick={() => setClassPassScheduleAction(null)}>Cancel</Button>
            <Button disabled={classPassActionSaving} onClick={() => { void saveClassPassScheduleSpots() }}>{classPassActionSaving ? 'Saving…' : 'Update spots'}</Button>
          </DialogFooter>
        </> : null}
        {classPassScheduleAction?.kind === 'CANCEL' ? <>
          <DialogHeader showCloseButton>
            <DialogTitle>Cancel ClassPass schedule?</DialogTitle>
            <DialogDescription>
              This cancels schedule {classPassScheduleAction.schedule.scheduleId} in ClassPass. Choose the reason sent to ClassPass.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <label className="grid gap-2 text-sm font-medium">
              Cancellation reason
              <Select value={scheduleCancelReason} onValueChange={(value) => setScheduleCancelReason(value as ClassPassScheduleCancelReason)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a reason" /></SelectTrigger>
                <SelectContent>
                  {scheduleCancelReasons.map(({ base }) => {
                    const isPast = Boolean(classSession?.startTime && new Date(classSession.startTime).getTime() < Date.now())
                    const value = `${isPast ? 'POST_' : ''}${base}` as ClassPassScheduleCancelReason
                    return <SelectItem key={value} value={value}>{classPassCancelReasonLabels[value]}</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Message to ClassPass users (optional)
              <Textarea value={scheduleCancelMessage} onChange={(event) => setScheduleCancelMessage(event.target.value)} maxLength={2000} rows={3} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={classPassActionSaving} onClick={() => setClassPassScheduleAction(null)}>Keep schedule</Button>
            <Button variant="destructive" disabled={classPassActionSaving || !scheduleCancelReason} onClick={() => { void cancelClassPassSchedule() }}>{classPassActionSaving ? 'Cancelling…' : 'Cancel schedule'}</Button>
          </DialogFooter>
        </> : null}
      </DialogContent>
    </Dialog>
  </DetailPageLayout>
}
