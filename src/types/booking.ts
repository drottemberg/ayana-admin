export type BookingStatus = 'CONFIRMED' | 'PENDING_APPROVAL' | 'WAITLISTED' | 'CANCELLED' | 'LATE_CANCELLED' | 'ATTENDED' | 'NO_SHOW'
export type BookingSource = 'DIRECT' | 'CLASSPASS' | 'EGYM'

export type BookingPerson = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
}

export type ManualBookingRecipient = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
}

export type BookingCancellationQuote = {
  bookingId: string
  isLate: boolean
  lateCancelWindowHours: number
  penaltyCredits: number
  penaltyAmount: number
  currency: string
  creditsToReturn: number
  classCreditCost: number
  canApplyPenalty: boolean
  isWaitlisted: boolean
}

export type BookingOrganization = { id: string; name: string }

export type Booking = {
  id: string
  organizationId: string
  userId: string
  sessionId: string
  status: BookingStatus
  source?: BookingSource
  isFreeTrial?: boolean
  attended?: boolean | null
  checkInAt?: string | null
  cancelledAt?: string | null
  penaltyApplied: boolean
  clientContractId?: string | null
  createdAt: string
  updatedAt?: string
  startsAt?: string
  endsAt?: string
  classTypeId?: string
  className?: string
  classCategory?: string | null
  coachId?: string | null
  creditCost?: number
  creditsUsed?: number
  studioVisitCount?: number
  creditContractNames?: string | null
  user: BookingPerson
  location: BookingOrganization
  customer: BookingOrganization
}

export type BookingManagementDetails = Booking & {
  session: {
    id: string
    startsAt: string
    endsAt: string
    capacity: number
    bookedCount: number
    status: string
    class: {
      id: string
      name: string
      category?: string | null
      description?: string | null
      conditions?: string | null
      duration: number
      creditCost: number
    }
  }
  clientContract: {
    id: string
    status: string
    creditsRemaining?: number | null
    pricingOption?: { id: string; name: string } | null
    location: BookingOrganization
  } | null
  creditMovements: Array<{
    id: string
    type: string
    amount: number
    balanceAfter?: number | null
    reason?: string | null
    createdAt: string
    expiresAt?: string | null
    contract: {
      id: string
      status: string
      creditsRemaining?: number | null
      pricingOption?: { id: string; name: string } | null
      location?: BookingOrganization | null
    } | null
  }>
}
