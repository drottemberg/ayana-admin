import type { DataTableCommand } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { IssueEntity } from '@/lib/entities/issue.entity'
import { apiClient } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'
import { toast } from 'sonner'
import {
  IssueSeverity,
  IssueSeverityLabel,
  IssueSlaClass,
  IssueSlaClassLabel,
  IssueStatus,
  IssueStatusLabel,
  type Issue,
} from '@/types/issue'
import { issuesQueryKeys } from './query-keys'

export const IssueService = {
  Severity: IssueSeverity,
  Status: IssueStatus,
  SlaClass: IssueSlaClass,

  severityKeys(): IssueSeverity[] {
    return Object.values(IssueSeverity)
  },

  severityToString(severity: IssueSeverity): string {
    return IssueSeverityLabel[severity] ?? severity
  },

  statusKeys(): IssueStatus[] {
    return Object.values(IssueStatus)
  },

  statusToString(status: IssueStatus): string {
    return IssueStatusLabel[status] ?? status
  },

  slaClassKeys(): IssueSlaClass[] {
    return Object.values(IssueSlaClass)
  },

  slaClassToString(slaClass: IssueSlaClass): string {
    return IssueSlaClassLabel[slaClass] ?? slaClass
  },

  toIssue(dto: ConstructorParameters<typeof IssueEntity>[0]): Issue {
    return new IssueEntity(dto).toJSON()
  },

  async markAsResolved(issues: Issue[]) {
    if (!issues.length) return

    await Promise.all(issues.map(issue => apiClient.patch(`/issues/${issue.id}/resolve`)))
    await queryClient.invalidateQueries({ queryKey: issuesQueryKeys.all })
  },

  createTicket(issues: Issue[]) {
    if (!issues.length) return

    toast.info('Ticket creation is not yet available.')
  },

  getActions(issue: Issue): DropdownActionItem[] {
    return [
      {
        label: 'Mark as resolved',
        onClick: () => void this.markAsResolved([issue]),
      },
      {
        label: 'Create ticket',
        onClick: () => this.createTicket([issue]),
      },
    ]
  },

  getTableActions(issues: Issue[]): DataTableCommand<Issue>[] {
    const noSelection = issues.length === 0

    return [
      {
        label: 'Mark as resolved',
        disabled: noSelection,
        onClick: (selectedIssues) => this.markAsResolved(selectedIssues),
      },
      {
        label: 'Create ticket',
        disabled: noSelection,
        onClick: (selectedIssues) => this.createTicket(selectedIssues),
      },
    ]
  },
}
