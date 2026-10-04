export const productsQueryKeys = {
  all: ['products'] as const,
  detail: (productId: string) => [...productsQueryKeys.all, productId] as const,
  brands: ['productBrands'] as const,
}
