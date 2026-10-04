import type { QueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router-dom'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'

import type { DataTableAsyncResult, DataTableCommand, DataTableState } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import type { PageHeaderProps } from '@/components/ui/page-header'
import {
  addDevicesToGroupRequest,
  deleteDeviceGroupRequest,
  removeDeviceFromGroupRequest,
} from '@/features/groups/api'
import { deviceGroupsQueryKeys } from '@/features/groups/query-keys'
import { DeviceService } from '@/features/devices/device-service'
import { getDevicesRequest } from '@/features/devices/api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { Drawer, DrawerId } from '@/providers/drawer'
import { ModalId, Modals } from '@/providers/modal'
import type { SelectTableRow } from '@/providers/modal-types'
import type { Device } from '@/types/device'
import type { DeviceGroup } from '@/types/group'

const deviceSelectColumns: ColumnDef<SelectTableRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'serialNumber', header: 'Serial number' },
  { accessorKey: 'id', header: 'ID' },
]

const toSelectLoader =
  <T extends SelectTableRow>(loader: (state: DataTableState<T>) => Promise<DataTableAsyncResult<T>>) =>
  (state: DataTableState<SelectTableRow>) =>
    loader(state as DataTableState<T>) as Promise<DataTableAsyncResult<SelectTableRow>>

async function deleteGroup(group: DeviceGroup, queryClient: QueryClient) {
  const confirmed = await Modals.confirm({
    title: 'Delete Device Group',
    content: `Delete "${group.name}"? This cannot be undone.`,
    okText: 'Delete',
    okButtonProps: { variant: 'destructive' },
  })

  if (!confirmed) return false

  await deleteDeviceGroupRequest(group.id)
  await queryClient.invalidateQueries({ queryKey: deviceGroupsQueryKeys.all })
  toast.success('Device Group deleted.')

  return true
}

async function removeDevicesFromGroup(groupId: string, devices: Device[], queryClient: QueryClient) {
  if (!devices.length) return

  const confirmed = await Modals.confirm({
    title: 'Remove from group',
    content:
      devices.length === 1
        ? `Remove "${devices[0].name || devices[0].id}" from this group?`
        : `Remove ${devices.length} devices from this group?`,
    okText: 'Remove',
    okButtonProps: { variant: 'destructive' },
  })

  if (!confirmed) return

  await Promise.all(devices.map((device) => removeDeviceFromGroupRequest(groupId, device.id)))
  await queryClient.invalidateQueries({ queryKey: deviceGroupsQueryKeys.devices(groupId) })
  await queryClient.invalidateQueries({ queryKey: deviceGroupsQueryKeys.detail(groupId) })
  toast.success(devices.length === 1 ? 'Device removed from group.' : 'Devices removed from group.')
}

export const DeviceGroupService = {
  showCreateDrawer() {
    Drawer.show(DrawerId.DeviceGroup, {})
  },

  showRenameDrawer(group: DeviceGroup) {
    Drawer.show(DrawerId.DeviceGroup, { group })
  },

  getListHeaderActions(): Pick<PageHeaderProps, 'primaryAction'> {
    return {
      primaryAction: {
        children: '+ Create Group',
        onClick: () => this.showCreateDrawer(),
      },
    }
  },

  getListEmptyAction() {
    return {
      name: '+ Create Group',
      onClick: () => this.showCreateDrawer(),
    }
  },

  getRowActions(group: DeviceGroup, queryClient: QueryClient): DropdownActionItem[] {
    return [
      {
        label: 'Rename',
        onClick: () => this.showRenameDrawer(group),
      },
      {
        label: 'Delete',
        variant: 'destructive',
        onClick: () => void deleteGroup(group, queryClient),
      },
    ]
  },

  getDetailHeaderActions(
    group: DeviceGroup,
    queryClient: QueryClient,
    onDeleted: () => void,
  ): Pick<PageHeaderProps, 'options'> {
    return {
      options: [
        {
          label: 'Rename',
          onClick: () => this.showRenameDrawer(group),
        },
        {
          label: 'Delete',
          variant: 'destructive',
          onClick: async () => {
            const deleted = await deleteGroup(group, queryClient)
            if (deleted) onDeleted()
          },
        },
      ],
    }
  },

  getMemberRowActions(groupId: string, queryClient: QueryClient): (device: Device) => DropdownActionItem[] {
    return (device) => [
      {
        label: 'Remove device from group',
        variant: 'destructive',
        onClick: () => void removeDevicesFromGroup(groupId, [device], queryClient),
      },
    ]
  },

  getMemberTableActions(
    groupId: string,
    queryClient: QueryClient,
    navigate?: NavigateFunction,
  ): (devices: Device[]) => DataTableCommand<Device>[] {
    return (devices) => [
      {
        label: 'Remove from group',
        variant: 'destructive',
        disabled: devices.length === 0,
        onClick: () => void removeDevicesFromGroup(groupId, devices, queryClient),
      },
      ...DeviceService.getDevicePageCommands({ devices, navigate }),
    ]
  },

  async showAddDevicesModal(groupId: string, existingDevices: Device[], queryClient: QueryClient) {
    const existingDeviceIds = new Set(existingDevices.map((device) => device.id))

    await Modals.show(ModalId.SelectTableData, {
      title: 'Add devices to group',
      queryKey: [...devicesQueryKeys.all, 'select-for-device-group', groupId],
      loadData: toSelectLoader<Device>(async (state) => {
        const result = await getDevicesRequest(state)
        return {
          ...result,
          items: result.items.filter((device) => !existingDeviceIds.has(device.id)),
        }
      }),
      columns: deviceSelectColumns,
      searchPlaceholder: 'Search by ID, name, serial...',
      searchColumns: ['id', 'name', 'serialNumber'],
      selectionMode: 'multiple',
      tableKey: `device-groups.${groupId}.add-devices`,
      loadingMessage: 'Loading devices...',
      emptyMessage: 'No devices found.',
      submitLabel: 'Add',
      onSelect: async (selectedDevices: SelectTableRow[]) => {
        const deviceIds = selectedDevices
          .map((device) => device.id)
          .filter((id): id is string => typeof id === 'string')
        if (!deviceIds.length) return

        await addDevicesToGroupRequest(groupId, deviceIds)
        await queryClient.invalidateQueries({ queryKey: deviceGroupsQueryKeys.devices(groupId) })
        await queryClient.invalidateQueries({ queryKey: deviceGroupsQueryKeys.detail(groupId) })
        toast.success(deviceIds.length === 1 ? 'Device added to group.' : 'Devices added to group.')
      },
    })
  },
}
