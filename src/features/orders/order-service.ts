import { toast } from 'sonner'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { queryClient } from '@/lib/query-client'
import type { Order, OrderStatus } from '@/types/order'
import { setOrderStatusRequest } from './api'
import { ordersQueryKeys } from './query-keys'

const nextStatuses: Partial<Record<OrderStatus, { label: string; status: OrderStatus }[]>> = {
  RECEIVED: [{ label: 'Start preparing', status: 'PREPARING' }],
  PREPARING: [{ label: 'Ready', status: 'READY' }],
}

export const OrderService = {
  async setStatus(order: Order, status: OrderStatus) {
    try {
      await setOrderStatusRequest(order.id, status)
      await queryClient.invalidateQueries({ queryKey: ordersQueryKeys.all })
      toast.success(`Order updated to ${status.toLowerCase()}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update order status.')
    }
  },
  getRowActions(order: Order, canManage: boolean): DropdownActionItem[] {
    if (!canManage || order.type !== 'PRODUCT') return []
    const actions = order.status === 'READY'
      ? order.deliveryType === 'DELIVERY'
        ? [{ label: 'Mark delivered', status: 'DELIVERED' as OrderStatus }]
        : [{ label: 'Mark picked up', status: 'PICKED_UP' as OrderStatus }]
      : nextStatuses[order.status] ?? []
    return actions.map(({ label, status }) => ({ label, onClick: () => void this.setStatus(order, status) }))
  },
}
