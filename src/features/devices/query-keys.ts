export const devicesQueryKeys = {
  all: ['devices'] as const,
  detail: (deviceId: string) => [...devicesQueryKeys.all, deviceId] as const,
  newContract: ['devices', 'new-contract'] as const,
  types: ['deviceTypes'] as const,
  tags: ['devices', 'tags'] as const,
}
