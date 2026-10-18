import { useState } from 'react'
import NiceModal from '@ebay/nice-modal-react'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getOrderManagementDetailsRequest, refundOrderRequest } from '@/features/orders/api'
import { ordersQueryKeys } from '@/features/orders/query-keys'
import { useModalController } from '@/providers/use-overlay-controller'
import type { Order } from '@/types/order'
import { queryClient } from '@/lib/query-client'
import { toast } from 'sonner'

export type OrderRefundDialogProps = { order: Order }

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'EUR' }).format(value)
}

const OrderRefundDialog = NiceModal.create<OrderRefundDialogProps>(({ order }) => {
  const [refundMode, setRefundMode] = useState<'PARTIAL' | 'FULL'>('FULL')
  const [refundAmount, setRefundAmount] = useState('')
  const [reason, setReason] = useState('')
  const [requestKey] = useState(() => crypto.randomUUID())
  const [submitting, setSubmitting] = useState(false)
  const modal = useModalController({ canClose: () => !submitting })
  const detailQuery = useQuery({
    queryKey: ordersQueryKeys.detail(order.id),
    queryFn: () => getOrderManagementDetailsRequest(order.id),
    enabled: modal.open,
  })

  const refundedTransactions = (detailQuery.data?.transactions ?? [])
    .filter((transaction) => ['REFUND', 'REFUND_REQUESTED'].includes(transaction.type) && transaction.status === 'SUCCEEDED')
  const seenRefunds = new Set<string>()
  const alreadyRefunded = refundedTransactions.reduce((total, transaction) => {
    const key = transaction.externalId ?? transaction.id
    if (seenRefunds.has(key)) return total
    seenRefunds.add(key)
    return total + Number(transaction.amount)
  }, 0)
  const refundableAmount = Math.max(0, Number(order.total) - alreadyRefunded)
  const currency = order.currency || 'EUR'

  const submit = async () => {
    const amount = Number(refundAmount)
    if (refundMode === 'PARTIAL' && (!Number.isFinite(amount) || amount <= 0 || amount > refundableAmount)) {
      toast.error(`Enter a refund between 0.01 and ${refundableAmount.toFixed(2)} ${currency}.`)
      return
    }
    setSubmitting(true)
    try {
      const result = await refundOrderRequest(order.id, {
        refundMode,
        ...(refundMode === 'PARTIAL' ? { refundAmount: amount } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        requestKey,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ordersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ordersQueryKeys.detail(order.id) }),
      ])
      toast.success(`Refund of ${formatMoney(result.refundAmount, result.currency)} ${result.refundStatus === 'PENDING' ? 'is processing.' : 'initiated.'}`)
      await modal.forceClose(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not refund this order.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={modal.open} onOpenChange={modal.onOpenChange}>
      <DialogContent>
        <DialogHeader showCloseButton>
          <DialogTitle>Refund order {order.shortCode ?? order.id.slice(-6)}</DialogTitle>
          <DialogDescription>This refunds the payment without cancelling the order. The final refundable balance is checked by Stripe.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {detailQuery.isLoading ? <p className="text-sm text-muted-foreground">Checking payment history…</p> : null}
          {detailQuery.isError ? <p className="text-sm text-destructive">Could not load this order’s payment history.</p> : null}
          {!detailQuery.isLoading && !detailQuery.isError ? <p className="text-sm text-muted-foreground">Refundable balance: {formatMoney(refundableAmount, currency)}</p> : null}
          <label className="grid gap-1.5 text-sm font-medium">
            Refund amount
            <select className="h-9 rounded-md border border-input bg-background px-3 font-normal" value={refundMode} onChange={(event) => setRefundMode(event.target.value as typeof refundMode)}>
              <option value="FULL">Full remaining balance ({formatMoney(refundableAmount, currency)})</option>
              <option value="PARTIAL">Partial refund</option>
            </select>
          </label>
          {refundMode === 'PARTIAL' ? <label className="grid gap-1.5 text-sm font-medium">
            Amount ({currency})
            <input className="h-9 rounded-md border border-input bg-background px-3 font-normal" type="number" min="0.01" max={refundableAmount} step="0.01" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} />
          </label> : null}
          <label className="grid gap-1.5 text-sm font-medium">
            Reason (optional)
            <textarea className="min-h-20 rounded-md border border-input bg-background p-3 font-normal" value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => void modal.requestClose(false)}>Keep order</Button>
          <Button variant="destructive" loading={submitting} disabled={detailQuery.isLoading || detailQuery.isError || refundableAmount <= 0} onClick={() => void submit()}>
            Refund {refundMode === 'FULL' ? formatMoney(refundableAmount, currency) : 'amount'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

export { OrderRefundDialog }
