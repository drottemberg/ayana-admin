import { apiClient } from '@/lib/api-client'
import { SortOrder, type ApiListResult } from '@/lib/api-types'
import type { IssueDto } from '@/lib/entities/issue.entity'

export function getIssuesListDtoRequest(): Promise<ApiListResult<IssueDto>> {
  return apiClient.post<ApiListResult<IssueDto>>('/issues/list', {
    limit: 100,
    orderBy: 'createdAt',
    order: SortOrder.desc,
  })
}

export function getIssueDtoRequest(issueId: string): Promise<IssueDto> {
  return apiClient.get<IssueDto>(`/issues/${issueId}`)
}
