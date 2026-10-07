export const PricingOptionScope = {
  ALL: 'ALL',
  SPECIFIC: 'SPECIFIC',
} as const
export type PricingOptionScope = (typeof PricingOptionScope)[keyof typeof PricingOptionScope]

export const PricingOptionType = {
  DROP_IN: 'DROP_IN',
  CLASS_PACK: 'CLASS_PACK',
  CAPPED_MEMBERSHIP: 'CAPPED_MEMBERSHIP',
  UNLIMITED_MEMBERSHIP: 'UNLIMITED_MEMBERSHIP',
  INTRO_OFFER: 'INTRO_OFFER',
} as const
export type PricingOptionType = (typeof PricingOptionType)[keyof typeof PricingOptionType]

export const BillingInterval = {
  ONCE: 'ONCE',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
} as const
export type BillingInterval = (typeof BillingInterval)[keyof typeof BillingInterval]

export type PricingOptionLocation = {
  locationId: string
  location?: { id: string; name: string } | null
  priceOverride: number | string | null
  currencyOverride: string | null
  stripePriceIdOverride?: string | null
}

export type PricingOption = {
  id: string
  organizationId: string
  customerId?: string
  scope: PricingOptionScope
  name: string
  description?: string | null
  type: PricingOptionType
  price: number | string
  /** Fraction stored by the API (0.20 = 20%). */
  vatRate: number | string
  currency: string
  creditsTotal?: number | string | null
  creditsPerPeriod?: number | string | null
  creditsRollover?: boolean
  validityDays?: number | null
  billingInterval: BillingInterval
  minimumCommitmentMonths?: number | null
  applicableTo?: string
  isActive: boolean
  isDeleted?: boolean
  status?: 'ACTIVE' | 'DISABLED' | 'DELETED'
  isSellable: boolean
  isIntro: boolean
  perks?: string[]
  stripePriceId?: string | null
  locations: PricingOptionLocation[]
  isPriceOverridden?: boolean
  isCurrencyOverridden?: boolean
  customerName?: string | null
  customer?: { id: string; name: string } | null
  createdAt?: string
  updatedAt?: string
}

export type CreatePricingOptionPayload = {
  name: string
  description?: string
  type: PricingOptionType
  price: number
  /** Fraction stored by the API (0.20 = 20%). */
  vatRate: number
  currency: string
  scope: PricingOptionScope
  locations: Array<{
    locationId: string
    priceOverride?: number
    currencyOverride?: string
  }>
  billingInterval: BillingInterval
  creditsTotal?: number
  creditsPerPeriod?: number
  creditsRollover?: boolean
  validityDays?: number
  minimumCommitmentMonths?: number
  applicableTo?: string
  isIntro?: boolean
  perks?: string[]
  isSellable: boolean
  isActive: boolean
}

export type UpdatePricingOptionPayload = Partial<CreatePricingOptionPayload>
