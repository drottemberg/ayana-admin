export const deviceGroupsQueryKeys = {
  all: ['device-groups'] as const,
  detail: (groupId: string) => [...deviceGroupsQueryKeys.all, groupId] as const,
  devices: (groupId: string) => [...deviceGroupsQueryKeys.detail(groupId), 'devices'] as const,
}

export const storeGroupsQueryKeys = {
  all: ['store-groups'] as const,
  detail: (groupId: string) => [...storeGroupsQueryKeys.all, groupId] as const,
  stores: (groupId: string) => [...storeGroupsQueryKeys.detail(groupId), 'stores'] as const,
}
