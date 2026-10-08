export type ClassTypeStatus = 'ACTIVE' | 'DISABLED'
export type ClassSessionType = 'GROUP' | 'SEMI_PRIVATE' | 'PRIVATE'

export type ClassType = {
  id: string
  organizationId: string
  locationId: string
  locationName: string
  customerId: string
  customerName: string
  name: string
  category?: string | null
  description?: string | null
  conditions?: string | null
  duration: number
  type: ClassSessionType
  maxCapacity: number
  creditCost: number | string
  resourceId?: string | null
  attachmentId?: string | null
  isActive: boolean
  status: ClassTypeStatus
  createdAt?: string | null
  updatedAt?: string | null
}

export type ClassSessionStatus = 'SCHEDULED' | 'PAUSED' | 'CANCELLED' | 'COMPLETED'
export type ClassSession = {
  id: string
  organizationId: string
  classTypeId: string
  className?: string | null
  classCategory?: string | null
  coachId?: string | null
  coachName?: string | null
  scheduleId?: string | null
  roomId?: string | null
  startTime: string
  endTime: string
  capacity: number
  bookedCount: number
  status: ClassSessionStatus
  type: ClassType['type']
  locationId?: string
  locationName?: string
  customerId?: string
  customerName?: string
  timezone?: string
}

export type ClassSchedule = {
  id: string
  organizationId: string
  classTypeId: string
  coachId?: string | null
  coachName?: string | null
  roomId?: string | null
  frequencyUnit: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  frequencyMultiplier: number
  dayOfWeek?: string | null
  monthlyDay?: number | null
  startHour: number
  startMinute: number
  capacity?: number | null
  isActive: boolean
  validFrom: string
  validUntil?: string | null
  pauseFrom?: string | null
  pauseUntil?: string | null
}

export type ClassBooking = {
  id: string
  organizationId: string
  userId: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  sessionId: string
  status: string
  checkInAt?: string | null
  cancelledAt?: string | null
  createdAt: string
}
