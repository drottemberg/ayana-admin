import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { SortOrder, toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import type { Address } from '@/types/address'
import type { CreateStorePayload, Store, StoreDeviceHistory, StoreDeviceHistoryPeriod } from '@/types/store'
import { OrganizationType, type Organization, type OrganizationStatus } from '@/types/organization'
import { apiClient } from '@/lib/api-client'

type StoreFilterDimension = 'customer'

const STORES_LIST_URL = '/stores/list'

export async function fetchStoreFilterOptions(filter: StoreFilterDimension, search: string, page: number) {
  return apiClient.post<{ items: { id: string; label: string }[]; total: number }>('/stores/list/filters', {
    filter,
    search,
    page,
    limit: 20,
  })
}

type StoreOrganizationPayload = {
  type: typeof OrganizationType.STORE
  name: string
  customerId: string
  email?: string
  phone?: string
  timezone?: string
  address: {
    street: string
    suite?: string
    city: string
    zip: string
    stateId?: string
    countryId?: string
  }
}

type StoreDeviceHistoryPeriodRecord = {
  id: string
  storeId: string
  deviceId: string
  assignedAt: string
  unassignedAt?: string | null
}

type StoreDeviceHistoryRecord = {
  id: string
  storeId: string
  deviceId: string
  store: Organization
  status: StoreDeviceHistory['status']
  assignedAt: string
  unassignedAt?: string | null
  history?: StoreDeviceHistoryPeriodRecord[]
}

function getAddressLine(address?: Address) {
  return address?.street ?? ''
}

export function toStore(organization: Organization): Store {
  const store = organization as unknown as Store

  return {
    ...store,
    type: OrganizationType.STORE,
    orgStatus: organization.status, // org-level status (ACTIVE/PENDING/DELETED)
  }
}

export function toStoresTableResult(result: ApiListResult<Organization>): DataTableAsyncResult<Store> {
  return toDataTableResult({
    ...result,
    items: result.items.map(toStore),
  })
}

function toStoreDeviceHistoryPeriod(record: StoreDeviceHistoryPeriodRecord): StoreDeviceHistoryPeriod {
  return {
    id: record.id,
    storeId: record.storeId,
    deviceId: record.deviceId,
    assignedAt: record.assignedAt,
    unassignedAt: record.unassignedAt ?? null,
  }
}

function toStoreDeviceHistory(record: StoreDeviceHistoryRecord): StoreDeviceHistory {
  return {
    id: record.id,
    storeId: record.storeId,
    deviceId: record.deviceId,
    store: toStore(record.store),
    status: record.status,
    assignedAt: record.assignedAt,
    unassignedAt: record.unassignedAt ?? null,
    history: (record.history ?? []).map(toStoreDeviceHistoryPeriod),
  }
}

export function toStoresListPayload(tableState: DataTableState<Store>, hiddenFilters?: Record<string, unknown>) {
  const f = tableState.filters as Record<string, string[] | undefined>
  const filters = {
    customerId: f.customerId,
    deviceId: f.deviceId?.[0],
    ...hiddenFilters,
  }

  return toApiListDto(
    {
      ...tableState,
      filters: Object.fromEntries(Object.entries(tableState.filters).filter(([key]) => key !== 'customerId')),
    },
    filters,
  )
}

export const storesListConfig = {
  url: STORES_LIST_URL,
  toPayload: toStoresListPayload,
  toResult: (result: ApiListResult<unknown>) => toStoresTableResult(result as ApiListResult<Organization>),
}

export const deviceStoreHistoryListConfig = {
  url: (deviceId: string) => `/devices/${deviceId}/stores/history/list`,
  toPayload: (tableState: DataTableState<StoreDeviceHistory>, hiddenFilters?: Record<string, unknown>) =>
    toApiListDto(tableState, hiddenFilters),
  toResult: (result: ApiListResult<unknown>) =>
    toStoreDeviceHistoryTableResult(result as ApiListResult<StoreDeviceHistoryRecord>),
}

export function toStoreDeviceHistoryTableResult(
  result: ApiListResult<StoreDeviceHistoryRecord>,
): DataTableAsyncResult<StoreDeviceHistory> {
  return toDataTableResult({ ...result, items: result.items.map(toStoreDeviceHistory) })
}

function toStoreOrganizationPayload(payload: CreateStorePayload): StoreOrganizationPayload {
  const address = payload.address

  return {
    type: OrganizationType.STORE,
    name: payload.name,
    customerId: payload.customerId,
    email: payload.email,
    phone: payload.phone,
    timezone: payload.timezone,
    address: {
      street: getAddressLine(address),
      suite: address?.suite,
      city: address?.city ?? '',
      zip: address?.zip ?? '',
      stateId: address?.stateId,
      countryId: address?.countryId,
    },
  }
}

export async function getStoresListRequest(search?: string): Promise<Store[]> {
  const result = await apiClient.post<ApiListResult<Organization>>(STORES_LIST_URL, {
    search: search?.trim() || undefined,
    limit: 20,
    orderBy: 'name',
    order: SortOrder.asc,
  })

  return result.items.map(toStore)
}

export async function getStoresRequest(
  tableState: DataTableState<Store>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<Store>> {
  const result = await apiClient.post<ApiListResult<Organization>>(
    storesListConfig.url,
    storesListConfig.toPayload(tableState, hiddenFilters),
  )

  return toStoresTableResult(result)
}

export async function getDeviceStoreHistoryRequest(
  deviceId: string,
  tableState: DataTableState<StoreDeviceHistory>,
): Promise<DataTableAsyncResult<StoreDeviceHistory>> {
  const result = await apiClient.post<ApiListResult<StoreDeviceHistoryRecord>>(
    deviceStoreHistoryListConfig.url(deviceId),
    deviceStoreHistoryListConfig.toPayload(tableState),
  )
  return toStoreDeviceHistoryTableResult(result)
}

export async function getStoreRequest(storeId: string): Promise<Store> {
  return toStore(await apiClient.get<Organization>(`/stores/${storeId}`))
}

export async function createStoreRequest(payload: CreateStorePayload): Promise<Store> {
  const organization = await apiClient.post<Organization>('/stores', toStoreOrganizationPayload(payload))
  return toStore(organization)
}

export async function updateStoreRequest(storeId: string, payload: CreateStorePayload): Promise<Store> {
  const organization = await apiClient.patch<Organization>(`/stores/${storeId}`, toStoreOrganizationPayload(payload))

  return toStore(organization)
}

// Real, guarded /stores/* routes — not the removed generic /organizations/:id.
export async function deleteStoreRequest(storeId: string): Promise<void> {
  await apiClient.delete(`/stores/${storeId}`)
}

export async function setStoreStatusRequest(storeId: string, status: OrganizationStatus): Promise<void> {
  await apiClient.patch(`/stores/${storeId}/status`, { status })
}

export async function archiveStoreRequest(storeId: string): Promise<void> {
  await apiClient.post(`/stores/${storeId}/archive`)
}

export async function unarchiveStoreRequest(storeId: string): Promise<void> {
  await apiClient.post(`/stores/${storeId}/unarchive`)
}
