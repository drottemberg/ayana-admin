export const deviceTypeConfigsQueryKeys = {
  all: ['device-types'] as const,
  detail: (id: string) => [...deviceTypeConfigsQueryKeys.all, id] as const,
  groups: ['device-type-groups'] as const,
  groupDetail: (id: string) => [...deviceTypeConfigsQueryKeys.groups, id] as const,
}
