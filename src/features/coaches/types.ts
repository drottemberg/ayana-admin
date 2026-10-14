export type CoachClassQualification = {
  id: string
  name: string
  locationId: string
}

export type CoachProfile = {
  customerId: string
  userId: string
  coachName: string
  email?: string | null
  bio?: string | null
  specialties: string[]
  attachmentId?: string | null
  classTypes: CoachClassQualification[]
  locationScope: 'ALL' | 'SPECIFIC'
  locations: Array<{ id: string; name: string }>
  createdAt?: string
  updatedAt?: string
}

export type CoachCandidate = {
  userId: string
  firstName: string
  lastName: string
  email?: string | null
}
