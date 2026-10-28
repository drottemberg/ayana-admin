import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'

import { AsyncFilterDropdown, DataTableAsync, type DataTableFilter, type DataTableState } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownActionsMenu } from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import { getCustomerFilterOptionsRequest, getCustomerRequest } from '@/features/customers/api'
import { getSalesReportLocationsRequest, getSalesReportRequest, type SalesReport, type SalesReportEntry } from '@/features/reports/api'
import { getLocalStorage, setLocalStorage } from '@/utils/storage-utils'

type PeriodPreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'MONTH_TO_DATE' | 'LAST_MONTH' | 'YEAR_TO_DATE' | 'LAST_YEAR' | 'CUSTOM'
type SalesReportRow = SalesReportEntry & Record<string, unknown>
type SalesReportSavedFilters = { period: PeriodPreset; customerId?: string; customerName?: string; locationId?: string; locationName?: string; dateFrom?: string; dateTo?: string }

const SALES_REPORT_FILTERS_KEY = 'sales-report.filters'

const periodItems: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'TODAY', label: 'Today' },
  { value: 'YESTERDAY', label: 'Yesterday' },
  { value: 'LAST_7_DAYS', label: 'Last 7 days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days' },
  { value: 'MONTH_TO_DATE', label: 'Month to date' },
  { value: 'LAST_MONTH', label: 'Last month' },
  { value: 'YEAR_TO_DATE', label: 'Year to date' },
  { value: 'LAST_YEAR', label: 'Last year' },
  { value: 'CUSTOM', label: 'Custom range' },
]

