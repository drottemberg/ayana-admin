import { apiClient } from '@/lib/api-client'

export type PartnershipDiscount = { productId?: string | null; pricingOptionId?: string | null; percent: number; productName?: string | null; pricingOptionName?: string | null }
export type Partnership = Record<string, unknown> & {
  id: string
  customerId: string
  customerName?: string | null
  name: string
  locationScope: 'ALL' | 'SPECIFIC'
  locationIds: string[]
  locations: Array<{ id: string; name: string }>
  emailRules: string[]
  productDiscounts: PartnershipDiscount[]
  pricingOptionDiscounts: PartnershipDiscount[]
  isActive: boolean
  isDeleted: boolean
  status: 'ACTIVE' | 'DISABLED' | 'DELETED'
  deletedAt?: string | null
}
export type PartnershipInput = {
  name: string
  locationScope: 'ALL' | 'SPECIFIC'
  isActive: boolean
  locationIds: string[]
  emailRules: string[]
  productDiscounts: Array<{ productId: string | null; percent: number }>
  pricingOptionDiscounts: Array<{ pricingOptionId: string | null; percent: number }>
}

function withCustomer(path: string, customerId: string) {
  return `${path}?${new URLSearchParams({ customerId })}`
}

export function listPartnershipsRequest(customerId?: string, search = '', status?: 'ACTIVE' | 'DISABLED' | 'DELETED' | 'ALL') {
  const params = new URLSearchParams()
  if (customerId) params.set('customerId', customerId)
  if (search.trim()) params.set('search', search.trim())
  if (status) params.set('status', status)
  return apiClient.get<Partnership[]>(`/partnerships?${params}`)
}

export function createPartnershipRequest(customerId: string, input: PartnershipInput) {
  return apiClient.post<Partnership>(withCustomer('/partnerships', customerId), input)
}

export function updatePartnershipRequest(customerId: string, partnershipId: string, input: PartnershipInput) {
  return apiClient.patch<Partnership>(withCustomer(`/partnerships/${partnershipId}`, customerId), input)
}

export function setPartnershipStatusRequest(customerId: string, partnershipId: string, isActive: boolean) {
  return apiClient.patch(withCustomer(`/partnerships/${partnershipId}/status`, customerId), { isActive })
}

export function deletePartnershipRequest(customerId: string, partnershipId: string) {
  return apiClient.delete(withCustomer(`/partnerships/${partnershipId}`, customerId))
}
