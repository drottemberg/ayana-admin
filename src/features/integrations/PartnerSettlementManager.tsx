import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  allocatePartnerSettlementRequest,
  createPartnerSettlementRequest,
  getPartnerRevenuesRequest,
  getPartnerSettlementsRequest,
  type PartnerRevenueRow,
  type PartnerSettlementRow,
} from './api'

const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const money = (value: number, code: string) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).format(value)

export function PartnerSettlementManager({ customerId, integrationId, integrationName }: { customerId: string; integrationId: string; integrationName?: string }) {
  const [revenues, setRevenues] = useState<PartnerRevenueRow[]>([])
  const [settlements, setSettlements] = useState<PartnerSettlementRow[]>([])
  const [receivedAt, setReceivedAt] = useState(today())
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [reference, setReference] = useState('')
  const [selectedSettlementId, setSelectedSettlementId] = useState('')
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    const [nextRevenues, nextSettlements] = await Promise.all([
      getPartnerRevenuesRequest(customerId, integrationId),
      getPartnerSettlementsRequest(customerId, integrationId),
    ])
    setRevenues(nextRevenues)
    setSettlements(nextSettlements)
    setSelectedSettlementId((current) => current || nextSettlements.find((item) => item.allocatedAmount < item.amount)?.id || '')
  }, [customerId, integrationId])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([getPartnerRevenuesRequest(customerId, integrationId), getPartnerSettlementsRequest(customerId, integrationId)])
      .then(([nextRevenues, nextSettlements]) => {
        if (!active) return
        setRevenues(nextRevenues)
        setSettlements(nextSettlements)
        setSelectedSettlementId(nextSettlements.find((item) => item.allocatedAmount < item.amount)?.id ?? '')
      })
      .catch((error) => { if (active) toast.error(error instanceof Error ? error.message : 'Could not load partner settlements.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [customerId, integrationId])

  const currentSettlement = settlements.find((item) => item.id === selectedSettlementId)
  const allocatable = useMemo(() => revenues.filter((item) => item.amountTtc - item.paidAmount > 0.001
    && (!selectedSettlementId || !item.settlementAllocations.some((allocation) => allocation.settlementId === selectedSettlementId))), [revenues, selectedSettlementId])
  const selectedTotal = Object.values(selected).reduce((sum, value) => sum + (Number(value) || 0), 0)

  const createSettlement = async () => {
    if (!(Number(amount) > 0) || !receivedAt || !/^[A-Z]{3}$/.test(currency.trim().toUpperCase())) {
      toast.error('Enter a date, amount and three-letter currency for the transfer.')
      return
    }
    setLoading(true)
    try {
      const settlement = await createPartnerSettlementRequest(customerId, integrationId, {
        receivedAt,
        amount: Number(amount),
        currency: currency.trim().toUpperCase(),
        ...(reference.trim() ? { externalReference: reference.trim() } : {}),
      })
      setAmount('')
      setReference('')
      setSelectedSettlementId(settlement.id)
      await reload()
      toast.success('Partner transfer recorded. Allocate it to the corresponding sessions.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not record the partner transfer.') }
    finally { setLoading(false) }
  }

  const allocate = async () => {
    if (!currentSettlement || !Object.keys(selected).length) return
    const remaining = currentSettlement.amount - currentSettlement.allocatedAmount
    if (selectedTotal > remaining + 0.001) {
      toast.error(`Selected allocations exceed the unallocated transfer amount (${money(remaining, currentSettlement.currency)}).`)
      return
    }
    setLoading(true)
    try {
      const rows = Object.entries(selected).map(([partnerRevenueId, value]) => ({ partnerRevenueId, amount: Number(value) }))
      const nextSettlements = await allocatePartnerSettlementRequest(customerId, integrationId, currentSettlement.id, rows)
      setSettlements(nextSettlements)
      setRevenues(await getPartnerRevenuesRequest(customerId, integrationId))
      setSelected({})
      toast.success('Transfer allocations saved.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not allocate the transfer.') }
    finally { setLoading(false) }
  }

  return <section className="space-y-3 rounded-lg border border-border p-4">
    <div><h3 className="text-sm font-semibold">Partner transfers{integrationName ? ` · ${integrationName}` : ''}</h3><p className="text-xs text-muted-foreground">Record a bank transfer, then allocate it to the sessions it pays. Partial allocations are supported.</p></div>
    <div className="grid gap-2 md:grid-cols-[1fr_1fr_100px_1.2fr_auto] md:items-end">
      <label className="grid gap-1 text-xs font-medium">Received on<input type="date" className="h-9 rounded-md border bg-background px-3 text-sm" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} /></label>
      <label className="grid gap-1 text-xs font-medium">Amount<input type="number" min="0.01" step="0.01" className="h-9 rounded-md border bg-background px-3 text-sm" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label className="grid gap-1 text-xs font-medium">Currency<input maxLength={3} className="h-9 rounded-md border bg-background px-3 text-sm uppercase" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label>
      <label className="grid gap-1 text-xs font-medium">Partner reference (optional)<input className="h-9 rounded-md border bg-background px-3 text-sm" value={reference} onChange={(event) => setReference(event.target.value)} /></label>
      <Button type="button" disabled={loading} onClick={() => void createSettlement()}>Record transfer</Button>
    </div>
    {settlements.length ? <div className="grid gap-2 md:grid-cols-[1fr_2fr] md:items-end">
      <label className="grid gap-1 text-xs font-medium">Transfer to allocate<select className="h-9 rounded-md border bg-background px-3 text-sm" value={selectedSettlementId} onChange={(event) => setSelectedSettlementId(event.target.value)}>
        <option value="">Choose a transfer</option>
        {settlements.map((item) => <option key={item.id} value={item.id}>{new Date(item.receivedAt).toLocaleDateString('fr-FR')} · {money(item.allocatedAmount, item.currency)} / {money(item.amount, item.currency)}{item.externalReference ? ` · ${item.externalReference}` : ''}</option>)}
      </select></label>
      {currentSettlement ? <p className="text-xs text-muted-foreground">Unallocated: {money(currentSettlement.amount - currentSettlement.allocatedAmount, currentSettlement.currency)}</p> : null}
    </div> : null}
    {loading ? <p className="text-xs text-muted-foreground">Loading partner revenue…</p> : null}
    {currentSettlement ? <>
      <div className="max-h-64 overflow-auto rounded-md border">
        <div className="grid grid-cols-[32px_1fr_110px_110px_140px] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-semibold"><span></span><span>Session</span><span>Status</span><span>Outstanding</span><span>Allocate</span></div>
        {allocatable.filter((item) => item.currency === currentSettlement.currency).map((item) => {
          const outstanding = Math.max(0, item.amountTtc - item.paidAmount)
          const checked = selected[item.id] !== undefined
          return <div key={item.id} className="grid grid-cols-[32px_1fr_110px_110px_140px] items-center gap-2 border-b px-3 py-2 text-xs last:border-0">
            <input type="checkbox" checked={checked} onChange={(event) => setSelected((current) => {
              const next = { ...current }
              if (event.target.checked) next[item.id] = outstanding.toFixed(2)
              else delete next[item.id]
              return next
            })} />
            <span>{new Date(item.sessionStartTime).toLocaleString('fr-FR')} · {item.amountSource === 'EGYM_CONFIGURED_RATE' ? 'Wellpass' : 'ClassPass'}</span>
            <span>{item.status}</span>
            <span>{money(outstanding, item.currency)}</span>
            <input aria-label={`Allocation for ${item.id}`} disabled={!checked} type="number" min="0.01" max={outstanding} step="0.01" className="h-8 rounded-md border bg-background px-2 text-right" value={selected[item.id] ?? ''} onChange={(event) => setSelected((current) => ({ ...current, [item.id]: event.target.value }))} />
          </div>
        })}
        {!allocatable.some((item) => item.currency === currentSettlement.currency) ? <p className="p-3 text-xs text-muted-foreground">No unpaid partner revenue in {currentSettlement.currency}.</p> : null}
      </div>
      <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Selected allocation: {money(selectedTotal, currentSettlement.currency)}</span><Button type="button" size="sm" disabled={loading || selectedTotal <= 0} onClick={() => void allocate()}>Allocate transfer</Button></div>
    </> : null}
    {!loading && !revenues.length ? <p className="text-xs text-muted-foreground">No partner revenue has been generated for completed sessions yet.</p> : null}
  </section>
}
