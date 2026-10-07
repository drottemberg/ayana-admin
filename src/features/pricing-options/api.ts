import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import type { CreatePricingOptionPayload, PricingOption, UpdatePricingOptionPayload } from '@/types/pricing-option'

const PRICING_OPTIONS_LIST_URL = '/pricing-options/list'

function withCustomer(path: string, customerId?: string) {
  if (!customerId) return path
  const params = new URLSearchParams({ customerId })
  return `${path}${path.includes('?') ? '&' : '?'}${params.toString()}`
}

export async function getPricingOptionsRequest(
  tableState: DataTableState<PricingOption>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<PricingOption>> {
  const result = await apiClient.post<ApiListResult<PricingOption>>(
    PRICING_OPTIONS_LIST_URL,
    toApiListDto(tableState, hiddenFilters),
  )
  return toDataTableResult(result)
}

export async function getPricingOptionRequest(customerId: string, pricingOptionId: string): Promise<PricingOption> {
  return apiClient.get<PricingOption>(withCustomer(`/pricing-options/${pricingOptionId}`, customerId))
}

export async function createPricingOptionRequest(
  customerId: string,
  payload: CreatePricingOptionPayload,
): Promise<PricingOption> {
  return apiClient.post<PricingOption>(withCustomer('/pricing-options', customerId), payload)
}

export async function updatePricingOptionRequest(
  customerId: string,
  pricingOptionId: string,
  payload: UpdatePricingOptionPayload,
): Promise<PricingOption> {
  return apiClient.patch<PricingOption>(withCustomer(`/pricing-options/${pricingOptionId}`, customerId), payload)
}

export async function setPricingOptionStatusRequest(
  customerId: string,
  pricingOptionId: string,
  isActive: boolean,
): Promise<void> {
  await apiClient.patch(withCustomer(`/pricing-options/${pricingOptionId}/status`, customerId), { isActive })
}

export async function deletePricingOptionRequest(customerId: string, pricingOptionId: string): Promise<void> {
  await apiClient.delete(withCustomer(`/pricing-options/${pricingOptionId}`, customerId))
}
