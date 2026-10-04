import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import { toDevice } from '@/features/devices/api'
import { toStore } from '@/features/stores/api'
import type { Device } from '@/types/device'
import type { Store } from '@/types/store'
import type { DeviceGroup, GroupPayload, StoreGroup } from '@/types/group'

export async function getDeviceGroupsRequest(
  tableState: DataTableState<DeviceGroup>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<DeviceGroup>> {
  const result = await apiClient.post<ApiListResult<DeviceGroup>>(
    '/device-groups/list',
    toApiListDto(tableState, hiddenFilters),
  )

  return toDataTableResult(result)
}

export async function getDeviceGroupRequest(groupId: string): Promise<DeviceGroup> {
  return apiClient.get<DeviceGroup>(`/device-groups/${groupId}`)
}

export async function createDeviceGroupRequest(payload: GroupPayload): Promise<DeviceGroup> {
  return apiClient.post<DeviceGroup>('/device-groups', payload)
}

export async function renameDeviceGroupRequest(groupId: string, payload: GroupPayload): Promise<DeviceGroup> {
  return apiClient.patch<DeviceGroup>(`/device-groups/${groupId}`, payload)
}

export async function deleteDeviceGroupRequest(groupId: string): Promise<void> {
  await apiClient.delete(`/device-groups/${groupId}`)
}

export async function getDeviceGroupDevicesRequest(groupId: string): Promise<Device[]> {
  const devices = await apiClient.get<unknown[]>(`/device-groups/${groupId}/devices`)
  return devices.map((device) => toDevice(device as Parameters<typeof toDevice>[0]))
}

export async function removeDeviceFromGroupRequest(groupId: string, deviceId: string): Promise<void> {
  await apiClient.delete(`/device-groups/${groupId}/devices/${deviceId}`)
}

export async function addDevicesToGroupRequest(groupId: string, deviceIds: string[]): Promise<void> {
  await apiClient.post(`/device-groups/${groupId}/devices`, { deviceIds })
}

export async function getStoreGroupsRequest(
  tableState: DataTableState<StoreGroup>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<StoreGroup>> {
  const result = await apiClient.post<ApiListResult<StoreGroup>>(
    '/store-groups/list',
    toApiListDto(tableState, hiddenFilters),
  )

  return toDataTableResult(result)
}

export async function getStoreGroupRequest(groupId: string): Promise<StoreGroup> {
  return apiClient.get<StoreGroup>(`/store-groups/${groupId}`)
}

export async function createStoreGroupRequest(payload: GroupPayload): Promise<StoreGroup> {
  return apiClient.post<StoreGroup>('/store-groups', payload)
}

export async function renameStoreGroupRequest(groupId: string, payload: GroupPayload): Promise<StoreGroup> {
  return apiClient.patch<StoreGroup>(`/store-groups/${groupId}`, payload)
}

export async function deleteStoreGroupRequest(groupId: string): Promise<void> {
  await apiClient.delete(`/store-groups/${groupId}`)
}

export async function getStoreGroupStoresRequest(groupId: string): Promise<Store[]> {
  const stores = await apiClient.get<unknown[]>(`/store-groups/${groupId}/stores`)
  return stores.map((store) => toStore(store as Parameters<typeof toStore>[0]))
}

export async function removeStoreFromGroupRequest(groupId: string, storeId: string): Promise<void> {
  await apiClient.delete(`/store-groups/${groupId}/stores/${storeId}`)
}

export async function addStoresToGroupRequest(groupId: string, storeIds: string[]): Promise<void> {
  await apiClient.post(`/store-groups/${groupId}/stores`, { storeIds })
}
