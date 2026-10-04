export const DrawerId = {
  CreateDevice: 'create-device',
  CreateContract: 'create-contract',
  CreateStore: 'create-store',
  CreateCustomer: 'create-customer',
  CreatePartner: 'create-partner',
  CreateProduct: 'create-product',
  CreateUser: 'create-user',
  CreateMedia: 'create-media',
  EditMedia: 'edit-media',
  MediaCampaign: 'media-campaign',
  DeviceTypeGroup: 'device-type-group',
  DeviceTypeConfig: 'device-type-config',
  DeviceTypeDocumentation: 'device-type-documentation',
  AddDevicesToSet: 'add-devices-to-set',
  DeviceGroup: 'device-group',
  StoreGroup: 'store-group',
} as const

export type DrawerId = (typeof DrawerId)[keyof typeof DrawerId]
