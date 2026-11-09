import type { ReactNode } from 'react'
import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DetailCard } from '@/components/app/DetailCard'
import { DetailPageLayout, RelatedEntityModule } from '@/components/app/detail-page-layout'
import { EntityIcon } from '@/components/app/entity-icons'
import type { DataTableState } from '@/components/data-table'
import { getBookingColumns } from '@/features/bookings/booking-columns'
import { BookingListCard } from '@/features/bookings/BookingListCard'
import { bookingsQueryKeys } from '@/features/bookings/query-keys'
import { getBookingsRequest } from '@/features/bookings/api'
import { decideEgym2Booking, getBookingRowActions } from '@/features/bookings/booking-row-actions'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import type { Booking } from '@/types/booking'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import { getDashboardOverviewRequest, type DashboardOverview, type DashboardPeriod } from '@/features/reports/api'
import { getLocalStorage, setLocalStorage } from '@/utils/storage-utils'
import { ALL_LOCATIONS_SCOPE, readSelectedLocationScope } from '@/features/organizations/storage'

type SavedHomeFilters = {
  period?: DashboardPeriod
  customerId?: string
  locationId?: string
}

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'TODAY', label: 'Today' },
  { value: 'YESTERDAY', label: 'Yesterday' },
  { value: 'THIS_WEEK', label: 'This week' },
  { value: 'LAST_WEEK', label: 'Last week' },
  { value: 'LAST_7_DAYS', label: 'Last 7 days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days' },
  { value: 'MONTH_TO_DATE', label: 'This month' },
  { value: 'LAST_MONTH', label: 'Last month' },
]

