export type CoachClassQualification = {
  id: string
  name: string
  locationId: string
}

export type CoachProfile = {
  customerId: string
  customerName?: string | null
  userId: string
  coachName: string
  email?: string | null
  bio?: string | null
  specialties: string[]
  languages: string[]
  attachmentId?: string | null
  classTypes: CoachClassQualification[]
  locationScope: 'ALL' | 'SPECIFIC' | 'NONE'
  locations: Array<{ id: string; name: string }>
  createdAt?: string
  updatedAt?: string
}

export type CoachCandidate = {
  userId: string
  firstName: string
  lastName: string
  email?: string | null
  locationScope: 'ALL' | 'SPECIFIC'
  locationIds: string[]
}
