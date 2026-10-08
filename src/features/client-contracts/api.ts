import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import type { ClientContract, ClientContractCreditMovement } from '@/types/client-contract'
import type { User } from '@/types/user'
import { getAppMode } from '@/features/app/app-mode'

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

export async function getUserCreditMovementsRequest(
  state: DataTableState<ClientContractCreditMovement>,
  userId: string,
): Promise<DataTableAsyncResult<ClientContractCreditMovement>> {
  const payload = toApiListDto(state)
  const result = await apiClient.post<ApiListResult<ClientContractCreditMovement>>(
    '/client-contracts/credits/movements/list',
    { ...payload, userId },
  )
  return toDataTableResult(result)
}

export async function getUserCreditWalletBalancesRequest(userId: string) {
  return apiClient.get<{ items: Array<{ customerId: string; customerName: string; balance: number; unlimited: boolean }> }>(
    `/client-contracts/credits/balance/${userId}`,
  )
}

export async function getCreditMovementsRequest(
  state: DataTableState<ClientContractCreditMovement>,
  filters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<ClientContractCreditMovement>> {
  const result = await apiClient.post<ApiListResult<ClientContractCreditMovement>>(
    '/client-contracts/credits/movements/list',
    toApiListDto(state, filters),
  )
  return toDataTableResult(result)
}

export async function getCreditMovementUserOptions(search: string, page = 1) {
  const result = await apiClient.post<ApiListResult<{ id: string; firstName?: string | null; lastName?: string | null; email?: string | null }>>('/users/list', {
    search: search.trim() || undefined,
    page,
    limit: 20,
    orderBy: 'firstName',
    order: 'asc',
  })
  return {
    items: result.items.map((user) => ({
      id: user.id,
      label: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.id,
    })),
    total: result.total,
  }
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

export async function grantClientContractCreditsRequest(payload: {
  clientContractIds: string[]
  amount: number
  reason: string
  expiresAt?: string
}) {
  return apiClient.post<{ grantedTo: number; creditsEach: number }>('/client-contracts/credits/grant', payload)
}

export async function adjustClientContractCreditsRequest(payload: {
  clientContractId: string
  operation: 'ADD' | 'REMOVE'
  amount: number
  reason: string
  expiresAt?: string
}) {
  return apiClient.post<{ clientContractId: string; operation: 'ADD' | 'REMOVE'; amount: number; balanceAfter: number }>(
    '/client-contracts/credits/adjust',
    payload,
  )
}

export async function getClientContractCreditMovementsRequest(id: string) {
  return apiClient.get<ClientContractCreditMovement[]>(`/client-contracts/${id}/credits/movements`)
}

export async function giftClientCreditsRequest(payload: {
  locationId: string
  userIds: string[]
  amount: number
  reason: string
  expiresAt?: string
}) {
  return apiClient.post<{ giftedTo: number; creditsEach: number; locationId: string }>('/client-contracts/credits/gift', payload)
}

export async function adjustClientWalletCreditsRequest(payload: {
  customerId?: string
  scope: 'ALL' | 'SPECIFIC'
  locationIds: string[]
  userIds: string[]
  operation: 'ADD' | 'REMOVE'
  amount: number
  reason: string
  expiresAt?: string
}) {
  return apiClient.post<{
    operation: 'ADD' | 'REMOVE'
    adjusted: number
    creditsEach: number
    customerId: string
    scope: 'ALL' | 'SPECIFIC'
    locationIds: string[]
    balances: Array<{ userId: string; balance: number }>
  }>('/client-contracts/credits/wallet/adjust', payload, payload.customerId
    ? { headers: { 'x-org-id': payload.customerId } }
    : undefined)
}

export async function searchClientWalletRecipientsRequest(customerId: string, search: string): Promise<User[]> {
  return apiClient.post<User[]>(
    '/client-contracts/credits/wallet/recipients',
    { customerId, search: search.trim() || undefined },
    getAppMode() === 'customer' ? { headers: { 'x-org-id': customerId } } : undefined,
  )
}
