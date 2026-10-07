export const ordersQueryKeys = {
  all: ['orders'] as const,
  detail: (orderId: string) => [...ordersQueryKeys.all, 'detail', orderId] as const,
  customer: (customerId: string) => [...ordersQueryKeys.all, 'customer', customerId] as const,
  location: (locationId: string) => [...ordersQueryKeys.all, 'location', locationId] as const,
  user: (userId: string) => [...ordersQueryKeys.all, 'user', userId] as const,
  product: (productId: string) => [...ordersQueryKeys.all, 'product', productId] as const,
  kitchen: (locationId: string) => [...ordersQueryKeys.all, 'kitchen', locationId] as const,
}
