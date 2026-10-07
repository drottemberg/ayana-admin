export const Feature = {
  DEVICES: 'DEVICES',
  CONTRACTS: 'CONTRACTS',
  LOCATIONS: 'STORES',
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
  DEVICE_TYPE: 'DEVICE_TYPE',
  ORDERS: 'ORDERS',
} as const

export type Feature = (typeof Feature)[keyof typeof Feature]
export type FeatureFlags = Partial<Record<Feature, boolean>>
