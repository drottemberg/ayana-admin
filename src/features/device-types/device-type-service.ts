import type { QueryClient } from '@tanstack/react-query'

import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import type { PageHeaderProps } from '@/components/ui/page-header'
import {
  archiveDeviceTypeConfigRequest,
  deleteDeviceTypeConfigRequest,
  DeviceTypeStatus,
  setDeviceTypeConfigStatusRequest,
  unarchiveDeviceTypeConfigRequest,
  type DeviceTypeConfig,
  type DeviceTypeGroup,
  type DeviceTypeStatus as DeviceTypeDisplayStatus,
} from '@/features/device-types/api'
import { deviceTypeConfigsQueryKeys } from '@/features/device-types/query-keys'
import { getDeviceTypeLabel } from '@/features/device-types/utils'
import { Modals } from '@/providers/modal'
import { Drawer, DrawerId } from '@/providers/drawer'

type DeviceTypeActionOptions = {
  groups?: DeviceTypeGroup[]
  existingTypes?: string[]
  queryClient?: QueryClient
  extraInvalidateQueryKey?: readonly unknown[]
}

async function invalidateDeviceTypes(queryClient?: QueryClient, extraInvalidateQueryKey?: readonly unknown[]) {
  if (!queryClient) return

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: deviceTypeConfigsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: deviceTypeConfigsQueryKeys.groups }),
    extraInvalidateQueryKey ? queryClient.invalidateQueries({ queryKey: extraInvalidateQueryKey }) : Promise.resolve(),
  ])
}

export const DeviceTypeService = {
  getStatus(config: DeviceTypeConfig): DeviceTypeDisplayStatus {
    if (config.isDeleted) return DeviceTypeStatus.DELETED
    if (config.isArchived) return DeviceTypeStatus.ARCHIVED
    return config.status === 'DISABLED' ? DeviceTypeStatus.DISABLED : DeviceTypeStatus.ACTIVE
  },

  showCreateDrawer(
    group: DeviceTypeGroup,
    groups: DeviceTypeGroup[] = [],
    existingTypes: string[] = [],
    invalidateQueryKey?: readonly unknown[],
  ) {
    Drawer.show(DrawerId.DeviceTypeConfig, { group, groups, existingTypes, invalidateQueryKey })
  },

  showEditDrawer(config: DeviceTypeConfig, groups: DeviceTypeGroup[] = [], existingTypes: string[] = []) {
    Drawer.show(DrawerId.DeviceTypeConfig, { config, groups, existingTypes })
  },

  showDocumentationDrawer(config: DeviceTypeConfig) {
    Drawer.show(DrawerId.DeviceTypeDocumentation, { config })
  },

  getDetailHeaderActions(
    group: DeviceTypeGroup | undefined,
    groups: DeviceTypeGroup[] = [],
    existingTypes: string[] = [],
    invalidateQueryKey?: readonly unknown[],
  ): Pick<PageHeaderProps, 'primaryAction'> {
    return {
      primaryAction: group
        ? {
            children: 'Add type',
            onClick: () => this.showCreateDrawer(group, groups, existingTypes, invalidateQueryKey),
          }
        : undefined,
    }
  },

  getRowActions(config: DeviceTypeConfig, options: DeviceTypeActionOptions = {}): DropdownActionItem[] {
    const { groups = [], existingTypes = [], queryClient, extraInvalidateQueryKey } = options

    return [
      {
        label: 'Edit',
        onClick: () => this.showEditDrawer(config, groups, existingTypes),
      },
      {
        label: 'Add/edit documentation',
        onClick: () => this.showDocumentationDrawer(config),
      },
      {
        label: config.isArchived ? 'Unarchive' : 'Archive',
        onClick: async () => {
          if (config.isArchived) {
            await unarchiveDeviceTypeConfigRequest(config.id)
          } else {
            await archiveDeviceTypeConfigRequest(config.id)
          }
          await invalidateDeviceTypes(queryClient, extraInvalidateQueryKey)
        },
      },
      {
        label: 'Destroy',
        variant: 'destructive',
        onClick: async () => {
          const confirmed = await Modals.confirm({
            title: `Destroy ${getDeviceTypeLabel(config.code)}?`,
            content:
              'This will remove this device type and its variable mapping. Existing devices may lose their type metadata.',
            okText: 'Destroy',
            okButtonProps: { variant: 'destructive' },
            cancelText: 'Cancel',
          })
          if (!confirmed) return

          await deleteDeviceTypeConfigRequest(config.id)
          await invalidateDeviceTypes(queryClient, extraInvalidateQueryKey)
        },
      },
      {
        label: config.status === 'DISABLED' ? 'Enable' : 'Disable',
        onClick: async () => {
          await setDeviceTypeConfigStatusRequest(config.id, config.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED')
          await invalidateDeviceTypes(queryClient, extraInvalidateQueryKey)
        },
      },
    ]
  },
}
