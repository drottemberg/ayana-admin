import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { SortOrder, toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import type { Customer } from '@/types/customer'
import type {
  CreateProductPayload,
  Product,
  ProductBrand,
  ProductDeviceHistory,
  ProductDeviceHistoryPeriod,
  UpdateProductPayload,
} from '@/types/product'

type ProductRecord = {
  id: string
  name: string
  customerId: string
  customer?: Customer
  brandId?: string | null
  brand?: ProductBrand | null
  status?: Product['status']
  isArchived?: boolean
  isDeleted?: boolean
  createdAt: string
  updatedAt?: string
}

type ProductDeviceHistoryPeriodRecord = {
  id: string
  productId: string
  deviceId: string
  assignedAt: string
  unassignedAt?: string | null
}

type ProductDeviceHistoryRecord = {
  id: string
  productId: string
  deviceId: string
  product: ProductRecord
  status: ProductDeviceHistory['status']
  assignedAt: string
  unassignedAt?: string | null
  history?: ProductDeviceHistoryPeriodRecord[]
}

const PRODUCTS_LIST_URL = '/products/list'

export function toProduct(record: ProductRecord): Product {
  return {
    id: record.id,
    name: record.name,
    customer: record.customer ?? { id: record.customerId, name: '', type: 'CUSTOMER' as Customer['type'] },
    brand: record.brand ?? null,
    status: record.isDeleted ? 'DELETED' : record.isArchived ? 'ARCHIVED' : record.status,
    isArchived: record.isArchived,
    isDeleted: record.isDeleted,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function toProductDeviceHistoryPeriod(record: ProductDeviceHistoryPeriodRecord): ProductDeviceHistoryPeriod {
  return {
    id: record.id,
    productId: record.productId,
    deviceId: record.deviceId,
    assignedAt: record.assignedAt,
    unassignedAt: record.unassignedAt ?? null,
  }
}

function toProductDeviceHistory(record: ProductDeviceHistoryRecord): ProductDeviceHistory {
  return {
    id: record.id,
    productId: record.productId,
    deviceId: record.deviceId,
    product: toProduct(record.product),
    status: record.status,
    assignedAt: record.assignedAt,
    unassignedAt: record.unassignedAt ?? null,
    history: (record.history ?? []).map(toProductDeviceHistoryPeriod),
  }
}

function toProductsListPayload(tableState: DataTableState<Product>, hiddenFilters?: Record<string, unknown>) {
  const f = tableState.filters as Record<string, string[] | undefined>
  const single = (key: string) => f[key]?.[0]

  return toApiListDto(tableState, {
    status: f.status,
    customerId: single('customerId'),
    brandId: single('brandId'),
    deviceId: single('deviceId'),
    ...hiddenFilters,
  })
}

export const productsListConfig = {
  url: PRODUCTS_LIST_URL,
  toPayload: toProductsListPayload,
  toResult: (result: ApiListResult<unknown>) => toProductsTableResult(result as ApiListResult<ProductRecord>),
}

export const deviceProductHistoryListConfig = {
  url: (deviceId: string) => `/devices/${deviceId}/products/history/list`,
  toPayload: (tableState: DataTableState<ProductDeviceHistory>, hiddenFilters?: Record<string, unknown>) =>
    toApiListDto(tableState, hiddenFilters),
  toResult: (result: ApiListResult<unknown>) =>
    toProductDeviceHistoryTableResult(result as ApiListResult<ProductDeviceHistoryRecord>),
}

export function toProductsTableResult(result: ApiListResult<ProductRecord>): DataTableAsyncResult<Product> {
  return toDataTableResult({ ...result, items: result.items.map(toProduct) })
}

export function toProductDeviceHistoryTableResult(
  result: ApiListResult<ProductDeviceHistoryRecord>,
): DataTableAsyncResult<ProductDeviceHistory> {
  return toDataTableResult({ ...result, items: result.items.map(toProductDeviceHistory) })
}

export async function getProductBrandsRequest(customerId?: string): Promise<ProductBrand[]> {
  return apiClient.get<ProductBrand[]>('/products/brands', { params: { customerId } })
}

export async function getProductFilterOptionsRequest(
  filter: 'customer' | 'brand',
  search: string,
  page: number,
  filters?: Record<string, unknown>,
) {
  return apiClient.post<{ items: { id: string; label: string }[]; total: number }>('/products/list/filters', {
    filter,
    filters,
    search: search.trim() || undefined,
    page,
    limit: 20,
    order: SortOrder.asc,
  })
}

export async function createProductBrandRequest(payload: { customerId: string; name: string }): Promise<ProductBrand> {
  return apiClient.post<ProductBrand>('/products/brands', payload)
}

export async function getProductsRequest(
  tableState: DataTableState<Product>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<Product>> {
  const result = await apiClient.post<ApiListResult<ProductRecord>>(
    productsListConfig.url,
    productsListConfig.toPayload(tableState, hiddenFilters),
  )
  return toProductsTableResult(result)
}

export async function getDeviceProductHistoryRequest(
  deviceId: string,
  tableState: DataTableState<ProductDeviceHistory>,
): Promise<DataTableAsyncResult<ProductDeviceHistory>> {
  const result = await apiClient.post<ApiListResult<ProductDeviceHistoryRecord>>(
    deviceProductHistoryListConfig.url(deviceId),
    deviceProductHistoryListConfig.toPayload(tableState),
  )
  return toProductDeviceHistoryTableResult(result)
}

export async function getProductRequest(productId: string): Promise<Product> {
  const product = await apiClient.get<ProductRecord>(`/products/${productId}`)
  return toProduct(product)
}

export async function createProductRequest(payload: CreateProductPayload): Promise<Product> {
  const product = await apiClient.post<ProductRecord>('/products', payload)
  return toProduct(product)
}

export async function updateProductRequest(productId: string, payload: UpdateProductPayload): Promise<Product> {
  const product = await apiClient.patch<ProductRecord>(`/products/${productId}`, payload)
  return toProduct(product)
}

export async function setProductStatusRequest(
  productId: string,
  status: Extract<Product['status'], 'ACTIVE' | 'DISABLED'>,
): Promise<Product> {
  const product = await apiClient.patch<ProductRecord>(`/products/${productId}/status`, { status })
  return toProduct(product)
}

export async function archiveProductRequest(productId: string): Promise<Product> {
  const product = await apiClient.post<ProductRecord>(`/products/${productId}/archive`)
  return toProduct(product)
}

export async function unarchiveProductRequest(productId: string): Promise<Product> {
  const product = await apiClient.post<ProductRecord>(`/products/${productId}/unarchive`)
  return toProduct(product)
}

export async function deleteProductsRequest(productIds: string[]): Promise<void> {
  await apiClient.delete('/products', { ids: productIds })
}

export async function assignProductDeviceRequest(productId: string, deviceId: string): Promise<void> {
  await apiClient.post(`/products/${productId}/devices`, { deviceId })
}

export async function unassignProductDeviceRequest(productId: string, deviceId: string): Promise<void> {
  await apiClient.delete(`/products/${productId}/devices/${deviceId}`)
}
