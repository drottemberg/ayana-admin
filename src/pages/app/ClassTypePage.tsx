import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { RelatedEntityModule, DetailPageLayout, DetailSidePanel, type DetailPanelSection } from '@/components/app/detail-page-layout'
import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { NO_VALUE_STR } from '@/constants'
import { ClassTypeEditDrawer } from '@/features/classes/ClassTypeEditDrawer'
import { ClassScheduleCreateDrawer } from '@/features/classes/ClassScheduleCreateDrawer'
import { ClassScheduleEditDrawer } from '@/features/classes/ClassScheduleEditDrawer'
import { classScheduleColumns, getClassSessionColumns } from '@/features/classes/class-session-columns'
import { cancelClassSessionRequest, generateClassScheduleSessionsRequest, getClassSchedulesRequest, getClassSessionsRequest, getClassTypeRequest } from '@/features/classes/api'
import { classSessionsQueryKeys, classTypesQueryKeys } from '@/features/classes/query-keys'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import { useDetailQuery } from '@/lib/query-hooks'
import { Modals } from '@/providers/modal'
import type { ClassSchedule, ClassSession, ClassType } from '@/types/class-type'
import { deleteClassScheduleRequest, updateClassScheduleRequest } from '@/features/classes/api'

function localPage<T extends Record<string, unknown>>(items: T[], state: DataTableState<T>): Promise<DataTableAsyncResult<T>> {
  const { pageIndex, pageSize } = state.pagination
  return Promise.resolve({ items: items.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), count: items.length, pageCount: Math.ceil(items.length / pageSize) })
}

function typeLabel(type: ClassType['type']) {
  return ({ GROUP: 'Group', SEMI_PRIVATE: 'Semi-private', PRIVATE: 'Private' } as const)[type]
}