const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const shiftDate = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const currency = (amount: number, code: string) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).format(amount)
const percent = (rate: number) => new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 2 }).format(rate)
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`

function datesForPreset(preset: Exclude<PeriodPreset, 'CUSTOM'>, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (preset) {
    case 'TODAY': return { from: dateString(today), to: dateString(today) }
    case 'YESTERDAY': {
      const yesterday = shiftDate(today, -1)
      return { from: dateString(yesterday), to: dateString(yesterday) }
    }
    case 'LAST_7_DAYS': return { from: dateString(shiftDate(today, -6)), to: dateString(today) }
    case 'LAST_30_DAYS': return { from: dateString(shiftDate(today, -29)), to: dateString(today) }
    case 'MONTH_TO_DATE': return { from: dateString(new Date(today.getFullYear(), today.getMonth(), 1)), to: dateString(today) }
    case 'LAST_MONTH': return {
      from: dateString(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to: dateString(new Date(today.getFullYear(), today.getMonth(), 0)),
    }
    case 'YEAR_TO_DATE': return { from: dateString(new Date(today.getFullYear(), 0, 1)), to: dateString(today) }
    case 'LAST_YEAR': return { from: `${today.getFullYear() - 1}-01-01`, to: `${today.getFullYear() - 1}-12-31` }
  }
}

function readPeriod(params: URLSearchParams): PeriodPreset {
  const value = params.get('period')
  return periodItems.some((item) => item.value === value) ? value as PeriodPreset : 'YEAR_TO_DATE'
}

function displayDateRange(from: string, to: string) {
  if (!from || !to) return 'Choose a start and end date'
  const format = (value: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
  return `${format(from)} – ${format(to)}`
}

function getRowType(type: SalesReportEntry['type']) {
  return type === 'REFUND' ? 'Refund' : type === 'STRIPE_FEE' ? 'Payment processing fee' : 'Sale'
}

function downloadCsv(report: SalesReport, entries = report.entries) {
  const rows: unknown[][] = [
    ['Section', 'Date', 'Type', 'Order', 'Client', 'Location', 'VAT rate', 'Net sales', 'VAT', 'Gross', 'Currency'],
    ...report.vatBreakdown.map((item) => ['VAT', `${report.from} – ${report.to}`, 'NET SALES', '', '', '', percent(item.vatRate), item.net, item.vat, item.gross, item.currency]),
    ...entries.map((item) => [
      'Transaction', new Date(item.date).toISOString(), item.type === 'STRIPE_FEE' ? 'PAYMENT PROCESSING FEE' : item.type,
      item.orderCode ?? item.orderId ?? '', item.customerName ?? '', item.locationName,
      item.vatAllocated ? 'Allocated by order VAT rates' : 'Unallocated', '', '', item.type === 'SALE' ? item.amount : -item.amount, item.currency,
    ]),
  ]
  const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `ayana-sales-${report.from}-${report.to}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function SalesReportPage() {
  const { session } = useConnect()
  const [searchParams, setSearchParams] = useSearchParams()
  const isAdmin = getAppMode() === 'admin'
  const activeCustomerId = session?.currentOrganization?.id ?? undefined
  const searchParamsString = searchParams.toString()
  const periodPreset = readPeriod(searchParams)
  const customFrom = searchParams.get('dateFrom') ?? ''
  const customTo = searchParams.get('dateTo') ?? ''
  const range = periodPreset === 'CUSTOM' ? { from: customFrom, to: customTo } : datesForPreset(periodPreset)
  const from = range.from
  const to = range.to
  const customerId = isAdmin ? searchParams.get('customerId') ?? '' : ''
  const locationId = searchParams.get('locationId') ?? ''
  const savedFilters = getLocalStorage<SalesReportSavedFilters>(SALES_REPORT_FILTERS_KEY)
  const [savedCustomerName, setSavedCustomerName] = useState(savedFilters?.customerName ?? '')
  const [savedLocationName, setSavedLocationName] = useState(savedFilters?.locationName ?? '')
  const [report, setReport] = useState<SalesReport>()
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState(false)
  const [filtersInitialized, setFiltersInitialized] = useState(false)

  useEffect(() => {
    if (filtersInitialized) return
    const next = new URLSearchParams(searchParamsString)
    const saved = getLocalStorage<SalesReportSavedFilters>(SALES_REPORT_FILTERS_KEY)
    const hasExplicitReportFilters = ['period', 'customerId', 'locationId', 'dateFrom', 'dateTo'].some((key) => next.has(key))
    let changed = false

    if (!hasExplicitReportFilters && saved) {
      next.set('period', saved.period)
      if (isAdmin && saved.customerId) next.set('customerId', saved.customerId)
      if (saved.locationId) next.set('locationId', saved.locationId)
      if (isAdmin && saved.customerName) setSavedCustomerName(saved.customerName)
      if (saved.locationName) setSavedLocationName(saved.locationName)
      if (saved.period === 'CUSTOM' && saved.dateFrom) {
        next.set('dateFrom', saved.dateFrom)
        if (saved.dateTo) next.set('dateTo', saved.dateTo)
      }
      changed = true
    }

    if (!next.has('period')) {
      next.set('period', saved?.period ?? 'YEAR_TO_DATE')
      changed = true
    }
    if (isAdmin && next.get('customerId') === saved?.customerId && saved?.customerName) setSavedCustomerName(saved.customerName)
    if (next.get('locationId') === saved?.locationId && saved?.locationName) setSavedLocationName(saved.locationName)
    if (next.get('period') === 'CUSTOM' && !next.has('dateFrom') && saved?.period === 'CUSTOM' && saved.dateFrom) {
      next.set('dateFrom', saved.dateFrom)
      if (saved.dateTo) next.set('dateTo', saved.dateTo)
      changed = true
    }

    if (changed) {
      setSearchParams(next, { replace: true })
      return
    }
    setFiltersInitialized(true)
  }, [filtersInitialized, isAdmin, searchParamsString, setSearchParams])

  useEffect(() => {
    if (!filtersInitialized) return
    setLocalStorage<SalesReportSavedFilters>(SALES_REPORT_FILTERS_KEY, {
      period: periodPreset,
      ...(isAdmin && customerId ? { customerId } : {}),
      ...(isAdmin && customerId && savedCustomerName ? { customerName: savedCustomerName } : {}),
      ...(locationId ? { locationId } : {}),
      ...(locationId && savedLocationName ? { locationName: savedLocationName } : {}),
      ...(periodPreset === 'CUSTOM' && customFrom ? { dateFrom: customFrom } : {}),
      ...(periodPreset === 'CUSTOM' && customTo ? { dateTo: customTo } : {}),
    })
  }, [customerId, customFrom, customTo, filtersInitialized, isAdmin, locationId, periodPreset, savedCustomerName, savedLocationName])

  const selectedCustomerQuery = useQuery({
    queryKey: ['reports', 'sales', 'selected-customer', customerId],
    queryFn: () => getCustomerRequest(customerId),
    enabled: isAdmin && Boolean(customerId),
    staleTime: 30_000,
  })

  const locationsQuery = useQuery({
    queryKey: ['reports', 'sales', 'locations', isAdmin, activeCustomerId, customerId],
    queryFn: () => getSalesReportLocationsRequest(isAdmin ? customerId || undefined : undefined),
    enabled: filtersInitialized,
    staleTime: 30_000,
  })
  const reportFilters = useMemo<DataTableFilter<SalesReportRow>[]>(() => [
    ...(isAdmin ? [{
      id: 'customerId',
      label: 'Customer',
      column: 'customerId',
      selectionMode: 'single' as const,
      queryFn: getCustomerFilterOptionsRequest,
      getValue: (row: SalesReportRow) => row.customerId,
    }] : []),
    {
      id: 'locationId',
      label: 'Location',
      column: 'locationId',
      selectionMode: 'single' as const,
      cacheKey: `${isAdmin ? customerId : activeCustomerId ?? ''}`,
      queryFn: async (search: string, page: number) => {
        const locations = await getSalesReportLocationsRequest(isAdmin ? customerId || undefined : activeCustomerId)
        const term = search.trim().toLocaleLowerCase()
        const filtered = locations.filter((location) => {
          const label = isAdmin && !customerId && location.customerName
            ? `${location.name} · ${location.customerName}`
            : location.name
          return !term || label.toLocaleLowerCase().includes(term)
        })
        const start = (page - 1) * 30
        return {
          items: filtered.slice(start, start + 30).map((location) => ({
            id: location.id,
            label: isAdmin && !customerId && location.customerName
              ? `${location.name} · ${location.customerName}`
              : location.name,
          })),
          total: filtered.length,
        }
      },
      getValue: (row: SalesReportRow) => row.locationId,
    },
  ], [activeCustomerId, customerId, isAdmin])

  const selectedLabelsById = useMemo(() => ({
    ...(customerId ? {
      [customerId]: selectedCustomerQuery.data?.name
        ?? (savedFilters?.customerId === customerId ? savedCustomerName : ''),
    } : {}),
    ...(locationId ? {
      [locationId]: (() => {
        const location = locationsQuery.data?.find((item) => item.id === locationId)
        return location
          ? isAdmin && !customerId && location.customerName
            ? `${location.name} · ${location.customerName}`
            : location.name
          : savedFilters?.locationId === locationId ? savedLocationName : ''
      })(),
    } : {}),
  }), [customerId, isAdmin, locationId, locationsQuery.data, savedCustomerName, savedLocationName, savedFilters?.customerId, savedFilters?.locationId, selectedCustomerQuery.data?.name])

  useEffect(() => {
    if (selectedCustomerQuery.data?.name) setSavedCustomerName(selectedCustomerQuery.data.name)
  }, [selectedCustomerQuery.data?.name])
  useEffect(() => {
    const location = locationsQuery.data?.find((item) => item.id === locationId)
    if (!location) return
    setSavedLocationName(isAdmin && !customerId && location.customerName
      ? `${location.name} · ${location.customerName}`
      : location.name)
  }, [customerId, isAdmin, locationId, locationsQuery.data])

  useEffect(() => {
    if (!locationId || !locationsQuery.data) return
    if (locationsQuery.data.some((location) => location.id === locationId)) return
    const next = new URLSearchParams(searchParams)
    next.delete('locationId')
    next.delete('p')
    setSearchParams(next, { replace: true })
  }, [locationId, locationsQuery.data, searchParams, setSearchParams])

  const reportScope = JSON.stringify([from, to, isAdmin ? customerId : activeCustomerId, locationId])
  const currentReportScope = useRef(reportScope)
  currentReportScope.current = reportScope

  useEffect(() => setReport(undefined), [reportScope])

  const columns = useMemo<ColumnDef<SalesReportRow>[]>(() => [
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span className="whitespace-nowrap">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.original.date))}</span> },
    { accessorKey: 'type', header: 'Type', cell: ({ row }) => getRowType(row.original.type) },
    { accessorKey: 'orderCode', header: 'Order', cell: ({ row }) => row.original.orderId
      ? <Link to={`/orders/${row.original.orderId}`} className="font-medium underline-offset-2 hover:underline">{row.original.orderCode ?? row.original.orderId}</Link>
      : row.original.orderCode ?? '—' },
    { accessorKey: 'customerName', header: 'User', cell: ({ row }) => row.original.userId
      ? <Link to={`/users/${row.original.userId}`} title={row.original.userId} className="underline-offset-2 hover:underline">{row.original.customerName ?? row.original.userId}</Link>
      : row.original.customerName ?? 'Guest' },
    { accessorKey: 'locationName', header: 'Location' },
    { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => <span className={`block text-right tabular-nums ${row.original.type !== 'SALE' ? 'text-destructive' : ''}`}>{row.original.type !== 'SALE' ? '−' : ''}{currency(row.original.amount, row.original.currency)}</span> },
    { accessorKey: 'vatAllocated', header: 'VAT detail', cell: ({ row }) => row.original.type === 'STRIPE_FEE' ? 'Processing fee' : row.original.vatAllocated ? 'Order VAT rates' : 'Unallocated' },
  ], [])

  const loadEntries = async (state: DataTableState<SalesReportRow>) => {
    if (!from || !to || from > to) return { items: [], count: 0, pageCount: 0 }
    const requestedCustomerId = isAdmin ? customerId : activeCustomerId ?? ''
    const requestedLocationId = locationId
    const requestedScope = JSON.stringify([from, to, requestedCustomerId, requestedLocationId])
    const result = await getSalesReportRequest({
      from,
      to,
      ...(isAdmin && requestedCustomerId ? { customerId: requestedCustomerId } : {}),
      ...(requestedLocationId ? { locationId: requestedLocationId } : {}),
      page: state.pagination.pageIndex + 1,
      limit: state.pagination.pageSize,
      search: state.search.trim() || undefined,
    })
    if (requestedScope === currentReportScope.current) setReport(result)
    return {
      items: result.entries as SalesReportRow[],
      count: result.pagination.total,
      pageCount: result.pagination.pageCount,
    }
  }

  const setCustomer = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value && value !== '__all__') next.set('customerId', value)
    else next.delete('customerId')
    next.delete('locationId')
    next.delete('p')
    setSavedLocationName('')
    setSearchParams(next, { replace: true })
  }

  const setLocation = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value && value !== '__all__') next.set('locationId', value)
    else next.delete('locationId')
    next.delete('p')
    setSearchParams(next, { replace: true })
  }

  const setPeriod = (preset: PeriodPreset) => {
    const next = new URLSearchParams(searchParams)
    next.set('period', preset)
    next.delete('p')
    if (preset !== 'CUSTOM') {
      next.delete('dateFrom')
      next.delete('dateTo')
    } else {
      next.set('dateFrom', customFrom || dateString(new Date()))
      next.set('dateTo', customTo || dateString(new Date()))
    }
    setSearchParams(next, { replace: true })
  }

  const setCustomDateRange = (value?: DateRangeValue) => {
    const next = new URLSearchParams(searchParams)
    if (value?.from) next.set('dateFrom', value.from)
    else next.delete('dateFrom')
    if (value?.to) next.set('dateTo', value.to)
    else next.delete('dateTo')
    next.delete('p')
    setSearchParams(next, { replace: true })
  }

  const resetReportFilters = () => {
    const next = new URLSearchParams(searchParams)
    next.set('period', 'YEAR_TO_DATE')
    next.delete('customerId')
    next.delete('locationId')
    next.delete('dateFrom')
    next.delete('dateTo')
    next.delete('p')
    setSavedCustomerName('')
    setSavedLocationName('')
    setSearchParams(next, { replace: true })
  }

  const exportFullReport = async () => {
    if (!report || !from || !to) return
    setIsExporting(true)
    setExportError(false)
    try {
      const filters = {
        from,
        to,
        ...(isAdmin && customerId ? { customerId } : {}),
        ...(locationId && locationsQuery.data?.some((location) => location.id === locationId) ? { locationId } : {}),
        search: searchParams.get('q')?.trim() || undefined,
      }
      const allEntries: SalesReport['entries'] = []
      let page = 1
      let pageCount = 1
      while (page <= pageCount) {
        const pageReport = await getSalesReportRequest({ ...filters, page, limit: 5000 })
        allEntries.push(...pageReport.entries)
        pageCount = pageReport.pagination.pageCount
        page += 1
      }
      downloadCsv(report, allEntries)
    } catch {
      setExportError(true)
    } finally {
      setIsExporting(false)
    }
  }

  return <>
    <PageHeader title="Sales report" subtitle="Sales, refunds, VAT and payment processing fees." />
    <section className="p-4 md:p-6">
      <div className="mx-auto flex flex-col gap-5">
        <div className="relative z-20 flex flex-wrap items-center justify-start gap-2">
          <DropdownActionsMenu
            items={periodItems.map((item) => ({
              type: 'checkbox' as const,
              label: item.label,
              checked: periodPreset === item.value,
              onCheckedChange: (checked: boolean) => { if (checked) setPeriod(item.value) },
            }))}
            align="start"
            contentClassName="w-48"
            triggerRender={<Button variant="outline" className="h-9" />}
          >
            {`Period: ${periodItems.find((item) => item.value === periodPreset)?.label ?? 'Year to date'}`}
          </DropdownActionsMenu>
          {periodPreset === 'CUSTOM' ? (
            <DateRangePicker
              value={{ from: customFrom || undefined, to: customTo || undefined }}
              placeholder="Choose dates"
              className="min-w-[230px]"
              onValueChange={setCustomDateRange}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-start gap-2">
            <span className="text-sm text-foreground">Filter by:</span>
            {isAdmin ? <AsyncFilterDropdown
              filter={reportFilters[0] as DataTableFilter<SalesReportRow> & { queryFn: NonNullable<DataTableFilter<SalesReportRow>['queryFn']> }}
              selectedValues={customerId ? [customerId] : []}
              selectedLabelsById={customerId && selectedLabelsById[customerId] ? { [customerId]: selectedLabelsById[customerId] } : {}}
              onToggle={(value, checked, label) => {
                setCustomer(checked ? value : '')
                setSavedCustomerName(checked ? label ?? value : '')
              }}
            /> : null}
            <AsyncFilterDropdown
              filter={reportFilters[isAdmin ? 1 : 0] as DataTableFilter<SalesReportRow> & { queryFn: NonNullable<DataTableFilter<SalesReportRow>['queryFn']> }}
              selectedValues={locationId ? [locationId] : []}
              selectedLabelsById={locationId && selectedLabelsById[locationId] ? { [locationId]: selectedLabelsById[locationId] } : {}}
              onToggle={(value, checked, label) => {
                setLocation(checked ? value : '')
                setSavedLocationName(checked ? label ?? value : '')
              }}
            />
            {(periodPreset !== 'YEAR_TO_DATE' || customerId || locationId) ? (
              <Button variant="ghost" className="h-9 px-2 text-muted-foreground" onClick={resetReportFilters}>Reset</Button>
            ) : null}
          </div>
        </div>
        {selectedCustomerQuery.isError ? <p className="text-sm text-destructive">Could not load the selected customer.</p> : null}
        <div className="flex justify-end">
          {report ? <div className="ml-auto flex items-center gap-3">
            {exportError ? <span role="alert" className="text-sm text-destructive">Could not export the full report.</span> : null}
            <Button variant="outline" disabled={isExporting} onClick={() => void exportFullReport()}>{isExporting ? 'Preparing CSV…' : 'Export CSV'}</Button>
          </div> : null}
        </div>

        {periodPreset === 'CUSTOM' && (!from || !to || from > to)
          ? <p className="text-sm text-muted-foreground">Choose a valid start and end date to load the report.</p>
          : null}
        {report ? <>
          <p className="text-sm text-muted-foreground">{displayDateRange(report.from, report.to)} · Dates use each location’s timezone.</p>

          {report.totals.length ? report.totals.map((total) => <div key={total.currency} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Card size="sm" className="gap-2 rounded-lg bg-muted p-4"><CardDescription>Gross sales · {total.currency}</CardDescription><div className="text-xl font-semibold tabular-nums">{currency(total.gross, total.currency)}</div></Card>
            <Card size="sm" className="gap-2 rounded-lg bg-muted p-4"><CardDescription>Net sales · {total.currency}</CardDescription><div className="text-xl font-semibold tabular-nums">{currency(total.net, total.currency)}</div></Card>
            <Card size="sm" className="gap-2 rounded-lg bg-muted p-4"><CardDescription>VAT collected · {total.currency}</CardDescription><div className="text-xl font-semibold tabular-nums">{currency(total.vat, total.currency)}</div></Card>
            <Card size="sm" className="gap-2 rounded-lg bg-muted p-4"><CardDescription>VAT to allocate · {total.currency}</CardDescription><div className="text-xl font-semibold tabular-nums">{currency(total.unallocatedGross, total.currency)}</div></Card>
            <Card size="sm" className="gap-2 rounded-lg bg-muted p-4"><CardDescription>Payment processing fees · {total.currency}</CardDescription><div className="text-xl font-semibold tabular-nums">{currency(total.stripeFees, total.currency)}</div><p className="text-xs text-muted-foreground">Net after processing fees: {currency(total.netAfterStripeFees, total.currency)}</p></Card>
          </div>) : <Card size="sm" className="rounded-lg bg-muted p-4"><CardDescription>No sales or refunds in this period.</CardDescription></Card>}

          <Card size="sm" className="gap-4 rounded-lg p-0">
            <CardHeader className="p-4 pb-0"><CardTitle className="text-lg">Sales by VAT rate</CardTitle><CardDescription>Based on VAT snapshots saved on order items. Refunds are prorated across the order’s VAT rates.</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>VAT rate</TableHead><TableHead className="text-right">Transactions</TableHead><TableHead className="text-right">Net sales</TableHead><TableHead className="text-right">VAT</TableHead><TableHead className="text-right">Gross sales</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.vatBreakdown.map((row) => <TableRow key={`${row.currency}-${row.vatRate}`}>
                    <TableCell>{percent(row.vatRate)} <span className="text-muted-foreground">· {row.currency}</span></TableCell>
                    <TableCell className="text-right">{row.transactionCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency(row.net, row.currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency(row.vat, row.currency)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{currency(row.gross, row.currency)}</TableCell>
                  </TableRow>)}
                  {!report.vatBreakdown.length ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No VAT-allocated sales.</TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {report.unallocated.length ? <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">Some transactions do not have VAT details attached to order items. They are shown as “VAT to allocate” and excluded from net sales and VAT totals.</p> : null}

          <p className="text-xs text-muted-foreground">{report.note.replaceAll('Stripe fees', 'Payment processing fees')}</p>
        </> : null}

        {filtersInitialized && from && to && from <= to ? <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Transactions</h2>
            <p className="text-sm text-muted-foreground">Payments, refunds and payment processing fees recorded during the selected period.</p>
          </div>
          <DataTableAsync
            queryKey={['reports', 'sales', 'transactions', from, to, isAdmin ? customerId : activeCustomerId, locationId, locationsQuery.isSuccess]}
            loadData={loadEntries}
            refetchOnMount="always"
            tableKey="sales-report.transactions.v2.root"
            columns={columns}
            searchPlaceholder="Search order, user, or location"
            searchColumns={['orderCode', 'customerName', 'locationName', 'type']}
            loadingMessage="Loading transactions..."
            emptyMessage="No transactions found."
            errorMessage="Could not load transactions."
            disabledSelection
          />
        </section> : null}
      </div>
    </section>
  </>
}
