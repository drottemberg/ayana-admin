import { apiClient } from '@/lib/api-client'

export type ReportLocation = { id: string; name: string; customerId: string; customerName?: string }
export type SalesVatBucket = {
  currency: string
  vatRate: number
  gross: number
  net: number
  vat: number
  transactionCount: number
}
export type SalesReportTotal = { currency: string; gross: number; net: number; vat: number; unallocatedGross: number; stripeFees: number; netAfterStripeFees: number }
export type SalesReportEntry = {
  id: string
  date: string
  type: 'SALE' | 'REFUND' | 'STRIPE_FEE'
  amount: number
  currency: string
  orderId: string | null
  orderCode: string | null
  customerName: string | null
  locationId: string
  locationName: string
  vatAllocated: boolean
  legacy?: boolean
}
export type SalesReport = {
  from: string
  to: string
  totals: SalesReportTotal[]
  vatBreakdown: SalesVatBucket[]
  entries: SalesReportEntry[]
  pagination: { page: number; limit: number; total: number; pageCount: number }
  unallocated: Array<{ currency: string; gross: number }>
  stripeFeeSyncFailures?: number
  note: string
}

export function getSalesReportLocationsRequest(customerId?: string) {
  return apiClient.get<ReportLocation[]>('/reports/sales/locations', {
    params: customerId ? { customerId } : undefined,
  })
}

export function getSalesReportRequest(filters: { from: string; to: string; customerId?: string; locationId?: string; page?: number; limit?: number }) {
  return apiClient.get<SalesReport>('/reports/sales', { params: filters })
}
