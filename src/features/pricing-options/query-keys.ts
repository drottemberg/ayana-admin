export const pricingOptionsQueryKeys = {
  all: ['pricing-options'] as const,
  customer: (customerId: string) => [...pricingOptionsQueryKeys.all, 'customer', customerId] as const,
  location: (locationId: string) => [...pricingOptionsQueryKeys.all, 'location', locationId] as const,
  detail: (customerId: string, pricingOptionId: string) =>
    [...pricingOptionsQueryKeys.customer(customerId), pricingOptionId] as const,
}
