export type ClientContractStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED'

export type ClientContract = {
  id: string
  organizationId: string
  userId: string
  pricingOptionId: string | null
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
  pricingOption: {
    id: string
    name: string
    type: string
    price: number
    currency: string
    billingInterval?: string
    creditsPerPeriod?: number | null
    creditsRefreshInterval?: string | null
  } | null
}

export type ClientContractCreditMovement = {
  id: string
  clientContractId: string | null
  walletId?: string | null
  organizationId: string
  userId: string
  creditScope?: 'ALL' | 'SPECIFIC'
  creditLocationIds?: string[]
  creditLocations?: Array<{ id: string; name: string }>
  type: 'OPENING_BALANCE' | 'PURCHASE_GRANT' | 'PERIOD_GRANT' | 'PERIOD_EXPIRY' | 'BOOKING_CONSUMPTION' | 'BOOKING_REFUND' | 'MANUAL_GRANT' | 'MANUAL_DEDUCTION' | 'CREDIT_EXPIRY'
  amount: number
  balanceAfter: number | null
  contractName?: string
  locationName?: string | null
  expiresAt?: string | null
  sourceMovementId?: string | null
  customer?: { id: string; name: string }
  user?: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null }
  reason?: string | null
  bookingId?: string | null
  createdByUserId?: string | null
  createdAt: string
  creator?: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null } | null
  bookingInfo?: { className?: string | null; startTime: string } | null
}
