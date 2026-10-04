export const contractsQueryKeys = {
  all: ['contracts'] as const,
  detail: (contractId: string) => [...contractsQueryKeys.all, contractId] as const,
}
