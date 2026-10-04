export const customersQueryKeys = {
  all: ['customers'] as const,
  detail: (customerId: string) => [...customersQueryKeys.all, customerId] as const,
}