function isDashboardPeriod(value: string | null): value is DashboardPeriod {
  return periodOptions.some((option) => option.value === value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function formatRange(from: string, to: string) {
  return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

function formatChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? '0%' : 'New'
  const change = ((current - previous) / Math.abs(previous)) * 100
  const rounded = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(Math.abs(change))
  return `${change > 0 ? '+' : change < 0 ? '−' : ''}${rounded}%`
}

function MetricCard({ title, value, comparison, range }: { title: string; value: ReactNode; comparison: ReactNode; range: string }) {
  return <Card className="gap-3 p-5" size="sm">
    <CardHeader className="gap-1 p-0">
      <CardDescription>{title}</CardDescription>
      <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-1 p-0">
      <div className="text-sm font-medium">{comparison}</div>
      <div className="text-xs text-muted-foreground">{range}</div>
    </CardContent>
  </Card>
}

function DashboardMetrics({ data }: { data: DashboardOverview }) {
  const revenueValue = data.revenue.length
    ? <div className="space-y-0.5">{data.revenue.map((item) => <div key={item.currency}>{formatCurrency(item.current, item.currency)}</div>)}</div>
    : '—'
  const revenueComparison = data.revenue.length
    ? <div className="space-y-0.5">{data.revenue.map((item) => <div key={item.currency}>{formatChange(item.current, item.previous)} <span className="font-normal text-muted-foreground">vs {data.comparison.label}</span></div>)}</div>
    : <span className="font-normal text-muted-foreground">No revenue in this period</span>

  const currentOccupancy = data.occupancy.current.rate
  const previousOccupancy = data.occupancy.previous.rate
  const occupancyValue = currentOccupancy == null
    ? '—'
    : new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(currentOccupancy)
  const occupancyComparison = currentOccupancy == null || previousOccupancy == null
    ? <span className="font-normal text-muted-foreground">No scheduled capacity to compare</span>
    : <>{`${(currentOccupancy - previousOccupancy) > 0 ? '+' : ''}${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format((currentOccupancy - previousOccupancy) * 100)} pts`} <span className="font-normal text-muted-foreground">vs {data.comparison.label}</span></>

  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <MetricCard title="Revenue" value={revenueValue} comparison={revenueComparison} range={formatRange(data.current.from, data.current.to)} />
    <MetricCard title="Bookings" value={formatNumber(data.bookings.current)} comparison={<>{formatChange(data.bookings.current, data.bookings.previous)} <span className="font-normal text-muted-foreground">vs {data.comparison.label}</span></>} range={formatRange(data.current.from, data.current.to)} />
    <MetricCard title="Occupancy" value={occupancyValue} comparison={occupancyComparison} range={`${formatRange(data.current.from, data.current.to)} · ${formatNumber(data.occupancy.current.booked)} / ${formatNumber(data.occupancy.current.capacity)} spots`} />
    <MetricCard title="Active members" value={formatNumber(data.activeMembers.current)} comparison={<>{formatChange(data.activeMembers.current, data.activeMembers.previous)} <span className="font-normal text-muted-foreground">vs {data.comparison.label}</span></>} range={`At the end of ${formatDate(data.current.to)}`} />
  </div>
}

export function BusinessOverviewDashboard() {
  const { session } = useConnect()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = getAppMode()
  const customerContextId = session?.currentOrganization?.id ?? 'none'
  const filterStorageKey = session?.user.id
    ? `ayana.admin.home.filters.v1:${mode}:${session.user.id}:${mode === 'customer' ? customerContextId : 'all'}`
    : null
  const savedFilters = filterStorageKey ? getLocalStorage<SavedHomeFilters>(filterStorageKey) : null
  const membership = session?.user.customerMemberships.find((item) => item.customerId === session.currentOrganization?.id)
  const defaultPeriod: DashboardPeriod = mode === 'admin' || membership?.role !== 'MANAGER' ? 'LAST_30_DAYS' : 'TODAY'
  const isCustomerManagerOrAbove = mode === 'customer'
    && ['OWNER', 'ADMIN', 'MANAGER'].includes(membership?.role ?? '')
  const canViewPendingBookings = Boolean(isCustomerManagerOrAbove && session?.permissions.bookings?.view)
  const canEditPendingBookings = Boolean(isCustomerManagerOrAbove && session?.permissions.bookings?.edit)
  const customerHomeModules = useMemo(() => [
    { key: 'summary-report', label: 'Summary Report' },
    ...(canViewPendingBookings ? [{ key: 'pending-bookings', label: 'Pending Bookings' }] : []),
  ], [canViewPendingBookings])
  const locationScope = session?.currentOrganization?.id
    ? readSelectedLocationScope(session.currentOrganization.id)
    : null
  const pendingLocationId = locationScope && locationScope !== ALL_LOCATIONS_SCOPE ? locationScope : undefined
  const requestedPeriod = searchParams.get('period')
  const period = isDashboardPeriod(requestedPeriod)
    ? requestedPeriod
    : savedFilters && isDashboardPeriod(savedFilters.period ?? null)
      ? savedFilters.period
      : defaultPeriod
  const customerId = mode === 'admin'
    ? searchParams.has('customerId')
      ? searchParams.get('customerId') || undefined
      : savedFilters?.customerId
    : undefined
  const locationId = searchParams.has('locationId')
    ? searchParams.get('locationId') || undefined
    : savedFilters?.locationId
  const query = useQuery({
    queryKey: ['reports', 'overview', period, customerId, locationId],
    queryFn: () => getDashboardOverviewRequest({ period, customerId, locationId }),
    enabled: Boolean(session),
  })

  useEffect(() => {
    if (!filterStorageKey) return
    setLocalStorage<SavedHomeFilters>(filterStorageKey, {
      period,
      ...(customerId ? { customerId } : {}),
      ...(locationId ? { locationId } : {}),
    })
  }, [filterStorageKey, period, customerId, locationId])

  const setPeriod = (value: DashboardPeriod) => {
    const next = new URLSearchParams(searchParams)
    next.set('period', value)
    setSearchParams(next)
    if (filterStorageKey) {
      setLocalStorage<SavedHomeFilters>(filterStorageKey, {
        period: value,
        ...(customerId ? { customerId } : {}),
        ...(locationId ? { locationId } : {}),
      })
    }
  }

  const summaryContent = <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Performance</h2>
          {query.data ? <p className="text-sm text-muted-foreground">{formatRange(query.data.current.from, query.data.current.to)} compared with {query.data.comparison.label} ({formatRange(query.data.comparison.from, query.data.comparison.to)})</p> : null}
        </div>
        <Select value={period} onValueChange={(value) => setPeriod(value as DashboardPeriod)}>
          <SelectTrigger className="w-[180px]" aria-label="Select dashboard period"><SelectValue /></SelectTrigger>
          <SelectContent>{periodOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {query.isPending ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{periodOptions.slice(0, 4).map((option) => <Skeleton key={option.value} className="h-32 rounded-xl" />)}</div> : null}
      {query.isError ? <Card className="border-destructive/30 p-5" size="sm"><p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : 'Could not load business overview.'}</p></Card> : null}
      {query.data ? <DashboardMetrics data={query.data} /> : null}
    </section>

  if (isCustomerManagerOrAbove) {
    const invalidateBookingViews = async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
    ])

    return <DetailPageLayout
      header={{ title: 'Home', subtitle: 'Your studio activity.' }}
      modules={customerHomeModules}
      aside={null}
    >
      <DetailCard id="module-summary-report" icon={EntityIcon.data} title="Summary Report">
        {summaryContent}
      </DetailCard>
      {canViewPendingBookings ? <RelatedEntityModule<Booking & Record<string, unknown>>
        id="module-pending-bookings"
        title="Pending Bookings"
        icon={EntityIcon.classes}
        columns={getBookingColumns({ showUser: true, showLocation: true }) as ColumnDef<Booking & Record<string, unknown>>[]}
        renderCard={(booking, actions) => <BookingListCard booking={booking} actions={actions} />}
        queryKey={[...bookingsQueryKeys.all, 'home', 'pending-approval', customerContextId, pendingLocationId]}
        loadData={async (state: DataTableState<Booking & Record<string, unknown>>) => {
          const result = await getBookingsRequest(state as DataTableState<Booking>, {
            customerId: [customerContextId],
            status: ['PENDING_APPROVAL'],
            ...(pendingLocationId ? { locationId: [pendingLocationId] } : {}),
          })
          return { ...result, items: result.items as Array<Booking & Record<string, unknown>> }
        }}
        getRowCommands={(booking) => getBookingRowActions({
          status: booking.status,
          canEdit: canEditPendingBookings,
          canCreate: false,
          isPast: Boolean(booking.startsAt && new Date(booking.startsAt).getTime() < Date.now()),
          source: booking.source,
          onCancel: () => undefined,
          onRebook: () => undefined,
          onSetAttendance: () => undefined,
          onCancelClassPass: () => undefined,
          onEgym2Decision: (action) => { void decideEgym2Booking(booking.id, booking.location.id, action, invalidateBookingViews) },
        })}
        tableKey="home.pending-bookings"
        emptyMessage="No bookings are waiting for approval."
        loadingMessage="Loading pending bookings…"
        errorMessage="Could not load pending bookings."
        pageSize={5}
        refetchOnMount="always"
      /> : null}
    </DetailPageLayout>
  }

  return <>
    <PageHeader title="Business overview" subtitle="Monitor bookings, occupancy, revenue and active members." />
    <section className="space-y-5 p-4 md:p-6">{summaryContent}</section>
  </>
}