export default function ClassTypePage() {
  const { classTypeId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const locationId = searchParams.get('locationId') ?? ''
  const [editingClassType, setEditingClassType] = useState<ClassType | null>(null)
  const [isScheduleDrawerOpen, setIsScheduleDrawerOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useConnect()
  const isAdminContext = getAppMode() === 'admin'
  const { data: classType, isLoading, isError } = useDetailQuery({
    queryKey: [...classTypesQueryKeys.all, 'detail', classTypeId, locationId],
    queryFn: () => getClassTypeRequest(classTypeId, locationId),
    enabled: Boolean(classTypeId && locationId),
  })

  const sections: DetailPanelSection[] = [{
    title: 'Class details',
    fields: [
      { label: 'Status', value: classType ? <Badge variant="outline">{classType.isActive ? 'Active' : 'Disabled'}</Badge> : NO_VALUE_STR },
      { label: 'ID', value: classType?.id ?? classTypeId },
      { label: 'Name', value: classType?.name ?? NO_VALUE_STR },
      { label: 'Category', value: classType?.category || NO_VALUE_STR },
      { label: 'Conditions and requirements', value: classType?.conditions ? <div className="whitespace-pre-wrap">{classType.conditions}</div> : NO_VALUE_STR },
      { label: 'Format', value: classType ? typeLabel(classType.type) : NO_VALUE_STR },
      { label: 'Duration', value: classType ? `${classType.duration} min` : NO_VALUE_STR },
      { label: 'Capacity', value: classType?.maxCapacity ?? NO_VALUE_STR },
      { label: 'Credits per booking', value: classType ? Number(classType.creditCost) : NO_VALUE_STR },
      ...(isAdminContext ? [{ label: 'Customer', value: classType?.customerId && classType.customerName ? <Link to={`/customers/${classType.customerId}`} className="underline-offset-2 hover:underline">{classType.customerName}</Link> : classType?.customerName ?? NO_VALUE_STR }] : []),
      { label: 'Location', value: classType?.locationId ? <Link to={`/locations/${classType.locationId}`} className="underline-offset-2 hover:underline">{classType.locationName || classType.locationId}</Link> : classType?.locationName ?? NO_VALUE_STR },
    ],
  }]

  if (isError || (!isLoading && !classType)) {
    return <><PageHeader title="Class not found" subtitle={classTypeId} backTo="/classes" /><section className="p-4 md:p-6"><div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Failed to load this class.</div></section></>
  }

  const canEditClass = Boolean(session?.permissions.classes?.edit)
  const canEditSchedule = Boolean(session?.permissions.classSchedules?.edit)
  const canDeleteSchedule = Boolean(session?.permissions.classSchedules?.delete)
  const canCancelSessions = Boolean(session?.permissions.classSessions?.delete)
  const editableClassType = classType ? { ...classType, locationId: classType.locationId || classType.organizationId } : null
  const refreshSchedules = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: [...classTypesQueryKeys.location(locationId), classTypeId, 'schedules'] }),
    queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
  ])
  const localToday = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }
  return <>
    <DetailPageLayout
      header={{
        title: classType?.name ?? 'Class', subtitle: isLoading ? 'Loading...' : classTypeId, backTo: '/classes',
        primaryAction: editableClassType && canEditClass ? { children: 'Edit class', onClick: () => setEditingClassType(editableClassType) } : undefined,
      }}
      modules={[{ key: 'schedules', label: 'Schedules' }, { key: 'sessions', label: 'Sessions' }]}
      aside={<DetailSidePanel sections={sections} isLoading={isLoading} />}
    >
      <RelatedEntityModule<ClassSchedule & Record<string, unknown>>
        id="module-schedules"
        title="Schedules"
        queryKey={[...classTypesQueryKeys.location(locationId), classTypeId, 'schedules']}
        loadData={async (state) => {
          const schedules = (await getClassSchedulesRequest(locationId)).filter((schedule) => schedule.classTypeId === classTypeId)
          return localPage(schedules as (ClassSchedule & Record<string, unknown>)[], state)
        }}
        tableKey={`classes.detail.schedules.${classTypeId}`}
        columns={classScheduleColumns as never}
        action={canEditSchedule ? { label: 'Add schedule', onClick: () => setIsScheduleDrawerOpen(true) } : undefined}
        getRowCommands={(schedule) => canEditSchedule ? [
          { label: 'Edit schedule', onClick: () => setEditingSchedule(schedule) },
          ...(schedule.isActive ? [schedule.pauseFrom && (!schedule.pauseUntil || new Date(schedule.pauseUntil).toISOString().slice(0, 10) >= localToday()) ? {
            label: new Date(schedule.pauseFrom).toISOString().slice(0, 10) > localToday() ? 'Cancel scheduled pause' : 'Resume schedule',
            onClick: async () => {
              try {
                await updateClassScheduleRequest(locationId, schedule.id, { pauseFrom: null, pauseUntil: null })
                await refreshSchedules()
                toast.success(new Date(schedule.pauseFrom!).toISOString().slice(0, 10) > localToday()
                  ? 'Scheduled pause cancelled.'
                  : 'Schedule resumed. Future sessions have been restored or generated.')
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Could not resume the schedule.')
              }
            },
          } : {
            label: 'Pause schedule',
            onClick: async () => {
              let pauseDate = localToday()
              let pauseUntil = localToday()
              const confirmed = await Modals.confirm({
                title: 'Pause this schedule?',
                content: <div className="grid gap-2"><p>Choose the date range when this schedule should stop generating classes. Booked sessions will be preserved.</p><label className="grid gap-1.5 text-sm font-medium"><span>Pause from</span><Input type="date" min={localToday()} defaultValue={pauseDate} onChange={(event) => { pauseDate = event.target.value }} /></label><label className="grid gap-1.5 text-sm font-medium"><span>Pause until</span><Input type="date" min={localToday()} defaultValue={pauseUntil} onChange={(event) => { pauseUntil = event.target.value }} /></label></div>,
                okText: 'Pause schedule',
                cancelText: 'Cancel',
              })
              if (!confirmed || !pauseDate || !pauseUntil) return
              if (pauseUntil < pauseDate) {
                toast.error('The pause end date must be on or after the start date.')
                return
              }
              try {
                await updateClassScheduleRequest(locationId, schedule.id, {
                  pauseFrom: `${pauseDate}T00:00:00.000Z`,
                  pauseUntil: `${pauseUntil}T00:00:00.000Z`,
                })
                await refreshSchedules()
                toast.success(`Schedule will pause from ${new Date(`${pauseDate}T12:00:00`).toLocaleDateString()} to ${new Date(`${pauseUntil}T12:00:00`).toLocaleDateString()}.`)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Could not pause the schedule.')
              }
            },
          }] : schedule.validUntil && new Date(schedule.validUntil) <= new Date() ? [] : [{
            label: 'Enable schedule',
            onClick: async () => {
              try {
                await updateClassScheduleRequest(locationId, schedule.id, { isActive: true })
                await refreshSchedules()
                toast.success('Schedule enabled.')
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Could not enable the schedule.')
              }
            },
          }]),
          ...(canDeleteSchedule ? [{
            label: 'Delete schedule',
            variant: 'destructive' as const,
            onClick: async () => {
              const confirmed = await Modals.confirm({
                title: 'Delete this schedule?',
                content: 'The recurring schedule will be ended and kept in the records. Existing sessions with bookings will remain.',
                okText: 'Delete schedule',
                cancelText: 'Cancel',
                okButtonProps: { variant: 'destructive' },
              })
              if (!confirmed) return
              try {
                await deleteClassScheduleRequest(locationId, schedule.id)
                await refreshSchedules()
                toast.success('Schedule deleted.')
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Could not delete the schedule.')
              }
            },
          }] : []),
          {
            label: 'Generate upcoming sessions',
            onClick: async () => {
              try {
                const result = await generateClassScheduleSessionsRequest(locationId, schedule.id)
                await queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all })
                toast.success(`${result.created} upcoming session${result.created === 1 ? '' : 's'} generated.`)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Could not generate sessions.')
              }
            },
          },
        ] : []}
        loadingMessage="Loading schedules..."
        emptyMessage="No schedule has been configured for this class."
        errorMessage="Failed to load schedules."
        showPagination
        refetchOnMount="always"
      />
      <RelatedEntityModule<ClassSession & Record<string, unknown>>
        id="module-sessions"
        title="Sessions"
        viewAllTo={`/class-sessions?${new URLSearchParams({ filterLocationId: locationId }).toString()}`}
        queryKey={classSessionsQueryKeys.classType(classTypeId)}
        loadData={(state) => getClassSessionsRequest(state as DataTableState<ClassSession>, {
          locationId,
          classTypeId,
          from: new Date().toISOString(),
        })}
        tableKey={`classes.detail.sessions.${classTypeId}`}
        columns={getClassSessionColumns() as never}
        getRowCommands={(classSession) => [
          { label: 'View session', onClick: () => navigate(`/class-sessions/${classSession.id}?locationId=${encodeURIComponent(locationId)}`) },
          ...(canCancelSessions && (classSession.status === 'SCHEDULED' || classSession.status === 'PAUSED') ? [{
            label: 'Cancel session',
            variant: 'destructive' as const,
            onClick: async () => {
              const confirmed = await Modals.confirm({
                title: 'Cancel this class session?',
                content: 'All bookings will be cancelled. Members with an email address will be notified, and used contract credits will be returned.',
                okText: 'Cancel session',
                cancelText: 'Keep session',
                okButtonProps: { variant: 'destructive' },
              })
              if (!confirmed) return
              try {
                const result = await cancelClassSessionRequest(classSession.id, locationId)
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
                  queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.classType(classTypeId) }),
                ])
                toast.success(`Session cancelled. ${result.bookingCount} booking(s) cancelled; ${result.creditsReturned} credit(s) returned.`)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Could not cancel the class session.')
              }
            },
          }] : []),
        ]}
        loadingMessage="Loading sessions..."
        emptyMessage="No upcoming sessions found for this class."
        errorMessage="Failed to load sessions."
        refetchOnMount="always"
      />
    </DetailPageLayout>
    <ClassTypeEditDrawer classType={editingClassType} open={Boolean(editingClassType)} onOpenChange={(open) => { if (!open) setEditingClassType(null) }} />
    <ClassScheduleCreateDrawer classType={editableClassType} open={isScheduleDrawerOpen} onOpenChange={setIsScheduleDrawerOpen} />
    <ClassScheduleEditDrawer schedule={editingSchedule} classType={editableClassType} locationId={locationId} open={Boolean(editingSchedule)} onOpenChange={(open) => { if (!open) setEditingSchedule(null) }} />
  </>
}
