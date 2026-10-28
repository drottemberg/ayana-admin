import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'

import { AsyncFilterDropdown, type DataTableFilter } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownActionsMenu } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TablePagination } from '@/components/table-pagination'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import { getCustomerFilterOptionsRequest, getCustomerRequest } from '@/features/customers/api'
import { getSalesReportLocationsRequest, getSalesReportRequest, type SalesReport, type SalesReportEntry } from '@/features/reports/api'
import { getLocalStorage, setLocalStorage } from '@/utils/storage-utils'

type PeriodPreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'MONTH_TO_DATE' | 'LAST_MONTH' | 'YEAR_TO_DATE' | 'LAST_YEAR' | 'CUSTOM'
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
  const entriesPage = Math.max(1, Number(searchParams.get('p')) || 1)
  const transactionSearch = searchParams.get('q')?.trim() ?? ''
  const savedFilters = getLocalStorage<SalesReportSavedFilters>(SALES_REPORT_FILTERS_KEY)
  const [savedCustomerName, setSavedCustomerName] = useState(savedFilters?.customerName ?? '')
  const [savedLocationName, setSavedLocationName] = useState(savedFilters?.locationName ?? '')
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
  const reportQuery = useQuery({
    queryKey: ['reports', 'sales', from, to, isAdmin ? customerId : activeCustomerId, locationId, entriesPage, transactionSearch],
    queryFn: () => getSalesReportRequest({
      from,
      to,
      ...(isAdmin && customerId ? { customerId } : {}),
      ...(locationId ? { locationId } : {}),
      page: entriesPage,
      limit: 50,
      ...(transactionSearch ? { search: transactionSearch } : {}),
    }),
    enabled: filtersInitialized && Boolean(from && to && from <= to),
  })
  const report = reportQuery.data

  const reportFilters = useMemo<DataTableFilter<SalesReportEntry & Record<string, unknown>>[]>(() => [
    ...(isAdmin ? [{
      id: 'customerId',
      label: 'Customer',
      column: 'customerId',
      selectionMode: 'single' as const,
      queryFn: getCustomerFilterOptionsRequest,
      getValue: (row: SalesReportEntry & Record<string, unknown>) => row.customerId,
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
      getValue: (row: SalesReportEntry & Record<string, unknown>) => row.locationId,
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

  const setTransactionsPage = (page: number) => {
    const next = new URLSearchParams(searchParams)
    if (page > 1) next.set('p', String(page))
    else next.delete('p')
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    const pageCount = reportQuery.data?.pagination.pageCount
    if (pageCount === undefined || entriesPage <= Math.max(pageCount, 1)) return
    setTransactionsPage(Math.max(pageCount, 1))
  }, [entriesPage, reportQuery.data])

  const setTransactionSearch = (value: string) => {
    const next = new URLSearchParams(searchParams)
    const search = value.trimStart()
    if (search) next.set('q', search)
    else next.delete('q')
    next.delete('p')
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
              filter={reportFilters[0] as DataTableFilter<SalesReportEntry & Record<string, unknown>> & { queryFn: NonNullable<DataTableFilter<SalesReportEntry & Record<string, unknown>>['queryFn']> }}
              selectedValues={customerId ? [customerId] : []}
              selectedLabelsById={customerId && selectedLabelsById[customerId] ? { [customerId]: selectedLabelsById[customerId] } : {}}
              onToggle={(value, checked, label) => {
                setCustomer(checked ? value : '')
                setSavedCustomerName(checked ? label ?? value : '')
              }}
            /> : null}
            <AsyncFilterDropdown
              filter={reportFilters[isAdmin ? 1 : 0] as DataTableFilter<SalesReportEntry & Record<string, unknown>> & { queryFn: NonNullable<DataTableFilter<SalesReportEntry & Record<string, unknown>>['queryFn']> }}
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
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
            <h2 className="text-lg font-semibold">Transactions</h2>
            <p className="text-sm text-muted-foreground">Payments, refunds and payment processing fees recorded during the selected period.</p>
            </div>
            <Input value={searchParams.get('q') ?? ''} onChange={(event) => setTransactionSearch(event.target.value)} placeholder="Search order, user, or location" className="w-full md:max-w-80" />
          </div>
          <Card size="sm" className="gap-0 rounded-lg p-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto rounded-lg">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Order</TableHead><TableHead>User</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>VAT detail</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {report?.pagination.page === entriesPage && report.entries.map((entry) => <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(entry.date))}</TableCell>
                      <TableCell>{getRowType(entry.type)}</TableCell>
                      <TableCell>{entry.orderId
                        ? <Link to={`/orders/${entry.orderId}`} className="font-medium underline-offset-2 hover:underline">{entry.orderCode ?? entry.orderId}</Link>
                        : entry.orderCode ?? '—'}</TableCell>
                      <TableCell>{entry.userId
                        ? <Link to={`/users/${entry.userId}`} title={entry.userId} className="underline-offset-2 hover:underline">{entry.customerName ?? entry.userId}</Link>
                        : entry.customerName ?? 'Guest'}</TableCell>
                      <TableCell>{entry.locationName}</TableCell>
                      <TableCell className={`text-right tabular-nums ${entry.type !== 'SALE' ? 'text-destructive' : ''}`}>{entry.type !== 'SALE' ? '−' : ''}{currency(entry.amount, entry.currency)}</TableCell>
                      <TableCell>{entry.type === 'STRIPE_FEE' ? 'Processing fee' : entry.vatAllocated ? 'Order VAT rates' : 'Unallocated'}</TableCell>
                    </TableRow>)}
                    {reportQuery.isFetching && report?.pagination.page !== entriesPage ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading transactions…</TableCell></TableRow> : null}
                    {reportQuery.isError ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-destructive">Could not load transactions.</TableCell></TableRow> : null}
                    {!reportQuery.isFetching && !reportQuery.isError && report?.pagination.page === entriesPage && !report.entries.length ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No transactions found.</TableCell></TableRow> : null}
                  </TableBody>
                </Table>
              </div>
              {report?.pagination.page === entriesPage && report.pagination.pageCount > 1 ? <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">{((entriesPage - 1) * report.pagination.limit) + 1}–{Math.min(entriesPage * report.pagination.limit, report.pagination.total)} of {report.pagination.total} transactions</p>
                <TablePagination
                  pageIndex={entriesPage - 1}
                  pageCount={report.pagination.pageCount}
                  canPreviousPage={entriesPage > 1}
                  canNextPage={entriesPage < report.pagination.pageCount}
                  onPreviousPage={() => setTransactionsPage(Math.max(1, entriesPage - 1))}
                  onNextPage={() => setTransactionsPage(Math.min(report.pagination.pageCount, entriesPage + 1))}
                  onPageChange={(page) => setTransactionsPage(page + 1)}
                />
              </div> : null}
            </CardContent>
          </Card>
        </section> : null}
      </div>
    </section>
  </>
}
