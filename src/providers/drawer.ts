import NiceModal from '@ebay/nice-modal-react'

import {
  CreateContractDrawer,
  type CreateContractDrawerProps,
} from '@/features/contracts/components/CreateContractDrawer'
import {
  CreateCustomerDrawer,
  type CreateCustomerDrawerProps,
} from '@/features/customers/components/CreateCustomerDrawer'
import { CreateProductDrawer, type CreateProductDrawerProps } from '@/features/products/components/CreateProductDrawer'
import { CreateDeviceDrawer, type CreateDeviceDrawerProps } from '@/features/devices/components/CreateDeviceDrawer'
import {
  AddDevicesToSetDrawer,
  type AddDevicesToSetDrawerProps,
} from '@/features/devices/components/AddDevicesToSetDrawer'
import { CreateStoreDrawer, type CreateStoreDrawerProps } from '@/features/stores/components/CreateStoreDrawer'
import {
  CreateLocationDrawer,
  type CreateLocationDrawerProps,
} from '@/features/locations/components/CreateLocationDrawer'
import { CreateUserDrawer, type CreateUserDrawerProps } from '@/features/users/components/CreateUserDrawer'
import { CreateMediaDrawer, EditMediaDrawer, type MediaDrawerProps } from '@/features/media/components/MediaDrawers'
import {
  MediaCampaignDrawer,
  type MediaCampaignDrawerProps,
} from '@/features/media-campaigns/components/MediaCampaignDrawer'
import {
  DeviceTypeConfigDrawer,
  type DeviceTypeConfigDrawerProps,
} from '@/features/device-types/components/DeviceTypeConfigDrawer'
import {
  DeviceTypeDocumentationDrawer,
  type DeviceTypeDocumentationDrawerProps,
} from '@/features/device-types/components/DeviceTypeDocumentationDrawer'
import {
  DeviceTypeGroupDrawer,
  type DeviceTypeGroupDrawerProps,
} from '@/features/device-types/components/DeviceTypeGroupDrawer'
import { DeviceGroupDrawer, type DeviceGroupDrawerProps } from '@/features/groups/components/DeviceGroupDrawer'
import { StoreGroupDrawer, type StoreGroupDrawerProps } from '@/features/groups/components/StoreGroupDrawer'
import { DrawerId } from '@/providers/drawer-ids'

type DrawerPropsById = {
  [DrawerId.CreateDevice]: CreateDeviceDrawerProps
  [DrawerId.CreateContract]: CreateContractDrawerProps
  [DrawerId.CreateStore]: CreateStoreDrawerProps
  [DrawerId.CreateLocation]: CreateLocationDrawerProps
  [DrawerId.CreateCustomer]: CreateCustomerDrawerProps
  [DrawerId.CreateProduct]: CreateProductDrawerProps
  [DrawerId.CreateUser]: CreateUserDrawerProps
  [DrawerId.CreateMedia]: MediaDrawerProps
  [DrawerId.EditMedia]: MediaDrawerProps
  [DrawerId.MediaCampaign]: MediaCampaignDrawerProps
  [DrawerId.DeviceTypeGroup]: DeviceTypeGroupDrawerProps
  [DrawerId.DeviceTypeConfig]: DeviceTypeConfigDrawerProps
  [DrawerId.DeviceTypeDocumentation]: DeviceTypeDocumentationDrawerProps
  [DrawerId.AddDevicesToSet]: AddDevicesToSetDrawerProps
  [DrawerId.DeviceGroup]: DeviceGroupDrawerProps
  [DrawerId.StoreGroup]: StoreGroupDrawerProps
}

let registryRegistered = false

export function registerDrawerRegistry() {
  if (registryRegistered) return

  NiceModal.register(DrawerId.CreateDevice, CreateDeviceDrawer)
  NiceModal.register(DrawerId.CreateContract, CreateContractDrawer)
  NiceModal.register(DrawerId.CreateStore, CreateStoreDrawer)
  NiceModal.register(DrawerId.CreateLocation, CreateLocationDrawer)
  NiceModal.register(DrawerId.CreateCustomer, CreateCustomerDrawer)
  NiceModal.register(DrawerId.CreateProduct, CreateProductDrawer)
  NiceModal.register(DrawerId.CreateUser, CreateUserDrawer)
  NiceModal.register(DrawerId.CreateMedia, CreateMediaDrawer)
  NiceModal.register(DrawerId.EditMedia, EditMediaDrawer)
  NiceModal.register(DrawerId.MediaCampaign, MediaCampaignDrawer)
  NiceModal.register(DrawerId.DeviceTypeGroup, DeviceTypeGroupDrawer)
  NiceModal.register(DrawerId.DeviceTypeConfig, DeviceTypeConfigDrawer)
  NiceModal.register(DrawerId.DeviceTypeDocumentation, DeviceTypeDocumentationDrawer)
  NiceModal.register(DrawerId.AddDevicesToSet, AddDevicesToSetDrawer)
  NiceModal.register(DrawerId.DeviceGroup, DeviceGroupDrawer)
  NiceModal.register(DrawerId.StoreGroup, StoreGroupDrawer)
  registryRegistered = true
}

export const Drawer = {
  show<K extends keyof DrawerPropsById>(drawerId: K, props: DrawerPropsById[K]) {
    registerDrawerRegistry()

    return NiceModal.show(drawerId, props)
  },

  hide(drawerId: DrawerId) {
    return NiceModal.hide(drawerId)
  },
}

export { DrawerId }
