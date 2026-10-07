import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getCustomersListRequest } from '@/features/customers/api'
import { ordersQueryKeys } from '@/features/orders/query-keys'
import { cancelOrderRequest, getOrderLocationOptions, getOrdersRequest } from '@/features/orders/api'
import { getOrderColumns } from '@/features/orders/order-columns'
import { OrderService } from '@/features/orders/order-service'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import type { Order } from '@/types/order'
import { queryClient } from '@/lib/query-client'
import { toast } from 'sonner'

const statuses = ['DRAFT', 'RECEIVED', 'PREPARING', 'READY', 'PICKED_UP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'ERROR', 'PREORDER']
const paymentStatuses = ['QUOTE', 'PENDING', 'PROCESSING', 'PAID', 'REFUNDED', 'CANCELLED', 'FAILED', 'PROCESSING_REFUND', 'OFFERED']

export default function OrdersPage() {
  const [searchParams] = useSearchParams()
  const [cancellationOrder, setCancellationOrder] = useState<Order | null>(null)
  const [refundMode, setRefundMode] = useState<'NONE' | 'PARTIAL' | 'FULL'>('FULL')
  const [refundAmount, setRefundAmount] = useState('')
  const [reason, setReason] = useState('')
  const [cancellationRequestKey, setCancellationRequestKey] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const { session } = useConnect()
  const isAdminContext = getAppMode() === 'admin'
  const currentCustomerId = session?.currentOrganization?.id
  const columns = useMemo(() => getOrderColumns({ showCustomer: isAdminContext, showLocation: true, showUser: true }), [isAdminContext])
  const initialFilters = {
    ...(isAdminContext && searchParams.get('filterCustomerId') ? { customerId: [searchParams.get('filterCustomerId')!] } : {}),
    ...(searchParams.get('filterLocationId') ? { locationId: [searchParams.get('filterLocationId')!] } : {}),
    ...(searchParams.get('userId') ? { userId: [searchParams.get('userId')!] } : {}),
  }
  const productId = searchParams.get('filterProductId')
  const canManage = Boolean(session?.permissions.customers?.edit)

  const openCancellation = (order: Order) => {
    setCancellationOrder(order)
    setRefundMode(order.paymentStatus === 'PAID' ? 'FULL' : 'NONE')
    setRefundAmount('')
    setReason('')
    setCancellationRequestKey(crypto.randomUUID())
  }

  const confirmCancellation = async () => {
    if (!cancellationOrder) return
    const amount = Number(refundAmount)
    if (refundMode === 'PARTIAL' && (!Number.isFinite(amount) || amount <= 0)) {
      toast.error('Enter a valid partial refund amount.')
      return
    }
    setCancelling(true)
    try {
      await cancelOrderRequest(cancellationOrder.id, {
        refundMode,
        ...(refundMode === 'PARTIAL' ? { refundAmount: amount } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        requestKey: cancellationRequestKey,
      })
      await queryClient.invalidateQueries({ queryKey: ordersQueryKeys.all })
      toast.success(refundMode === 'NONE' ? 'Order cancelled.' : 'Order cancelled and refund initiated.')
      setCancellationOrder(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cancel this order.')
    } finally {
      setCancelling(false)
    }
  }

  return <>
    <PageHeader title="Orders" subtitle="Orders across customers and locations." />
    <section className="p-4 md:p-6">
      <DataTableAsync
        queryKey={[...ordersQueryKeys.all, 'table', productId ?? 'all-products']}
        loadData={(state: DataTableState<Order>) => getOrdersRequest(state, {
          ...(productId ? { productId } : {}),
          ...(!isAdminContext && currentCustomerId ? { customerId: currentCustomerId } : {}),
        })}
        refetchOnMount="always"
        tableKey="orders.root"
        initialFilters={Object.keys(initialFilters).length ? initialFilters : undefined}
        columns={columns}
        disabledSelection
        searchPlaceholder="Search by order code, ID, customer or user"
        searchColumns={['id', 'shortCode']}
        filters={[
          { id: 'status', label: 'Status', column: 'status' as const, options: statuses, getValue: (order: Order) => order.status },
          { id: 'paymentStatus', label: 'Payment', column: 'paymentStatus' as const, options: paymentStatuses, getValue: (order: Order) => order.paymentStatus },
          { id: 'type', label: 'Type', column: 'type' as const, options: ['MEMBERSHIP', 'PRODUCT', 'MIXED'], getValue: (order: Order) => order.type },
          ...(!isAdminContext ? [] : [{
            id: 'customerId', label: 'Customer', column: 'customer' as const, selectionMode: 'single' as const,
            queryFn: async (search: string) => {
              const customers = await getCustomersListRequest(undefined, search)
              return { items: customers.map((customer) => ({ id: customer.id, label: customer.name })), total: customers.length }
            },
            getValue: (order: Order) => order.customer.id,
          }]),
          { id: 'locationId', label: 'Location', column: 'location' as const, selectionMode: 'single' as const, queryFn: getOrderLocationOptions, getValue: (order: Order) => order.location.id },
        ]}
        getRowCommands={(order) => [
          ...OrderService.getRowActions(order, canManage),
          ...(canManage && order.type === 'PRODUCT' && ['RECEIVED', 'PREPARING', 'READY'].includes(order.status)
            ? [{ label: 'Cancel order…', variant: 'destructive' as const, onClick: () => openCancellation(order) }]
            : []),
        ]}
        loadingMessage="Loading orders..."
        emptyMessage="No orders found."
        errorMessage="Failed to load orders."
      />
    </section>
    <Dialog open={Boolean(cancellationOrder)} onOpenChange={(open) => { if (!open && !cancelling) setCancellationOrder(null) }}>
      <DialogContent>
        <DialogHeader showCloseButton>
          <DialogTitle>Cancel order {cancellationOrder?.shortCode}</DialogTitle>
          <DialogDescription>Choose what to do with the payment. Refunds are processed through Stripe.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Refund
            <select className="h-9 rounded-md border border-input bg-background px-3 font-normal" value={refundMode} onChange={(event) => { setRefundMode(event.target.value as typeof refundMode); setCancellationRequestKey(crypto.randomUUID()) }}>
              <option value="NONE">Cancel without refund</option>
              <option value="FULL">Refund remaining paid amount</option>
              <option value="PARTIAL">Partial refund</option>
            </select>
          </label>
          {refundMode === 'PARTIAL' ? <label className="grid gap-1.5 text-sm font-medium">
            Refund amount ({cancellationOrder?.currency ?? 'EUR'})
            <input className="h-9 rounded-md border border-input bg-background px-3 font-normal" type="number" min="0.01" step="0.01" value={refundAmount} onChange={(event) => { setRefundAmount(event.target.value); setCancellationRequestKey(crypto.randomUUID()) }} />
          </label> : null}
          <label className="grid gap-1.5 text-sm font-medium">
            Reason (optional)
            <textarea className="min-h-20 rounded-md border border-input bg-background p-3 font-normal" value={reason} onChange={(event) => { setReason(event.target.value); setCancellationRequestKey(crypto.randomUUID()) }} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={cancelling} onClick={() => setCancellationOrder(null)}>Keep order</Button>
          <Button variant="destructive" loading={cancelling} onClick={() => void confirmCancellation()}>Cancel order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
