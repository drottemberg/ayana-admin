import { useEffect, useState, type FormEvent } from 'react'
import NiceModal from '@ebay/nice-modal-react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getOrderManagementDetailsRequest, sendOrderInvoiceRequest } from '@/features/orders/api'
import { ordersQueryKeys } from '@/features/orders/query-keys'
import { useModalController } from '@/providers/use-overlay-controller'

export const SendOrderInvoiceDialog = NiceModal.create<{ orderId: string; shortCode?: string | null }>(({ orderId, shortCode }) => {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [edited, setEdited] = useState({ email: false, name: false })
  const modal = useModalController({ canClose: () => !submitting })
  const details = useQuery({ queryKey: ordersQueryKeys.detail(orderId), queryFn: () => getOrderManagementDetailsRequest(orderId), enabled: modal.open })
  const order = details.data?.order

  useEffect(() => {
    if (!order) return
    if (!edited.email) setEmail(order.user?.email ?? '')
    if (!edited.name) setName([order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ') || order.guestName || '')
  }, [order, edited.email, edited.name])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !name.trim()) return
    setSubmitting(true)
    try {
      const result = await sendOrderInvoiceRequest(orderId, email.trim(), name.trim())
      toast.success(`Invoice for order ${result.shortCode} sent to ${result.email}.`)
      await modal.forceClose(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the invoice.')
    } finally {
      setSubmitting(false)
    }
  }

  return <Dialog open={modal.open} onOpenChange={modal.onOpenChange}>
    <DialogContent>
      <DialogHeader showCloseButton>
        <DialogTitle>Send invoice for order {shortCode ?? order?.shortCode ?? orderId.slice(-6)}</DialogTitle>
        <DialogDescription>The order receipt and its itemized PDF will be sent to this address.</DialogDescription>
      </DialogHeader>
      <form onSubmit={(event) => void submit(event)} className="grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">Email
          <input type="email" required maxLength={254} autoComplete="email" className="h-9 rounded-md border border-input bg-background px-3 font-normal" value={email} onChange={(event) => { setEdited((value) => ({ ...value, email: true })); setEmail(event.target.value) }} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">Recipient name
          <input type="text" required maxLength={120} autoComplete="name" className="h-9 rounded-md border border-input bg-background px-3 font-normal" value={name} onChange={(event) => { setEdited((value) => ({ ...value, name: true })); setName(event.target.value) }} />
        </label>
        {details.isError ? <p className="text-sm text-destructive">Could not load the order details.</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => void modal.forceClose(true)}>Cancel</Button>
          <Button type="submit" loading={submitting} disabled={details.isLoading || details.isError || order?.paymentStatus !== 'PAID'}>Send invoice</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
})
