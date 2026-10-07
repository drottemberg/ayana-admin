import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import type { ClientContract } from '@/types/client-contract'

export const clientContractsListConfig = {
  url: '/client-contracts/list',
  toPayload: (state: DataTableState<ClientContract>, filters?: Record<string, unknown>) => {
    const payload = toApiListDto(state, filters)
    return payload.orderBy ? payload : { ...payload, orderBy: 'createdAt', order: 'desc' as const }
  },
  toResult: (result: ApiListResult<unknown>): DataTableAsyncResult<ClientContract> =>
    toDataTableResult(result as ApiListResult<ClientContract>),
}

export async function getClientContractsRequest(
  state: DataTableState<ClientContract>,
  filters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<ClientContract>> {
  const result = await apiClient.post<ApiListResult<ClientContract>>(
    clientContractsListConfig.url,
    clientContractsListConfig.toPayload(state, filters),
  )
  return toDataTableResult(result)
}

export async function getClientContractLocationOptions(search: string, page = 1) {
  const result = await apiClient.post<ApiListResult<{ id: string; name: string }>>('/locations/list', {
    search: search.trim() || undefined,
    page,
    limit: 20,
    orderBy: 'name',
    order: 'asc',
  })
  return { items: result.items.map((location) => ({ id: location.id, label: location.name })), total: result.total }
}

export async function cancelClientContractRequest(id: string) {
  return apiClient.patch<ClientContract>(`/client-contracts/${id}/cancel`, {})
}

export async function resumeClientContractRequest(id: string) {
  return apiClient.patch<ClientContract>(`/client-contracts/${id}/resume`, {})
}
