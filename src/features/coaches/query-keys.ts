export const coachesQueryKeys = {
  all: ['coaches'] as const,
  customer: (customerId: string) => [...coachesQueryKeys.all, 'customer', customerId] as const,
  location: (locationId: string, classTypeId?: string) => [...coachesQueryKeys.all, 'location', locationId, classTypeId] as const,
}
