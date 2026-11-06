import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import { getDashboardOverviewRequest, type DashboardOverview, type DashboardPeriod } from '@/features/reports/api'
import { getLocalStorage, setLocalStorage } from '@/utils/storage-utils'

type SavedHomeFilters = {
  period?: DashboardPeriod
  customerId?: string
  locationId?: string
}

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'TODAY', label: 'Today' },
  { value: 'YESTERDAY', label: 'Yesterday' },
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
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = getAppMode()
  const customerContextId = session?.currentOrganization?.id ?? 'none'
  const filterStorageKey = session?.user.id
    ? `ayana.admin.home.filters.v1:${mode}:${session.user.id}:${mode === 'customer' ? customerContextId : 'all'}`
    : null
  const savedFilters = filterStorageKey ? getLocalStorage<SavedHomeFilters>(filterStorageKey) : null
  const membership = session?.user.customerMemberships.find((item) => item.customerId === session.currentOrganization?.id)
  const defaultPeriod: DashboardPeriod = mode === 'admin' || membership?.role !== 'MANAGER' ? 'LAST_30_DAYS' : 'TODAY'
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

  return <>
    <PageHeader title="Business overview" subtitle="Monitor bookings, occupancy, revenue and active members." />
    <section className="space-y-5 p-4 md:p-6">
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
  </>
}
