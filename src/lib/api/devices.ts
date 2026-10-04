import { apiClient } from '@/lib/api-client'
import { SortOrder, type ApiListResult } from '@/lib/api-types'
import type { DeviceDto } from '@/lib/entities/device.entity'
import type { DeviceTypeOption } from '@/types/device'

export function getDevicesListDtoRequest(): Promise<ApiListResult<DeviceDto>> {
  return apiClient.post<ApiListResult<DeviceDto>>('/devices/list', {
    limit: 100,
    orderBy: 'createdAt',
    order: SortOrder.desc,
  })
}

export function getDeviceDtoRequest(deviceId: string): Promise<DeviceDto> {
  return apiClient.get<DeviceDto>(`/devices/${deviceId}`)
}

export function getDeviceTypesDtoRequest(): Promise<DeviceTypeOption[]> {
  return apiClient.get<DeviceTypeOption[]>('/devices/types')
}

export function createDeviceDtoRequest(payload: DeviceDto): Promise<DeviceDto> {
  return apiClient.post<DeviceDto>('/devices', payload)
}

export function updateDeviceDtoRequest(deviceId: string, payload: DeviceDto): Promise<DeviceDto> {
  return apiClient.patch<DeviceDto>(`/devices/${deviceId}`, payload)
}
