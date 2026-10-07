export const clientContractsQueryKeys = {
  all: ['client-contracts'] as const,
  customer: (customerId: string) => [...clientContractsQueryKeys.all, 'customer', customerId] as const,
  location: (locationId: string) => [...clientContractsQueryKeys.all, 'location', locationId] as const,
  user: (userId: string) => [...clientContractsQueryKeys.all, 'user', userId] as const,
}
