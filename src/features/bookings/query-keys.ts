export const bookingsQueryKeys = {
  all: ['bookings'] as const,
  detail: (bookingId: string) => [...bookingsQueryKeys.all, 'detail', bookingId] as const,
  customer: (customerId: string) => [...bookingsQueryKeys.all, 'customer', customerId] as const,
  location: (locationId: string) => [...bookingsQueryKeys.all, 'location', locationId] as const,
  user: (userId: string) => [...bookingsQueryKeys.all, 'user', userId] as const,
}
