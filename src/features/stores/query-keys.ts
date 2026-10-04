export const storesQueryKeys = {
  all: ['stores'] as const,
  customer: (customerId: string) => [...storesQueryKeys.all, 'customer', customerId] as const,
  detail: (storeId: string) => [...storesQueryKeys.all, storeId] as const,
}
