export const locationsQueryKeys = {
  all: ['locations'] as const,
  customer: (customerId: string) => [...locationsQueryKeys.all, 'customer', customerId] as const,
  user: (userId: string) => [...locationsQueryKeys.all, 'user', userId] as const,
  detail: (locationId: string) => [...locationsQueryKeys.all, locationId] as const,
}
