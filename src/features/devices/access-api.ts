import type { DataTableState } from '@/components/data-table'
import { apiClient } from '@/lib/api-client'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'

export type AccessScan = {
  id: string
  tokenId: string | null
  deviceId: string
  deviceName: string | null
  organizationId: string | null
  organizationName: string | null
  userId: string | null
  userName: string | null
  allowed: boolean
  reason: string
  createdAt: string
}

export type AccessToken = {
  id: string
  token: string
  organizationId: string
  organizationName?: string | null
  locationScope: 'ALL' | 'SPECIFIC'
  locationIds: string[]
  locationNames?: string[]
  purpose: 'ACCESS' | 'CHECK_IN'
  label: string | null
  userId: string | null
  maxUses: number | null
  usedCount: number
  isActive: boolean
  expiresAt: string | null
  schedule: AccessScheduleSlot[] | null
  createdAt: string
}

export type AccessScheduleSlot = { dayOfWeek: number; startTime: string; endTime: string }

export type CreatedAccessToken = AccessToken & { token: string }

export type MyAccessToken = Pick<AccessToken, 'id' | 'token' | 'label' | 'purpose' | 'organizationId' | 'organizationName' | 'locationScope' | 'locationIds' | 'locationNames' | 'expiresAt'>

export function getMyAccessTokensRequest(customerId: string) {
  return apiClient.get<MyAccessToken[]>('/access/my-tokens', { headers: { 'x-org-id': customerId } })
}

export async function getAccessScansRequest(state: DataTableState<AccessScan>, filters?: Record<string, unknown>) {
  const result = await apiClient.post<ApiListResult<AccessScan>>('/access/scans/list', toApiListDto(state, filters))
  return toDataTableResult(result)
}

export async function getAccessTokensRequest(state: DataTableState<AccessToken>, filters?: Record<string, unknown>) {
  const result = await apiClient.post<ApiListResult<AccessToken>>('/access/tokens/list', toApiListDto(state, filters))
  return toDataTableResult(result)
}

export function createAccessTokenRequest(input: {
  userId: string
  organizationId: string
  locationScope: 'ALL' | 'SPECIFIC'
  locationIds: string[]
  purpose: 'ACCESS' | 'CHECK_IN'
  token?: string
  label?: string
  maxUses?: number
  expiresAt?: string
  schedule?: AccessScheduleSlot[] | null
}, customerId: string) {
  return apiClient.post<CreatedAccessToken>('/access/tokens', input, { headers: { 'x-org-id': customerId } })
}

export function updateAccessTokenRequest(id: string, input: {
  token?: string
  label?: string | null
  maxUses?: number | null
  expiresAt?: string | null
  schedule?: AccessScheduleSlot[] | null
  locationScope?: 'ALL' | 'SPECIFIC'
  locationIds?: string[]
}, customerId?: string) {
  return apiClient.patch<AccessToken>(`/access/tokens/${id}`, input,
    customerId ? { headers: { 'x-org-id': customerId } } : undefined)
}

export function deactivateAccessTokenRequest(id: string, customerId?: string) {
  return apiClient.patch<{ id: string; isActive: boolean }>(`/access/tokens/${id}/deactivate`, {},
    customerId ? { headers: { 'x-org-id': customerId } } : undefined)
}

export function activateAccessTokenRequest(id: string, customerId?: string) {
  return apiClient.patch<{ id: string; isActive: boolean }>(`/access/tokens/${id}/activate`, {},
    customerId ? { headers: { 'x-org-id': customerId } } : undefined)
}
