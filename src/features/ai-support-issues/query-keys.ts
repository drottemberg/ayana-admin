export const aiSupportIssueQueryKeys = {
  all: ['ai-support-issues'] as const,
  detail: (issueId: string) => [...aiSupportIssueQueryKeys.all, issueId] as const,
}
