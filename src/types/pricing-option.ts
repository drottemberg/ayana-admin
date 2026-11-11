export const PricingOptionScope = {
  ALL: 'ALL',
  SPECIFIC: 'SPECIFIC',
} as const
export type PricingOptionScope = (typeof PricingOptionScope)[keyof typeof PricingOptionScope]
export type ClassAccessScope = 'ALL' | 'SPECIFIC'

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

export const CreditRefreshInterval = {
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
} as const
export type CreditRefreshInterval = (typeof CreditRefreshInterval)[keyof typeof CreditRefreshInterval]

export const ApplicableTo = {
  GROUP: 'GROUP',
  PRIVATE: 'PRIVATE',
  BOTH: 'BOTH',
} as const
export type ApplicableTo = (typeof ApplicableTo)[keyof typeof ApplicableTo]

export type PricingOptionLocation = {
  locationId: string
  location?: { id: string; name: string } | null
  priceOverride: number | string | null
  currencyOverride: string | null
  stripePriceIdOverride?: string | null
}

export type PurchaseBenefitRule = { scope: 'ALL' | 'SPECIFIC'; percent?: number | null; referencePercent?: number | null; targets: Array<{ id: string; percent: number | null }> }
export type PurchaseBenefits = { products?: PurchaseBenefitRule; pricingOptions?: PurchaseBenefitRule }

export type PricingOption = {
  id: string
  organizationId: string
  customerId?: string
  scope: PricingOptionScope
  classAccessScope?: ClassAccessScope
  classTypeIds?: string[]
  name: string
  description?: string | null
  type: PricingOptionType
  price: number | string
  /** Fraction stored by the API (0.20 = 20%). */
  vatRate: number | string
  currency: string
  creditsTotal?: number | string | null
  creditsPerPeriod?: number | string | null
  creditsRefreshInterval?: CreditRefreshInterval
  creditsRollover?: boolean
  validityDays?: number | null
  billingInterval: BillingInterval
  minimumCommitmentMonths?: number | null
  applicableTo?: ApplicableTo
  isActive: boolean
  isDeleted?: boolean
  status?: 'ACTIVE' | 'DISABLED' | 'DELETED'
  isSellable: boolean
  isIntro: boolean
  perks?: string[]
  purchaseBenefits?: PurchaseBenefits | null
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
  classAccessScope?: ClassAccessScope
  classTypeIds?: string[]
  description?: string | null
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
  creditsTotal?: number | null
  creditsPerPeriod?: number | null
  creditsRefreshInterval?: CreditRefreshInterval
  creditsRollover?: boolean
  validityDays?: number | null
  minimumCommitmentMonths?: number | null
  applicableTo?: ApplicableTo
  isIntro?: boolean
  perks?: string[]
  isSellable: boolean
  isActive: boolean
  purchaseBenefits?: PurchaseBenefits
}

export type UpdatePricingOptionPayload = Partial<CreatePricingOptionPayload>
