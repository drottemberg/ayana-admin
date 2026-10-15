import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DetailPageLayout, DetailSidePanel, type DetailPanelSection } from '@/components/app/detail-page-layout'
import { PageHeader } from '@/components/ui/page-header'
import { useDetailQuery } from '@/lib/query-hooks'
import { cancelOrderRequest, getOrderManagementDetailsRequest } from '@/features/orders/api'
import { ordersQueryKeys } from '@/features/orders/query-keys'
import type { OrderManagementDetails } from '@/types/order'
import { NO_VALUE_STR } from '@/constants'
import { useConnect } from '@/features/app/use-connect'
import { queryClient } from '@/lib/query-client'
import { toast } from 'sonner'

const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : NO_VALUE_STR

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'EUR' }).format(value)
}

function getSections(details?: OrderManagementDetails): DetailPanelSection[] {
  const order = details?.order
  return [{
    title: 'Order details',
    fields: [
      { label: 'Status', value: order ? <Badge variant="outline">{order.status}</Badge> : NO_VALUE_STR },
      { label: 'Payment', value: order ? <Badge variant="outline">{order.paymentStatus}</Badge> : NO_VALUE_STR },
      { label: 'ID', value: order?.id ?? NO_VALUE_STR },
      { label: 'Order code', value: order?.shortCode ?? NO_VALUE_STR },
      { label: 'Type', value: order?.type ?? NO_VALUE_STR },
      { label: 'Source', value: order?.source ?? NO_VALUE_STR },
      { label: 'Fulfilment', value: order?.deliveryType ?? NO_VALUE_STR },
      { label: 'Table', value: order?.tableNumber ?? NO_VALUE_STR },
      { label: 'Pickup number', value: order?.pickupNumber ?? NO_VALUE_STR },
      { label: 'Created', value: formatDateTime(order?.createdAt) },
      { label: 'Updated', value: formatDateTime(order?.updatedAt) },
    ],
  }, {
    title: 'People and location',
    fields: [
      {
        label: 'Customer',
        value: order?.customer ? <Link to={`/customers/${order.customer.id}`} className="underline-offset-2 hover:underline">{order.customer.name}</Link> : NO_VALUE_STR,
      },
      {
        label: 'Location',
        value: order?.location ? <Link to={`/locations/${order.location.id}`} className="underline-offset-2 hover:underline">{order.location.name}</Link> : NO_VALUE_STR,
      },
      {
        label: 'User',
        value: order?.user
          ? <Link to={`/users/${order.user.id}`} className="underline-offset-2 hover:underline">{[order.user.firstName, order.user.lastName].filter(Boolean).join(' ') || order.user.email || order.user.id}</Link>
          : NO_VALUE_STR,
      },
    ],
  }]
}

