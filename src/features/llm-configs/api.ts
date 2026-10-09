import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import type { LlmConfig, LlmConfigInput } from './types'

const baseUrl = '/llm-configs'

export async function getLlmConfigsRequest(state: DataTableState<LlmConfig>): Promise<DataTableAsyncResult<LlmConfig>> {
  const result = await apiClient.post<ApiListResult<LlmConfig>>(`${baseUrl}/list`, toApiListDto(state))
  return toDataTableResult(result)
}

export function createLlmConfigRequest(input: LlmConfigInput): Promise<LlmConfig> {
  return apiClient.post<LlmConfig>(baseUrl, input)
}

export function updateLlmConfigRequest(id: string, input: Partial<LlmConfigInput>): Promise<LlmConfig> {
  return apiClient.patch<LlmConfig>(`${baseUrl}/${id}`, input)
}

export function setDefaultLlmConfigRequest(id: string): Promise<LlmConfig> {
  return apiClient.patch<LlmConfig>(`${baseUrl}/${id}/default`, {})
}
