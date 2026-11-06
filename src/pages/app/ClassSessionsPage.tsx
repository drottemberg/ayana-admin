import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon'
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon'
import CalendarRemove01Icon from '@hugeicons/core-free-icons/CalendarRemove01Icon'
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'
import { HugeiconsIcon } from '@hugeicons/react'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { createPageHeaderAction, PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { getCustomersListRequest } from '@/features/customers/api'
import { ClassSessionListCard, getClassSessionColumns } from '@/features/classes/class-session-columns'
import { cancelClassSessionRequest, getClassCategoryOptions, getClassFilterOptionsRequest, getClassSessionsRequest, getClassTypeLocationOptions, reactivateClassSessionRequest, resumeClassSessionRequest } from '@/features/classes/api'
import { CancelSessionConfirmation } from '@/features/classes/CancelSessionConfirmation'
import { ClassSessionEditDrawer } from '@/features/classes/ClassSessionEditDrawer'
import { ClassSessionCreateDrawer } from '@/features/classes/ClassSessionCreateDrawer'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import { Modals } from '@/providers/modal'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import type { ClassSession } from '@/types/class-type'
import { claimCoachSessionRequest, getCoachFilterOptionsRequest, releaseCoachSessionRequest } from '@/features/coaches/api'
import { getLocalStorage, setLocalStorage } from '@/utils/storage-utils'

const CLASS_SESSION_DATE_FILTER_KEY = 'class-sessions.date-filter'
type ClassSessionDateMode = 'all' | 'yesterday' | 'today' | 'upcoming' | 'tomorrow' | 'range'
type ClassSessionDateFilter = { mode: ClassSessionDateMode; from?: string; to?: string }

function getDateRangeFilters(dateRange?: DateRangeValue) {
  if (!dateRange?.from) return {}

  const from = new Date(`${dateRange.from}T00:00:00`)
  const to = new Date(`${dateRange.to ?? dateRange.from}T00:00:00`)
  to.setDate(to.getDate() + 1)
  to.setMilliseconds(to.getMilliseconds() - 1)

  return { from: from.toISOString(), to: to.toISOString() }
}

function getDateRangeForOffset(dayOffset: number): DateRangeValue {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return { from: `${year}-${month}-${day}` }
}

function readDateFilter(params: URLSearchParams): ClassSessionDateMode {
  const value = params.get('dateMode')
  return value === 'all' || value === 'yesterday' || value === 'today' || value === 'range' || value === 'upcoming' || value === 'tomorrow' ? value : 'today'
}

function readDateRange(params: URLSearchParams): DateRangeValue | undefined {
  const from = params.get('dateFrom')
  if (!from) return undefined
  const to = params.get('dateTo')
  return { from, ...(to ? { to } : {}) }
}

export default function ClassSessionsPage() {
  const cancellationMessageRef = useRef<HTMLTextAreaElement>(null)
  const { session } = useConnect()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const dateFilter = readDateFilter(searchParams)
  const dateRange = readDateRange(searchParams)
  const datePickerValue = dateFilter === 'range'
    ? dateRange
    : dateFilter === 'yesterday'
      ? getDateRangeForOffset(-1)
      : dateFilter === 'today'
        ? getDateRangeForOffset(0)
        : dateFilter === 'tomorrow'
          ? getDateRangeForOffset(1)
          : undefined
  const isSingleDayRange = dateFilter === 'range'
    && Boolean(dateRange?.from)
    && (!dateRange?.to || dateRange.to === dateRange.from)
  const showDayNavigation = isSingleDayRange || ['yesterday', 'today', 'tomorrow'].includes(dateFilter)
  const selectedDateIsToday = datePickerValue?.from === getDateRangeForOffset(0).from
    && (!datePickerValue?.to || datePickerValue.to === datePickerValue.from)
  const showTodayButton = !selectedDateIsToday
  const isAdminContext = getAppMode() === 'admin'
  const currentCustomerId = session?.currentOrganization?.id
  const canCancelSessions = Boolean(session?.permissions.classSessions?.delete)
  const canResumeSessions = Boolean(session?.permissions.classSessions?.edit)
  const canCreateSessions = Boolean(session?.permissions.classSessions?.create)
  const isInstructor = session?.user.customerMemberships.find((membership) => membership.customerId === currentCustomerId)?.role === 'INSTRUCTOR'
  const currentUserId = String(session?.user.id ?? '')
  const [editingSession, setEditingSession] = useState<ClassSession | null>(null)
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
  const [claimingSessionId, setClaimingSessionId] = useState<string | null>(null)
  const searchParamsString = searchParams.toString()
  const [tableQueryInitialized, setTableQueryInitialized] = useState(false)
  const [migratedInitialFilters, setMigratedInitialFilters] = useState<Partial<Record<'customerId' | 'locationId' | 'coachId' | 'classTypeId', string[]>>>()

  useEffect(() => {
    if (tableQueryInitialized) return

    const params = new URLSearchParams(searchParamsString)
    let changed = false

    const savedDateFilter = getLocalStorage<ClassSessionDateFilter>(CLASS_SESSION_DATE_FILTER_KEY)
    if (!params.has('dateMode')) {
      params.set('dateMode', savedDateFilter?.mode ?? 'today')
      if (savedDateFilter?.mode === 'range' && savedDateFilter.from) {
        params.set('dateFrom', savedDateFilter.from)
        if (savedDateFilter.to) params.set('dateTo', savedDateFilter.to)
      }
      changed = true
    } else if (
      params.get('dateMode') === 'range' &&
      !params.has('dateFrom') &&
      savedDateFilter?.mode === 'range' &&
      savedDateFilter.from
    ) {
      params.set('dateFrom', savedDateFilter.from)
      if (savedDateFilter.to) params.set('dateTo', savedDateFilter.to)
      changed = true
    }

    // Migrate old filter links before mounting DataTable. It owns the table
    // query params too, so mounting it during this URL update could race and
    // overwrite either the saved filters or the date mode.
    const legacyFilters: Partial<Record<'customerId' | 'locationId' | 'coachId' | 'classTypeId', string[]>> = {}
    for (const key of ['customerId', 'locationId', 'coachId', 'classTypeId'] as const) {
      const legacyKey = `filter${key[0].toUpperCase()}${key.slice(1)}`
      const legacyValue = params.get(legacyKey)
      if (
        legacyValue &&
        !params.has(`f.${key}`) &&
        (key !== 'customerId' || isAdminContext)
      ) {
        legacyFilters[key] = [legacyValue]
      }
      if (params.has(legacyKey)) {
        params.delete(legacyKey)
        changed = true
      }
    }

    if (Object.keys(legacyFilters).length) setMigratedInitialFilters(legacyFilters)
    if (changed) {
      setSearchParams(params, { replace: true })
      return
    }

    setTableQueryInitialized(true)
  }, [isAdminContext, searchParamsString, setSearchParams, tableQueryInitialized])

  useEffect(() => {
    if (!tableQueryInitialized) return
    setLocalStorage<ClassSessionDateFilter>(CLASS_SESSION_DATE_FILTER_KEY, {
      mode: dateFilter,
      ...(dateFilter === 'range' && dateRange?.from ? { from: dateRange.from } : {}),
      ...(dateFilter === 'range' && dateRange?.to ? { to: dateRange.to } : {}),
    })
  }, [dateFilter, dateRange?.from, dateRange?.to, tableQueryInitialized])

  function updateDateFilter(mode: ClassSessionDateMode, range?: DateRangeValue) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('dateMode', mode)
    nextParams.delete('p')
    if (mode === 'range' && range?.from) {
      nextParams.set('dateFrom', range.from)
      if (range.to) nextParams.set('dateTo', range.to)
      else nextParams.delete('dateTo')
    } else {
      nextParams.delete('dateFrom')
      nextParams.delete('dateTo')
    }
    setSearchParams(nextParams, { replace: true })
  }

  function shiftSelectedDay(offset: number) {
    const selectedDate = datePickerValue?.from
    if (!selectedDate) return
    const date = new Date(`${selectedDate}T00:00:00`)
    date.setDate(date.getDate() + offset)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const shiftedDate = `${year}-${month}-${day}`
    if (dateFilter !== 'range') {
      const preset = ([-1, 0, 1] as const).find((dayOffset) => getDateRangeForOffset(dayOffset).from === shiftedDate)
      if (preset === -1) return updateDateFilter('yesterday')
      if (preset === 0) return updateDateFilter('today')
      if (preset === 1) return updateDateFilter('tomorrow')
    }
    updateDateFilter('range', { from: shiftedDate })
  }

  async function claimSession(item: ClassSession) {
    if (claimingSessionId) return
    setClaimingSessionId(item.id)
    try {
      await claimCoachSessionRequest(item.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['coaches'] }),
      ])
      toast.success('Session assigned to you.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not claim this session.')
    } finally {
      setClaimingSessionId(null)
    }
  }

  const columns = useMemo(
    () => getClassSessionColumns({
      showCustomer: isAdminContext,
      showLocation: true,
      allowClaim: isInstructor,
      claimingSessionId,
      onClaim: (item) => { void claimSession(item) },
    }),
    [claimingSessionId, isAdminContext, isInstructor],
  )

  return (
    <>
      <PageHeader
        title="Class sessions"
        subtitle="Review scheduled classes, capacity, and bookings."
        primaryAction={canCreateSessions ? createPageHeaderAction('Add session', () => setIsCreateDrawerOpen(true)) : undefined}
      />
      <section className="p-4 md:p-6">
        {!tableQueryInitialized ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading class sessions...</div>
        ) : <DataTableAsync
          queryKey={[...classSessionsQueryKeys.all, 'table', dateFilter, dateRange?.from, dateRange?.to]}
          loadData={(state: DataTableState<ClassSession>) => getClassSessionsRequest(
            state,
            {
              ...(!isAdminContext && currentCustomerId ? { customerId: currentCustomerId } : {}),
              ...(dateFilter === 'upcoming'
                ? { from: new Date().toISOString() }
                : dateFilter === 'yesterday'
                  ? getDateRangeFilters(getDateRangeForOffset(-1))
                  : dateFilter === 'today'
                    ? getDateRangeFilters(getDateRangeForOffset(0))
                    : dateFilter === 'tomorrow'
                      ? getDateRangeFilters(getDateRangeForOffset(1))
                      : dateFilter === 'range'
                        ? getDateRangeFilters(dateRange)
                        : {}),
            },
          )}
          refetchOnMount="always"
          tableKey="class-sessions.root"
          initialFilters={migratedInitialFilters}
          columns={columns}
          customizeColumns={false}
          renderCard={(item, actions) => (
            <ClassSessionListCard
              session={item}
              actions={actions}
              allowClaim={isInstructor}
              claimingSessionId={claimingSessionId}
              onClaim={claimSession}
            />
          )}
          getRowCommands={(item) => [
            {
              label: 'View session',
              onClick: () => navigate(`/class-sessions/${item.id}?locationId=${encodeURIComponent(item.locationId ?? item.organizationId)}`),
            },
            ...(canResumeSessions && item.status === 'SCHEDULED' ? [{
              label: 'Edit session',
              icon: PencilEdit02Icon,
              onClick: () => setEditingSession(item),
            }] : []),
            ...(canCancelSessions && (item.status === 'SCHEDULED' || item.status === 'PAUSED') ? [{
              label: 'Cancel session',
              icon: CalendarRemove01Icon,
              variant: 'destructive' as const,
              onClick: async () => {
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
                  const result = await cancelClassSessionRequest(item.id, item.locationId ?? item.organizationId, cancellationMessage)
                  await queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all })
                  toast.success(`Session cancelled. ${result.bookingCount} booking(s) cancelled; ${result.creditsReturned} credit(s) returned.`)
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not cancel the class session.')
                }
              },
            }] : []),
            ...(canResumeSessions && item.status === 'CANCELLED' && new Date(item.startTime).getTime() > Date.now() ? [{
              label: 'Reactivate session',
              onClick: async () => {
                const confirmed = await Modals.confirm({ operation: 'reactivate this class session' })
                if (!confirmed) return
                try {
                  await reactivateClassSessionRequest(item.id, item.locationId ?? item.organizationId)
                  await queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all })
                  toast.success('Session reactivated. Previous bookings remain cancelled.')
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not reactivate the session.')
                }
              },
            }] : []),
            ...(canResumeSessions && item.status === 'PAUSED' ? [{
              label: 'Resume session',
              onClick: async () => {
                try {
                  await resumeClassSessionRequest(item.id, item.locationId ?? item.organizationId)
                  await queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all })
                  toast.success('Session resumed. It will stay active through its schedule pause window.')
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not resume the session.')
                }
              },
            }] : []),
            ...(isInstructor && item.coachId === currentUserId && item.status === 'SCHEDULED' && new Date(item.startTime).getTime() >= Date.now() ? [{
              label: 'Request cover',
              onClick: async () => {
                const confirmed = await Modals.confirm({ operation: 'request cover for this session' })
                if (!confirmed) return
                try {
                  await releaseCoachSessionRequest(item.id)
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
                    queryClient.invalidateQueries({ queryKey: ['coaches'] }),
                  ])
                  toast.success('Other qualified coaches have been notified to claim this session.')
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not request a cover.')
                }
              },
            }] : []),
          ]}
          disabledSelection
          toolbarLayout="filters-below"
          searchPlaceholder="Search by class, session, or coach"
          searchColumns={['id', 'className', 'coachName']}
          toolbarExtra={(
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex w-fit shrink-0 flex-nowrap items-center gap-2">
                {showTodayButton && <Button type="button" variant="outline" size="lg" onClick={() => updateDateFilter('today')}>
                  Today
                </Button>}
                <div className="flex w-fit shrink-0 flex-nowrap items-center gap-1">
                  {showDayNavigation && <Button type="button" variant="outline" size="icon" aria-label="Previous day" title="Previous day" onClick={() => shiftSelectedDay(-1)}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                  </Button>}
                  <DateRangePicker
                    value={datePickerValue}
                    placeholder="Choose dates"
                    className="h-9 w-fit min-w-0 shrink-0 whitespace-nowrap px-2"
                    onValueChange={(range) => updateDateFilter(range ? 'range' : 'upcoming', range)}
                  />
                  {showDayNavigation && <Button type="button" variant="outline" size="icon" aria-label="Next day" title="Next day" onClick={() => shiftSelectedDay(1)}>
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                  </Button>}
                </div>
              </div>
            </div>
          )}
          filters={[
            ...(!isAdminContext ? [] : [{
              id: 'customerId',
              label: 'Customer',
              column: 'customerId' as const,
              selectionMode: 'single' as const,
              queryFn: async (search: string) => {
                const customers = await getCustomersListRequest(undefined, search)
                return { items: customers.map((customer) => ({ id: customer.id, label: customer.name })), total: customers.length }
              },
              getValue: (item: ClassSession) => item.customerId,
            }]),
            {
              id: 'locationId',
              label: 'Location',
              column: 'locationId' as const,
              selectionMode: 'single' as const,
              cacheKey: `${isAdminContext ? 'admin' : 'customer'}:${currentCustomerId ?? 'all'}`,
              queryFn: getClassTypeLocationOptions,
              getValue: (item: ClassSession) => item.locationId,
            },
            {
              id: 'coachId', label: 'Coach', column: 'coachId' as const,
              selectionMode: 'single' as const,
              queryFn: getCoachFilterOptionsRequest,
              getValue: (item: ClassSession) => item.coachId,
            },
            {
              id: 'classTypeId', label: 'Class', column: 'classTypeId' as const,
              selectionMode: 'single' as const,
              queryFn: getClassFilterOptionsRequest,
              getValue: (item: ClassSession) => item.classTypeId,
            },
            {
              id: 'category', label: 'Category', column: 'classCategory' as const,
              selectionMode: 'single' as const,
              queryFn: getClassCategoryOptions,
              getValue: (item: ClassSession) => item.classCategory,
            },
            {
              id: 'status', label: 'Status', column: 'status' as const,
              options: ['SCHEDULED', 'PAUSED', 'CANCELLED', 'COMPLETED'],
              getValue: (item: ClassSession) => item.status,
            },
            {
              id: 'type', label: 'Format', column: 'type' as const,
              options: ['GROUP', 'SEMI_PRIVATE', 'PRIVATE'],
              getValue: (item: ClassSession) => item.type,
            },
          ]}
          loadingMessage="Loading class sessions..."
          emptyMessage="No class sessions found."
          errorMessage="Failed to load class sessions."
        />}
      </section>
      {editingSession ? <ClassSessionEditDrawer
        session={editingSession}
        locationId={editingSession.locationId ?? editingSession.organizationId}
        timeZone={editingSession.timezone}
        open
        onOpenChange={(open) => { if (!open) setEditingSession(null) }}
      /> : null}
      {canCreateSessions ? <ClassSessionCreateDrawer open={isCreateDrawerOpen} onOpenChange={setIsCreateDrawerOpen} /> : null}
    </>
  )
}
