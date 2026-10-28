import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { getCustomersListRequest } from '@/features/customers/api'
import { getClassSessionColumns } from '@/features/classes/class-session-columns'
import { cancelClassSessionRequest, getClassCategoryOptions, getClassSessionsRequest, getClassTypeLocationOptions, resumeClassSessionRequest } from '@/features/classes/api'
import { CancelSessionConfirmation } from '@/features/classes/CancelSessionConfirmation'
import { ClassSessionEditDrawer } from '@/features/classes/ClassSessionEditDrawer'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import { Modals } from '@/providers/modal'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ClassSession } from '@/types/class-type'
import { getCoachFilterOptionsRequest, releaseCoachSessionRequest } from '@/features/coaches/api'
import { getLocalStorage, setLocalStorage } from '@/utils/storage-utils'

const CLASS_SESSION_DATE_FILTER_KEY = 'class-sessions.date-filter'
type ClassSessionDateFilter = { mode: 'all' | 'today' | 'upcoming' | 'range'; from?: string; to?: string }

function getDateRangeFilters(dateRange?: DateRangeValue) {
  if (!dateRange?.from) return {}

  const from = new Date(`${dateRange.from}T00:00:00`)
  const to = new Date(`${dateRange.to ?? dateRange.from}T00:00:00`)
  to.setDate(to.getDate() + 1)
  to.setMilliseconds(to.getMilliseconds() - 1)

  return { from: from.toISOString(), to: to.toISOString() }
}

function getTodayDateRange(): DateRangeValue {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return { from: `${year}-${month}-${day}` }
}

function readDateFilter(params: URLSearchParams): 'all' | 'today' | 'upcoming' | 'range' {
  const value = params.get('dateMode')
  return value === 'all' || value === 'today' || value === 'range' || value === 'upcoming' ? value : 'upcoming'
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
  const isAdminContext = getAppMode() === 'admin'
  const currentCustomerId = session?.currentOrganization?.id
  const canCancelSessions = Boolean(session?.permissions.classSessions?.delete)
  const canResumeSessions = Boolean(session?.permissions.classSessions?.edit)
  const isInstructor = session?.user.customerMemberships.find((membership) => membership.customerId === currentCustomerId)?.role === 'INSTRUCTOR'
  const currentUserId = String(session?.user.id ?? '')
  const [editingSession, setEditingSession] = useState<ClassSession | null>(null)
  const searchParamsString = searchParams.toString()
  const [tableQueryInitialized, setTableQueryInitialized] = useState(false)
  const [migratedInitialFilters, setMigratedInitialFilters] = useState<Partial<Record<'customerId' | 'locationId' | 'coachId', string[]>>>()

  useEffect(() => {
    if (tableQueryInitialized) return

    const params = new URLSearchParams(searchParamsString)
    let changed = false

    const savedDateFilter = getLocalStorage<ClassSessionDateFilter>(CLASS_SESSION_DATE_FILTER_KEY)
    if (!params.has('dateMode')) {
      params.set('dateMode', savedDateFilter?.mode ?? 'upcoming')
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
    const legacyFilters: Partial<Record<'customerId' | 'locationId' | 'coachId', string[]>> = {}
    for (const key of ['customerId', 'locationId', 'coachId'] as const) {
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

  function updateDateFilter(mode: 'all' | 'today' | 'upcoming' | 'range', range?: DateRangeValue) {
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

  const columns = useMemo(
    () => getClassSessionColumns({ showCustomer: isAdminContext, showLocation: true }),
    [isAdminContext],
  )

  return (
    <>
      <PageHeader
        title="Class sessions"
        subtitle="Review scheduled classes, capacity, and bookings."
        primaryAction={{ children: 'Class types and schedules', onClick: () => navigate('/classes') }}
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
                : dateFilter === 'today'
                  ? getDateRangeFilters(getTodayDateRange())
                  : dateFilter === 'range'
                  ? getDateRangeFilters(dateRange)
                  : {}),
            },
          )}
          refetchOnMount="always"
          tableKey="class-sessions.root"
          initialFilters={migratedInitialFilters}
          columns={columns}
          getRowCommands={(item) => [
            {
              label: 'View session',
              onClick: () => navigate(`/class-sessions/${item.id}?locationId=${encodeURIComponent(item.locationId ?? item.organizationId)}`),
            },
            ...(canResumeSessions && item.status === 'SCHEDULED' ? [{
              label: 'Edit session',
              onClick: () => setEditingSession(item),
            }] : []),
            ...(canCancelSessions && (item.status === 'SCHEDULED' || item.status === 'PAUSED') ? [{
              label: 'Cancel session',
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
          searchPlaceholder="Search by class, session, or coach"
          searchColumns={['id', 'className', 'coachName']}
          toolbarExtra={(
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={dateFilter}
                onValueChange={(value) => updateDateFilter(value as 'all' | 'today' | 'upcoming' | 'range')}
              >
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="range">Date range</SelectItem>
                </SelectContent>
              </Select>
              {dateFilter === 'range' && (
                <DateRangePicker
                  value={dateRange}
                  placeholder="Choose dates"
                  className="w-[220px]"
                  onValueChange={(range) => updateDateFilter('range', range)}
                />
              )}
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
            ...(session?.user.customerMemberships.find((membership) => membership.customerId === currentCustomerId)?.role === 'INSTRUCTOR'
              ? []
              : [{
                  id: 'coachId', label: 'Coach', column: 'coachId' as const,
                  selectionMode: 'single' as const,
                  queryFn: getCoachFilterOptionsRequest,
                  getValue: (item: ClassSession) => item.coachId,
                }]),
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
    </>
  )
}
