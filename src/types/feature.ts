export const Feature = {
  DEVICES: 'DEVICES',
  CONTRACTS: 'CONTRACTS',
  STORES: 'STORES',
  PRODUCTS: 'PRODUCTS',
  ISSUES: 'ISSUES',
  MEDIA: 'MEDIA',
  LOGS: 'LOGS',
  DATA: 'DATA',
  PLANOGRAMS: 'PLANOGRAMS',
  INVITATIONS: 'INVITATIONS',
  CUSTOMERS: 'CUSTOMERS',
  USERS: 'USERS',
  MAINTENANCE: 'MAINTENANCE',
  DEVICE_TYPE: 'DEVICE_TYPE',
} as const

export type Feature = (typeof Feature)[keyof typeof Feature]
export type FeatureFlags = Partial<Record<Feature, boolean>>
