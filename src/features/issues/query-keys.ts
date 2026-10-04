export const issuesQueryKeys = {
  all: ['issues'] as const,
  detail: (issueId: string) => [...issuesQueryKeys.all, issueId] as const,
}
