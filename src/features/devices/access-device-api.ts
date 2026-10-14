import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { SortOrder, toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'

export type AccessDevice = {
  id: string
  deviceId: string
  name: string
  type: 'GENERIC' | 'AC600' | 'STRIPE_TERMINAL' | string
  purpose: 'ACCESS' | 'CHECK_IN' | 'PAYMENT' | string
  organizationId: string
  organization: { id: string; name: string | null; type: string } | null
  label: string | null
  isActive: boolean
  createdAt: string
}

export type CreateAccessDeviceInput = {
  deviceId: string
  secret: string
  type: 'GENERIC' | 'AC600' | 'STRIPE_TERMINAL'
  organizationId: string
  purpose: 'ACCESS' | 'CHECK_IN' | 'PAYMENT'
  label?: string
  isActive: boolean
}

export type CreatedAccessDevice = AccessDevice & { secret: string }

export const accessDevicesListConfig = {
  url: '/access/devices/list',
  toPayload: (state: DataTableState<AccessDevice>, filters?: Record<string, unknown>) => ({
    ...toApiListDto(state, filters),
    orderBy: 'createdAt',
    order: SortOrder.desc,
  }),
  toResult: (result: ApiListResult<unknown>) => toDataTableResult(result as ApiListResult<AccessDevice>),
}

export async function getAccessDevicesRequest(
  state: DataTableState<AccessDevice>,
  filters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<AccessDevice>> {
  const result = await apiClient.post<ApiListResult<AccessDevice>>(
    accessDevicesListConfig.url,
    accessDevicesListConfig.toPayload(state, filters),
  )
  return accessDevicesListConfig.toResult(result)
}

export function createAccessDeviceRequest(payload: CreateAccessDeviceInput) {
  return apiClient.post<CreatedAccessDevice>('/access/devices', payload)
}
