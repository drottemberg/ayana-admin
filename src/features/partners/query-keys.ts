export const partnersQueryKeys = {
  all: ['partners'] as const,
  detail: (partnerId: string) => [...partnersQueryKeys.all, partnerId] as const,
}
