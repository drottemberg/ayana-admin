export const classTypesQueryKeys = {
  all: ['class-types'] as const,
  customer: (customerId: string) => [...classTypesQueryKeys.all, 'customer', customerId] as const,
  location: (locationId: string) => [...classTypesQueryKeys.all, 'location', locationId] as const,
}

export const classSessionsQueryKeys = {
  all: ['class-sessions'] as const,
  detail: (id: string) => [...classSessionsQueryKeys.all, 'detail', id] as const,
  classType: (classTypeId: string) => [...classSessionsQueryKeys.all, 'class-type', classTypeId] as const,
  location: (locationId: string) => [...classSessionsQueryKeys.all, 'location', locationId] as const,
}
