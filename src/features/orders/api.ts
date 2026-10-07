import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import type { Order, OrderManagementDetails, OrderStatus } from '@/types/order'

export const ordersListConfig = {
  url: '/orders/list',
  toPayload: (state: DataTableState<Order>, filters?: Record<string, unknown>) => toApiListDto(state, filters),
  toResult: (result: ApiListResult<unknown>): DataTableAsyncResult<Order> => toDataTableResult(result as ApiListResult<Order>),
}

export async function getOrdersRequest(state: DataTableState<Order>, filters?: Record<string, unknown>): Promise<DataTableAsyncResult<Order>> {
  const result = await apiClient.post<ApiListResult<Order>>(ordersListConfig.url, ordersListConfig.toPayload(state, filters))
  return toDataTableResult(result)
}

export function setOrderStatusRequest(orderId: string, status: OrderStatus, comment?: string) {
  return apiClient.patch<Order>(`/orders/${orderId}/status`, { status, comment })
}

export type KitchenLocation = {
  id: string
  name: string
  parentId: string
  currency?: string | null
  timezone?: string | null
}

export type KitchenOrder = {
  id: string
  status: OrderStatus
  shortCode?: string | null
  pickupNumber?: number | null
  deliveryType: string
  currency: string
  createdAt: string
  note?: string | null
  tableNumber?: string | null
  customerFirstName?: string | null
  customerLastName?: string | null
  canSendPickupReminder?: boolean
  total?: number | null
  paymentStatus?: string | null
  lastReminderAt?: string | null
  issues?: Array<{ id: string; category: string; status: string; description: string; resolution?: string | null; resolutionNote?: string | null }>
  items: Array<{
    id: string
    productName: string
    variantName?: string | null
    variantLabel?: string | null
    quantity: number
    notes?: string | null
    modifiers: Array<{ id: string; name: string; quantity: number; price: number }>
  }>
}

export type KitchenOrderDetail = {
  order: {
    id: string
    status: OrderStatus
    paymentStatus: string
    deliveryType: string
    currency: string
    total: number
    totalExclVat: number
    totalVat: number
    shortCode?: string | null
    pickupNumber?: number | null
    createdAt: string
    note?: string | null
    tableNumber?: string | null
    customer: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null } | null
    location: { id: string; name: string }
  }
  items: Array<{
    id: string
    productName: string
    variantName?: string | null
    variantLabel?: string | null
    quantity: number
    unitPrice: number
    unitPriceExcl: number
    vatRate: number
    subtotal: number
    vatAmount: number
    notes?: string | null
    modifiers: Array<{ id: string; name: string; price: number; quantity: number }>
  }>
  history: Array<{ status: string; comment?: string | null; createdAt: string }>
  transactions: Array<{ id: string; type: string; status: string; amount: number; currency: string; source: string; reason?: string | null; createdAt: string }>
  issues: Array<{
    id: string
    itemId?: string | null
    category: string
    status: string
    description: string
    proposedReplacement?: string | null
    proposedReplacementVariantId?: string | null
    replacementOptions?: Array<{ id: string; label: string; variantLabel?: string | null; price: number; stock: number }>
    resolution?: string | null
    resolutionNote?: string | null
    resolutionAmount?: number | null
    createdAt: string
    resolvedAt?: string | null
  }>
}

export type KitchenIssueCategory = 'MISSING_INGREDIENT' | 'OUT_OF_STOCK' | 'DELAY' | 'WRONG_ITEM' | 'QUALITY' | 'OTHER'
export type KitchenIssueResolution = 'ASK_CUSTOMER' | 'REMOVE_ITEM_REFUND' | 'CANCEL_ORDER_REFUND' | 'CONTINUE_REMAINDER' | 'OTHER'

export type KitchenOrdersResult = {
  activeOrders: KitchenOrder[]
  recentOrders: KitchenOrder[]
}

export function getKitchenLocationsRequest(customerId?: string) {
  return apiClient.get<KitchenLocation[]>('/orders/kitchen/locations', {
    params: customerId ? { customerId } : undefined,
  })
}

export function getKitchenOrdersRequest(locationId: string) {
  return apiClient.get<KitchenOrdersResult>('/orders/kitchen', { params: { locationId } })
}

export function setKitchenOrderStatusRequest(orderId: string, locationId: string, status: OrderStatus, comment?: string) {
  return apiClient.patch<KitchenOrder>(`/orders/kitchen/${orderId}/status`, { locationId, status, comment })
}

export function getKitchenOrderDetailsRequest(orderId: string, locationId: string) {
  return apiClient.get<KitchenOrderDetail>(`/orders/kitchen/${orderId}`, { params: { locationId } })
}

export function sendKitchenPickupReminderRequest(orderId: string, locationId: string) {
  return apiClient.post<{ success: boolean; shortCode: string; sentAt: string }>(`/orders/kitchen/${orderId}/reminder`, { locationId })
}

export function reportKitchenOrderIssueRequest(orderId: string, locationId: string, input: { category: KitchenIssueCategory; itemId?: string; description: string }) {
  return apiClient.post<KitchenOrderDetail['issues'][number]>(`/orders/kitchen/${orderId}/issues`, input, { params: { locationId } })
}

export function resolveKitchenOrderIssueRequest(orderId: string, issueId: string, locationId: string, input: { resolution: KitchenIssueResolution; proposedReplacement?: string; replacementVariantId?: string; resolutionNote?: string; refundAmount?: number }) {
  return apiClient.patch<KitchenOrderDetail['issues'][number]>(`/orders/kitchen/${orderId}/issues/${issueId}`, input, { params: { locationId } })
}

export type CancelOrderInput = {
  refundMode: 'NONE' | 'PARTIAL' | 'FULL'
  refundAmount?: number
  reason?: string
  requestKey: string
}

export function cancelOrderRequest(orderId: string, input: CancelOrderInput) {
  return apiClient.post<Order>(`/orders/${orderId}/cancel`, input)
}

export function getOrderManagementDetailsRequest(orderId: string) {
  return apiClient.get<OrderManagementDetails>(`/orders/manage/${orderId}`)
}

export async function getOrderLocationOptions(search: string, page = 1) {
  const result = await apiClient.post<ApiListResult<{ id: string; name: string }>>('/locations/list', {
    search: search.trim() || undefined,
    page,
    limit: 20,
    orderBy: 'name',
    order: 'asc',
  })
  return { items: result.items.map((location) => ({ id: location.id, label: location.name })), total: result.total }
}
