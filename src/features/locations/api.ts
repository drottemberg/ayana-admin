import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { getCustomersListRequest } from '@/features/customers/api'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import type { Address } from '@/types/address'
import type { Location } from '@/types/location'
import type { OrganizationStatus } from '@/types/organization'
import { getAppMode } from '@/features/app/app-mode'

const LOCATIONS_LIST_URL = '/locations/list'

export type LocationFilterDimension = 'customer'

export type CreateLocationPayload = {
  name: string
  customerId: string
  phone?: string
  email?: string
  timezone?: string
  currency?: string
  description?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  address?: Address
}

export type UpdateLocationPayload = Omit<CreateLocationPayload, 'customerId'>

export async function fetchLocationFilterOptions(filter: LocationFilterDimension, search: string, page: number) {
  return apiClient.post<{ items: { id: string; label: string }[]; total: number }>('/locations/list/filters', {
    filter,
    search,
    page,
    limit: 20,
  })
}

export async function fetchLocationCustomerOptions(search: string) {
  return getCustomersListRequest({ contractId: null }, search)
}

export function toLocationsListPayload(tableState: DataTableState<Location>, hiddenFilters?: Record<string, unknown>) {
  return toApiListDto(tableState, hiddenFilters)
}

export const locationsListConfig = {
  url: LOCATIONS_LIST_URL,
  toPayload: toLocationsListPayload,
  toResult: (result: ApiListResult<unknown>): DataTableAsyncResult<Location> =>
    toDataTableResult(result as ApiListResult<Location>),
}

export async function getLocationsRequest(
  tableState: DataTableState<Location>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<Location>> {
  const result = await apiClient.post<ApiListResult<Location>>(
    LOCATIONS_LIST_URL,
    toLocationsListPayload(tableState, hiddenFilters),
  )

  return toDataTableResult(result)
}

export async function getAllLocationsForCustomerRequest(customerId: string): Promise<Location[]> {
  const limit = 100
  const requestConfig = getAppMode() === 'customer' ? { headers: { 'x-org-id': customerId } } : undefined
  const firstPage = await apiClient.post<ApiListResult<Location>>(LOCATIONS_LIST_URL, {
    customerId,
    page: 1,
    limit,
  }, requestConfig)
  const pageCount = Math.ceil(firstPage.total / limit)
  if (pageCount <= 1) return firstPage.items

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      apiClient.post<ApiListResult<Location>>(LOCATIONS_LIST_URL, {
        customerId,
        page: index + 2,
        limit,
      }, requestConfig),
    ),
  )

  return [...firstPage.items, ...remainingPages.flatMap((page) => page.items)]
}

export async function getLocationRequest(locationId: string): Promise<Location> {
  return apiClient.get<Location>(`/locations/${locationId}`)
}

export async function createLocationRequest(payload: CreateLocationPayload): Promise<Location> {
  return apiClient.post<Location>('/locations', payload)
}

export async function updateLocationRequest(locationId: string, payload: UpdateLocationPayload): Promise<Location> {
  return apiClient.patch<Location>(`/locations/${locationId}`, payload)
}

export async function setLocationStatusRequest(locationId: string, status: OrganizationStatus): Promise<void> {
  await apiClient.patch(`/locations/${locationId}/status`, { status })
}

export async function deleteLocationRequest(locationId: string): Promise<void> {
  await apiClient.delete(`/locations/${locationId}`)
}
