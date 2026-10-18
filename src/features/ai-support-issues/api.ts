import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import type { AiSupportIssue, AiSupportIssueDetails } from './types'

const baseUrl = '/ai-support-issues'

export async function getAiSupportIssuesRequest(
  state: DataTableState<AiSupportIssue>,
  filters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<AiSupportIssue>> {
  const result = await apiClient.post<ApiListResult<AiSupportIssue>>(`${baseUrl}/list`, toApiListDto(state, filters))
  return toDataTableResult(result)
}

export function getAiSupportIssueRequest(issueId: string): Promise<AiSupportIssueDetails> {
  return apiClient.get<AiSupportIssueDetails>(`${baseUrl}/${issueId}`)
}

export function updateAiSupportIssueRequest(
  issueId: string,
  input: {
    status?: AiSupportIssueDetails['status']
    assignedToUserId?: string | null
    resolution?: string
    note?: string
    resolutionMessage?: string
    sendResolutionEmail?: boolean
    sendResolutionChannel?: boolean
  },
): Promise<AiSupportIssueDetails> {
  return apiClient.patch<AiSupportIssueDetails>(`${baseUrl}/${issueId}`, input)
}
