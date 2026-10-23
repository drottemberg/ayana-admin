import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { PageHeader } from '@/components/ui/page-header'
import { SelectInput, SelectInputAsync } from '@/components/ui/select-input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import { getCustomersListRequest } from '@/features/customers/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { getSalesReportLocationsRequest, getSalesReportRequest, type SalesReport } from '@/features/reports/api'
import type { Customer } from '@/types/customer'

type PeriodPreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'MONTH_TO_DATE' | 'LAST_MONTH' | 'YEAR_TO_DATE' | 'LAST_YEAR' | 'CUSTOM'

const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const shiftDate = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const currency = (amount: number, code: string) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).format(amount)
const percent = (rate: number) => new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 2 }).format(rate)
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`

const periodItems = [
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

function displayDateRange(from: string, to: string) {
  if (!from || !to) return 'Choose a start and end date'
  const format = (value: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
  return `${format(from)} – ${format(to)}`
}

function downloadCsv(report: SalesReport) {
  const rows: unknown[][] = [
    ['Section', 'Date', 'Type', 'Order', 'Client', 'Location', 'VAT rate', 'Net sales', 'VAT', 'Gross', 'Currency'],
    ...report.vatBreakdown.map((item) => ['VAT', `${report.from} – ${report.to}`, 'NET SALES', '', '', '', percent(item.vatRate), item.net, item.vat, item.gross, item.currency]),
    ...report.entries.map((item) => [
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
  const isAdmin = getAppMode() === 'admin'
  const activeCustomerId = session?.currentOrganization?.id ?? undefined
  const initialRange = datesForPreset('YEAR_TO_DATE')
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('YEAR_TO_DATE')
  const [customerId, setCustomerId] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>()
  const [locationId, setLocationId] = useState('')

  const locationsQuery = useQuery({
    queryKey: ['reports', 'sales', 'locations', isAdmin, activeCustomerId, customerId],
    queryFn: () => getSalesReportLocationsRequest(isAdmin ? customerId || undefined : undefined),
  })
  const reportQuery = useQuery({
    queryKey: ['reports', 'sales', from, to, isAdmin ? customerId : activeCustomerId, locationId],
    queryFn: () => getSalesReportRequest({
      from,
      to,
      ...(isAdmin ? (customerId ? { customerId } : {}) : {}),
      ...(locationId ? { locationId } : {}),
    }),
    enabled: Boolean(from && to && from <= to),
    staleTime: 0,
  })

  const locationItems = useMemo(() => [
    { value: '__all__', label: isAdmin && !customerId ? 'All locations' : 'All accessible locations' },
    ...(locationsQuery.data ?? []).map((location) => ({
      value: location.id,
      label: isAdmin && !customerId && location.customerName ? `${location.name} · ${location.customerName}` : location.name,
    })),
  ], [customerId, isAdmin, locationsQuery.data])

  const applyPreset = (value: string) => {
    const preset = value as PeriodPreset
    setPeriodPreset(preset)
    if (preset === 'CUSTOM') return
    const range = datesForPreset(preset)
    setFrom(range.from)
    setTo(range.to)
  }

  const report = reportQuery.data

  return <>
    <PageHeader title="Sales report" subtitle="Sales, refunds, VAT and payment processing fees." />
    <section className="px-6 pb-8 md:px-8">
      <div className="mx-auto flex flex-col gap-5">
        <Card size="sm" className="relative z-20 gap-4 overflow-visible rounded-lg bg-muted p-4">
          <CardHeader className="p-0">
            <CardTitle className="text-lg">Report filters</CardTitle>
            <CardDescription>Choose a reporting period, customer and location.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-0 md:grid-cols-2 xl:grid-cols-4">
            {isAdmin ? <SelectInputAsync<Customer>
              label="Customer"
              placeholder="All customers"
              queryKey={[...customersQueryKeys.all, 'sales-report-picker']}
              queryFn={(search) => getCustomersListRequest({ contractId: undefined }, search)}
              getOption={(customer) => ({ value: customer.id, label: customer.name })}
              selectedItems={selectedCustomer ? [selectedCustomer] : []}
              value={customerId || undefined}
              onValueChange={(value) => {
                setCustomerId(String(value))
                setLocationId('')
              }}
              onSelectedItemsChange={(items) => setSelectedCustomer(items[0])}
              labelAction={customerId ? <Button variant="ghost" size="xs" onClick={() => { setCustomerId(''); setSelectedCustomer(undefined); setLocationId('') }}>Clear</Button> : undefined}
              loadingMessage="Loading customers…"
              errorMessage="Could not load customers."
              emptyMessage="No customers found."
            /> : null}
            <SelectInput
              label="Location"
              placeholder="All locations"
              searchable
              items={locationItems}
              value={locationId || '__all__'}
              isLoading={locationsQuery.isLoading}
              loadingMessage="Loading locations…"
              emptyMessage={locationsQuery.isError ? 'Could not load locations.' : 'No locations found.'}
              disabled={locationsQuery.isError}
              onValueChange={(value) => setLocationId(String(value) === '__all__' ? '' : String(value))}
            />
            <SelectInput
              label="Period"
              searchable={false}
              items={periodItems}
              value={periodPreset}
              onValueChange={(value) => applyPreset(String(value))}
            />
            {periodPreset === 'CUSTOM' ? <div className="grid gap-1.5 text-sm font-medium">
              <span>Custom dates</span>
              <DateRangePicker
                value={{ from, to: to || undefined }}
                placeholder="Choose date range"
                className="w-full"
                onValueChange={(range) => {
                  setFrom(range?.from ?? '')
                  setTo(range?.to ?? '')
                }}
              />
            </div> : <div className="flex flex-col justify-end gap-1.5 text-sm">
              <span className="font-medium">Selected dates</span>
              <div className="flex h-9 items-center rounded-lg border border-input bg-background px-3 text-muted-foreground">
                {displayDateRange(from, to)}
              </div>
            </div>}
          </CardContent>
        </Card>

        {reportQuery.isLoading ? <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">Loading sales report…</div> : null}
        {reportQuery.isError ? <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Could not load the sales report.</div> : null}
        {report ? <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{displayDateRange(report.from, report.to)} · Dates use each location’s timezone.</p>
            <Button variant="outline" onClick={() => downloadCsv(report)}>Export CSV</Button>
          </div>

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

          <Card size="sm" className="gap-4 rounded-lg p-0">
            <CardHeader className="p-4 pb-0"><CardTitle className="text-lg">Transactions</CardTitle><CardDescription>Payments, refunds and payment processing fees recorded during the selected period.</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>VAT detail</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.entries.map((entry) => <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(entry.date))}</TableCell>
                    <TableCell>{entry.type === 'REFUND' ? 'Refund' : entry.type === 'STRIPE_FEE' ? 'Payment processing fee' : 'Sale'}</TableCell>
                    <TableCell>{entry.orderCode ?? entry.orderId ?? '—'}</TableCell>
                    <TableCell>{entry.customerName ?? 'Guest'}</TableCell>
                    <TableCell>{entry.locationName}</TableCell>
                    <TableCell className={`text-right tabular-nums ${entry.type !== 'SALE' ? 'text-destructive' : ''}`}>{entry.type !== 'SALE' ? '−' : ''}{currency(entry.amount, entry.currency)}</TableCell>
                    <TableCell>{entry.type === 'STRIPE_FEE' ? 'Processing fee' : entry.vatAllocated ? 'Order VAT rates' : 'Unallocated'}</TableCell>
                  </TableRow>)}
                  {!report.entries.length ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No transactions found.</TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">{report.note.replaceAll('Stripe fees', 'Payment processing fees')}</p>
        </> : null}
      </div>
    </section>
  </>
}
