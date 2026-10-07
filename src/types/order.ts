export type OrderStatus = 'DRAFT' | 'RECEIVED' | 'PREPARING' | 'READY' | 'PICKED_UP' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'ERROR' | 'PREORDER'
export type OrderPaymentStatus = 'QUOTE' | 'PENDING' | 'PROCESSING' | 'PAID' | 'REFUNDED' | 'CANCELLED' | 'FAILED' | 'PROCESSING_REFUND' | 'OFFERED'
export type OrderType = 'MEMBERSHIP' | 'PRODUCT' | 'MIXED'

export type Order = {
  id: string
  organizationId: string
  userId?: string | null
  type: OrderType
  source: string
  status: OrderStatus
  paymentStatus: OrderPaymentStatus
  deliveryType: string
  currency: string
  total: number
  totalExclVat: number
  totalVat: number
  note?: string | null
  tableNumber?: string | null
  shortCode?: string | null
  pickupNumber?: number | null
  clientContractId?: string | null
  createdAt: string
  updatedAt: string
  customer: { id: string; name: string }
  location: { id: string; name: string }
  user: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null } | null
}

export type OrderItem = {
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
}

export type OrderItemModifier = {
  id: string
  name: string
  price: number
  quantity: number
}

export type OrderStatusHistoryEntry = {
  status: OrderStatus
  comment?: string | null
  createdAt: string
}

export type FinancialTransaction = {
  id: string
  type: string
  status: string
  amount: number
  currency: string
  source: string
  externalId?: string | null
  reason?: string | null
  createdAt: string
}

export type OrderManagementDetails = {
  order: Order
  items: OrderItem[]
  modifiers: Record<string, OrderItemModifier[]>
  history: OrderStatusHistoryEntry[]
  transactions: FinancialTransaction[]
}
