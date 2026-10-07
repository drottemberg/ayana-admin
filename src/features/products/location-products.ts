import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { apiClient } from '@/lib/api-client'

export type ProductLocationVariant = {
  id: string
  name: string
  sku: string | null
  price: number
  basePrice: number
  stock: number
  baseStock: number
  isAvailable: boolean
  isPriceOverridden: boolean
  isStockOverridden: boolean
}

export type ProductLocationSettings = {
  id: string
  name: string
  description: string | null
  isOnline: boolean
  isInStore: boolean
  isSellable: boolean
  isAvailable: boolean
  variants: ProductLocationVariant[]
}

export const productLocationQueryKeys = {
  all: ['product-location-settings'] as const,
  location: (locationId: string) => [...productLocationQueryKeys.all, locationId] as const,
}

export async function getProductLocationSettingsRequest(
  locationId: string,
  state: DataTableState<ProductLocationSettings>,
  customerId?: string,
): Promise<DataTableAsyncResult<ProductLocationSettings>> {
  const items = await apiClient.get<ProductLocationSettings[]>(`/products/locations/${locationId}/manage`, { params: { customerId } })
  const { pageIndex, pageSize } = state.pagination
  return {
    items: items.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    count: items.length,
    pageCount: Math.ceil(items.length / pageSize),
  }
}

export function getProductLocationSettingsForProductRequest(locationId: string, productId: string, customerId?: string) {
  return apiClient.get<ProductLocationSettings>(
    `/products/locations/${locationId}/products/${productId}/manage`,
    { params: { customerId } },
  )
}

export function setProductLocationAvailabilityRequest(locationId: string, productId: string, isAvailable: boolean, customerId?: string) {
  return apiClient.patch(`/products/locations/${locationId}/products/${productId}`, { isAvailable }, { params: { customerId } })
}

export function setProductVariantLocationConfigRequest(
  locationId: string,
  variantId: string,
  config: { isAvailable: boolean; priceOverride: number | null; stockOverride: number | null },
  customerId?: string,
) {
  return apiClient.patch(`/products/locations/${locationId}/variants/${variantId}`, config, { params: { customerId } })
}
