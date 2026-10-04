import type { QueryClient } from '@tanstack/react-query'

import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import type { PageHeaderProps } from '@/components/ui/page-header'
import {
  archiveDeviceTypeGroupRequest,
  deleteDeviceTypeGroupRequest,
  setDeviceTypeGroupStatusRequest,
  unarchiveDeviceTypeGroupRequest,
  type DeviceTypeGroup,
  DeviceTypeGroupStatus,
  type DeviceTypeGroupStatus as DeviceTypeGroupDisplayStatus,
} from '@/features/device-types/api'
import { deviceTypeConfigsQueryKeys } from '@/features/device-types/query-keys'
import { Modals } from '@/providers/modal'
import { Drawer, DrawerId } from '@/providers/drawer'

export const DeviceTypeGroupService = {
  getStatus(group: DeviceTypeGroup): DeviceTypeGroupDisplayStatus {
    if (group.isDeleted) return DeviceTypeGroupStatus.DELETED
    if (group.isArchived) return DeviceTypeGroupStatus.ARCHIVED
    return group.status === 'DISABLED' ? DeviceTypeGroupStatus.DISABLED : DeviceTypeGroupStatus.ACTIVE
  },

  showCreateDrawer() {
    Drawer.show(DrawerId.DeviceTypeGroup, {})
  },

  showEditDrawer(group: DeviceTypeGroup) {
    Drawer.show(DrawerId.DeviceTypeGroup, { group })
  },

  getListHeaderActions(): Pick<PageHeaderProps, 'primaryAction' | 'secondaryAction' | 'options'> {
    return {
      primaryAction: {
        children: 'Add Device Type Group',
        onClick: () => this.showCreateDrawer(),
      },
    }
  },

  getListEmptyAction() {
    return {
      name: 'Add Device Type Group',
      onClick: () => this.showCreateDrawer(),
    }
  },

  getDetailHeaderActions(group?: DeviceTypeGroup): Pick<PageHeaderProps, 'options'> {
    return {
      options: group
        ? [
            {
              label: 'Edit',
              onClick: () => this.showEditDrawer(group),
            },
          ]
        : undefined,
    }
  },

  getRowActions(group: DeviceTypeGroup, queryClient: QueryClient): DropdownActionItem[] {
    const invalidate = async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: deviceTypeConfigsQueryKeys.groups }),
        queryClient.invalidateQueries({ queryKey: deviceTypeConfigsQueryKeys.all }),
      ])
    }

    return [
      {
        label: 'Edit',
        onClick: () => this.showEditDrawer(group),
      },
      {
        label: group.isArchived ? 'Unarchive' : 'Archive',
        onClick: async () => {
          if (group.isArchived) {
            await unarchiveDeviceTypeGroupRequest(group.id)
          } else {
            await archiveDeviceTypeGroupRequest(group.id)
          }
          await invalidate()
        },
      },
      {
        label: 'Destroy',
        variant: 'destructive',
        onClick: async () => {
          const confirmed = await Modals.confirm({
            title: `Destroy ${group.name}?`,
            content: group.deviceTypeCount
              ? 'This group still has device types. Delete or move them before destroying the group.'
              : 'This will remove the device type group. This action cannot be undone.',
            okText: group.deviceTypeCount ? 'OK' : 'Destroy',
            okButtonProps: { variant: group.deviceTypeCount ? 'default' : 'destructive' },
            cancelText: group.deviceTypeCount ? undefined : 'Cancel',
          })
          if (!confirmed || group.deviceTypeCount) return

          await deleteDeviceTypeGroupRequest(group.id)
          await invalidate()
        },
      },
      {
        label: group.status === 'DISABLED' ? 'Enable' : 'Disable',
        onClick: async () => {
          await setDeviceTypeGroupStatusRequest(group.id, group.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED')
          await invalidate()
        },
      },
    ]
  },
}