export default function OrderPage() {
  const { orderId = '' } = useParams()
  const { session } = useConnect()
  const [cancellationOpen, setCancellationOpen] = useState(false)
  const [refundMode, setRefundMode] = useState<'NONE' | 'PARTIAL' | 'FULL'>('NONE')
  const [refundAmount, setRefundAmount] = useState('')
  const [cancellationReason, setCancellationReason] = useState('')
  const [requestKey, setRequestKey] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const { data, isError, isLoading } = useDetailQuery({
    queryKey: ordersQueryKeys.detail(orderId),
    queryFn: () => getOrderManagementDetailsRequest(orderId),
    enabled: Boolean(orderId),
  })

  if (isLoading) {
    return <DetailPageLayout header={{ title: 'Order', subtitle: 'Loading...', backTo: '/orders' }} aside={<DetailSidePanel sections={getSections()} isLoading />}>
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Loading order details...</div>
    </DetailPageLayout>
  }

  if (isError || !data) {
    return <>
      <PageHeader title="Order not found" subtitle={orderId} backTo="/orders" />
      <section className="p-4 md:p-6"><div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Failed to load this order.</div></section>
    </>
  }

  const { order, items, modifiers, history, transactions } = data
  const currency = order.currency || 'EUR'
  const canCancel = Boolean(
    session?.permissions.orders?.delete &&
    order.type === 'PRODUCT' &&
    ['RECEIVED', 'PREPARING', 'READY'].includes(order.status),
  )
  const alreadyRefunded = transactions
    .filter((transaction) => transaction.type === 'REFUND' && transaction.status === 'SUCCEEDED')
    .reduce((total, transaction) => total + Number(transaction.amount), 0)
  const refundableAmount = Math.max(0, Number(order.total) - alreadyRefunded)

  const openCancellation = () => {
    setRefundMode(order.paymentStatus === 'PAID' && refundableAmount > 0 ? 'FULL' : 'NONE')
    setRefundAmount('')
    setCancellationReason('')
    setRequestKey(crypto.randomUUID())
    setCancellationOpen(true)
  }

  const confirmCancellation = async () => {
    const amount = Number(refundAmount)
    if (refundMode === 'PARTIAL' && (!Number.isFinite(amount) || amount <= 0 || amount > refundableAmount)) {
      toast.error(`Enter a refund between 0.01 and ${refundableAmount.toFixed(2)} ${currency}.`)
      return
    }
    setCancelling(true)
    try {
      await cancelOrderRequest(order.id, {
        refundMode,
        ...(refundMode === 'PARTIAL' ? { refundAmount: amount } : {}),
        ...(cancellationReason.trim() ? { reason: cancellationReason.trim() } : {}),
        requestKey,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ordersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ordersQueryKeys.detail(order.id) }),
      ])
      toast.success(refundMode === 'NONE' ? 'Order cancelled.' : 'Order cancelled and refund initiated.')
      setCancellationOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cancel this order.')
    } finally {
      setCancelling(false)
    }
  }

  const header = {
    title: order.shortCode ? `Order ${order.shortCode}` : 'Order details',
    subtitle: order.id,
    backTo: '/orders',
    ...(canCancel ? { primaryAction: { children: 'Cancel / refund…', variant: 'destructive' as const, onClick: openCancellation } } : {}),
  }

  return <>
    <DetailPageLayout
    header={header}
    modules={[{ key: 'items', label: 'Items', count: items.length }, { key: 'history', label: 'History', count: history.length }, { key: 'financial-history', label: 'Financial history', count: transactions.length }]}
    aside={<DetailSidePanel sections={getSections(data)} />}
  >
    <Card id="module-items" className="border border-border p-0 ring-0">
      <CardHeader className="border-b p-5"><CardTitle>Items</CardTitle></CardHeader>
      <CardContent className="p-0">
        {items.length ? <div className="divide-y">
          {items.map((item) => <div key={item.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <p className="font-medium">{item.variantName || [item.productName, item.variantLabel].filter(Boolean).join(' ')}</p>
              <p className="text-sm text-muted-foreground">{item.quantity} × {formatMoney(item.unitPrice, currency)} · VAT {(Number(item.vatRate) * 100).toLocaleString()}%</p>
              {item.notes ? <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p> : null}
              {(modifiers[item.id] ?? []).map((modifier) => <div key={modifier.id} className="flex flex-wrap gap-x-2 text-sm text-muted-foreground">
                <span>+ {modifier.name}</span>
                <span>{modifier.quantity} × {formatMoney(modifier.price, currency)} = {formatMoney(modifier.price * modifier.quantity, currency)}</span>
              </div>)}
            </div>
            <div className="text-right">
              <p className="font-medium">{formatMoney(item.subtotal, currency)}</p>
              <p className="text-xs text-muted-foreground">VAT: {formatMoney(item.vatAmount, currency)}</p>
            </div>
          </div>)}
        </div> : <p className="p-5 text-sm text-muted-foreground">No items on this order.</p>}
        <div className="grid justify-items-end gap-1 border-t px-5 py-4 text-sm">
          <p>Subtotal excl. VAT: {formatMoney(order.totalExclVat, currency)}</p>
          <p>VAT: {formatMoney(order.totalVat, currency)}</p>
          <p className="pt-1 text-base font-semibold">Total incl. VAT: {formatMoney(order.total, currency)}</p>
        </div>
      </CardContent>
    </Card>

    <Card id="module-history" className="border border-border p-0 ring-0">
      <CardHeader className="border-b p-5"><CardTitle>Status history</CardTitle></CardHeader>
      <CardContent className="p-0">
        {history.length ? <ol className="divide-y">
          {history.map((entry, index) => <li key={`${entry.status}-${entry.createdAt}-${index}`} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
            <div><Badge variant="outline">{entry.status}</Badge>{entry.comment ? <p className="mt-2 text-sm text-muted-foreground">{entry.comment}</p> : null}</div>
            <time className="text-sm text-muted-foreground">{formatDateTime(entry.createdAt)}</time>
          </li>)}
        </ol> : <p className="p-5 text-sm text-muted-foreground">No status history recorded.</p>}
      </CardContent>
    </Card>

    <Card id="module-financial-history" className="border border-border p-0 ring-0">
      <CardHeader className="border-b p-5"><CardTitle>Financial history</CardTitle></CardHeader>
      <CardContent className="p-0">
        {transactions.length ? <ol className="divide-y">
          {transactions.map((entry) => <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{entry.type.replaceAll('_', ' ')}</Badge><Badge variant="outline">{entry.status}</Badge></div>
              {entry.reason ? <p className="mt-2 text-sm text-muted-foreground">{entry.reason}</p> : null}
              {entry.externalId ? <p className="mt-1 text-xs text-muted-foreground">Provider reference: {entry.externalId}</p> : null}
            </div>
            <div className="text-right">
              <p className="font-medium">{formatMoney(entry.amount, entry.currency)}</p>
              <time className="text-sm text-muted-foreground">{formatDateTime(entry.createdAt)}</time>
            </div>
          </li>)}
        </ol> : <p className="p-5 text-sm text-muted-foreground">No financial transactions recorded.</p>}
      </CardContent>
    </Card>
    </DetailPageLayout>
    <Dialog open={cancellationOpen} onOpenChange={(open) => { if (!open && !cancelling) setCancellationOpen(false) }}>
      <DialogContent>
        <DialogHeader showCloseButton>
          <DialogTitle>Cancel order {order.shortCode}</DialogTitle>
          <DialogDescription>Cancellation stops fulfilment. Choose whether to refund the payment through Stripe.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Refund
            <select className="h-9 rounded-md border border-input bg-background px-3 font-normal" value={refundMode} onChange={(event) => { setRefundMode(event.target.value as typeof refundMode); setRequestKey(crypto.randomUUID()) }}>
              <option value="NONE">Cancel without refund</option>
              {order.paymentStatus === 'PAID' && refundableAmount > 0 ? <>
                <option value="FULL">Refund remaining balance ({formatMoney(refundableAmount, currency)})</option>
                <option value="PARTIAL">Partial refund</option>
              </> : null}
            </select>
          </label>
          {refundMode === 'PARTIAL' ? <label className="grid gap-1.5 text-sm font-medium">
            Refund amount ({currency})
            <input className="h-9 rounded-md border border-input bg-background px-3 font-normal" type="number" min="0.01" max={refundableAmount} step="0.01" value={refundAmount} onChange={(event) => { setRefundAmount(event.target.value); setRequestKey(crypto.randomUUID()) }} />
            <span className="text-xs font-normal text-muted-foreground">Up to {formatMoney(refundableAmount, currency)} remains refundable.</span>
          </label> : null}
          <label className="grid gap-1.5 text-sm font-medium">
            Reason (optional)
            <textarea className="min-h-20 rounded-md border border-input bg-background p-3 font-normal" value={cancellationReason} onChange={(event) => { setCancellationReason(event.target.value); setRequestKey(crypto.randomUUID()) }} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={cancelling} onClick={() => setCancellationOpen(false)}>Keep order</Button>
          <Button variant="destructive" loading={cancelling} onClick={() => void confirmCancellation()}>{refundMode === 'NONE' ? 'Cancel order' : 'Cancel and refund'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
