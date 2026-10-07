export type ClientContractStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED'

export type ClientContract = {
  id: string
  organizationId: string
  userId: string
  pricingOptionId: string
  status: ClientContractStatus
  creditsRemaining: number | null
  creditsUsedThisPeriod: number
  periodStart?: string | null
  periodEnd?: string | null
  validUntil?: string | null
  freezeUntil?: string | null
  createdAt: string
  updatedAt: string
  customer: { id: string; name: string }
  location: { id: string; name: string }
  user: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null } | null
  pricingOption: { id: string; name: string; type: string; price: number; currency: string } | null
}
