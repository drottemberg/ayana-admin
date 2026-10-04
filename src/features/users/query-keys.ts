export const usersQueryKeys = {
  all: ['users'] as const,
  organization: (organizationId: string) => [...usersQueryKeys.all, 'organization', organizationId] as const,
  detail: (userId: string) => [...usersQueryKeys.all, userId] as const,
}
