import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { SortOrder, toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import { IssueEntity, type IssueDto } from '@/lib/entities/issue.entity'
import { IssueSeverity, type Issue } from '@/types/issue'

const ISSUES_LIST_URL = '/issues/list'

function toIssue(dto: IssueDto): Issue {
  return new IssueEntity(dto).toJSON()
}

export function toIssuesTableResult(result: ApiListResult<IssueDto>): DataTableAsyncResult<Issue> {
  return toDataTableResult({
    ...result,
    items: result.items.map(toIssue),
  })
}

export function toIssuesListPayload(tableState: DataTableState<Issue>, hiddenFilters?: Record<string, unknown>) {
  return toApiListDto(tableState, {
    severity: tableState.filters.severity?.[0] as IssueSeverity | undefined,
    ...hiddenFilters,
  })
}

export const issuesListConfig = {
  url: ISSUES_LIST_URL,
  toPayload: toIssuesListPayload,
  toResult: (result: ApiListResult<unknown>) => toIssuesTableResult(result as ApiListResult<IssueDto>),
}

export async function getIssuesRequest(
  tableState: DataTableState<Issue>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<Issue>> {
  const result = await apiClient.post<ApiListResult<IssueDto>>(
    issuesListConfig.url,
    issuesListConfig.toPayload(tableState, hiddenFilters),
  )

  return toIssuesTableResult(result)
}

export async function getIssuesListRequest(filters?: Record<string, unknown>): Promise<Issue[]> {
  const result = await apiClient.post<ApiListResult<IssueDto>>(ISSUES_LIST_URL, {
    filters,
    limit: 100,
    orderBy: 'createdAt',
    order: SortOrder.desc,
  })

  return result.items.map(toIssue)
}

export async function getIssueRequest(issueId: string): Promise<Issue> {
  return toIssue(await apiClient.get<IssueDto>(`/issues/${issueId}`))
}
