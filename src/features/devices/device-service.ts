import { createElement } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'

import type { DataTableAsyncResult, DataTableCommand, DataTableState } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { NO_VALUE_STR } from '@/constants'
import { assignContractDeviceRequest, getContractsRequest } from '@/features/contracts/api'
import { renderStatusBadge as renderContractStatusBadge } from '@/features/contracts/contract-columns'
import { contractsQueryKeys } from '@/features/contracts/query-keys'
import { addDevicesToGroupRequest, getDeviceGroupsRequest } from '@/features/groups/api'
import { deviceGroupsQueryKeys } from '@/features/groups/query-keys'
import {
  archiveDeviceRequest,
  deleteDevicesRequest,
  assignDevicesToSetRequest,
  assignDeviceToStoreRequest,
  getDeviceRequest,
  getDevicesRequest,
  rebootDeviceCommandRequest,
  unarchiveDeviceRequest,
  updateDeviceRequest,
} from '@/features/devices/api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { assignProductDeviceRequest, getProductsRequest } from '@/features/products/api'
import { renderProductStatusBadge } from '@/features/products/product-columns'
import { productsQueryKeys } from '@/features/products/query-keys'
import { OrganizationStatusBadge } from '@/features/organizations/OrganizationStatusBadge'
import { getStoreRequest, getStoresRequest } from '@/features/stores/api'
import { storesQueryKeys } from '@/features/stores/query-keys'
import { queryClient } from '@/lib/query-client'
import { Drawer, DrawerId } from '@/providers/drawer'
import { ModalId, Modals } from '@/providers/modal'
import type { SelectTableRow } from '@/providers/modal-types'
import type { Contract } from '@/types/contract'
import { DeviceEntityStatus, DeviceStatus, DeviceStatusLabel, type Device, type DeviceTypeOption } from '@/types/device'
import type { DeviceGroup } from '@/types/group'
import { OrganizationStatus } from '@/types/organization'
import { ProductStatus, type Product } from '@/types/product'
import type { Store } from '@/types/store'
import { getPortalSafe, Portal } from '@/utils/portal-utils'
import { toast } from 'sonner'

type DeviceActionConfirmOptions = {
  message: string
  destructive?: boolean
}

export type DeviceActionContext = {
  devices: Device[]
  confirm?: (options: DeviceActionConfirmOptions) => Promise<boolean>
  navigate?: NavigateFunction
}

type DeviceListTableAction = {
  label: string
  action: (context: DeviceActionContext) => Promise<void> | void
  disabled?: boolean
  variant?: 'default' | 'destructive'
}

export type DeviceDetailModule =
  | 'devices'
  | 'deviceGroups'
  | 'products'
  | 'mediaCampaigns'
  | 'contracts'
  | 'stores'
  | 'issues'

type DeviceDetailActionEntity =
  | 'deviceSet'
  | 'deviceGroup'
  | 'product'
  | 'mediaCampaign'
  | 'contract'
  | 'store'
  | 'issue'
  | 'device'

type DeviceDetailAction = DropdownActionItem & {
  entity?: DeviceDetailActionEntity
}

type DeviceModuleAction = {
  label: string
  onClick?: () => void
}

function toDropdownAction({ entity, ...action }: DeviceDetailAction): DropdownActionItem {
  void entity
  return action
}

const moduleActionEntity: Partial<Record<DeviceDetailModule, DeviceDetailActionEntity>> = {
  devices: 'deviceSet',
  deviceGroups: 'deviceGroup',
  products: 'product',
  mediaCampaigns: 'mediaCampaign',
  contracts: 'contract',
  stores: 'store',
  issues: 'issue',
}

const confirmDeviceAction = async (context: DeviceActionContext, operation: string, destructive = false) => {
  return (
    context.confirm?.({ message: operation, destructive }) ??
    Modals.confirm({
      operation:
        context.devices.length > 1
          ? `${operation} ${context.devices.length} device(s)`
          : `${operation} "${context.devices[0].name}"`,
      okButtonProps: { variant: destructive ? 'destructive' : 'default' },
    })
  )
}

const getFirstDevice = (devices: Device[]) => devices[0]

const entitySelectColumns: ColumnDef<SelectTableRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'id', header: 'ID' },
]

const deviceSetSelectColumns: ColumnDef<SelectTableRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'serialNumber', header: 'Serial number' },
  { accessorKey: 'devicesCount', header: 'Devices' },
]

function renderSelectCustomerName(row: SelectTableRow) {
  const customer = row.customer
  return customer && typeof customer === 'object' && 'name' in customer
    ? String(customer.name || NO_VALUE_STR)
    : NO_VALUE_STR
}

const productSelectColumns: ColumnDef<SelectTableRow>[] = [
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => renderProductStatusBadge({ status: row.original.status as Product['status'] }),
  },
  { accessorKey: 'name', header: 'Name' },
  {
    accessorKey: 'customer',
    header: 'Customer',
    cell: ({ row }) => renderSelectCustomerName(row.original),
    enableSorting: false,
  },
]

const storeSelectColumns: ColumnDef<SelectTableRow>[] = [
  {
    accessorKey: 'orgStatus',
    header: 'Status',
    cell: ({ row }) =>
      createElement(OrganizationStatusBadge, {
        status: row.original.orgStatus as Store['orgStatus'],
        isDeleted: Boolean(row.original.isDeleted),
        isArchived: Boolean(row.original.isArchived),
      }),
  },
  { accessorKey: 'name', header: 'Name' },
  {
    accessorKey: 'customer',
    header: 'Customer',
    cell: ({ row }) => renderSelectCustomerName(row.original),
    enableSorting: false,
  },
]

const contractSelectColumns: ColumnDef<SelectTableRow>[] = [
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) =>
      renderContractStatusBadge({
        status: row.original.status as Contract['status'],
        isDeleted: Boolean(row.original.isDeleted),
        isArchived: Boolean(row.original.isArchived),
      }),
  },
  { accessorKey: 'name', header: 'Name' },
  {
    accessorKey: 'customer',
    header: 'Customer',
    cell: ({ row }) => renderSelectCustomerName(row.original),
    enableSorting: false,
  },
]

const toSelectLoader =
  <T extends SelectTableRow>(loader: (state: DataTableState<T>) => Promise<DataTableAsyncResult<T>>) =>
  (state: DataTableState<SelectTableRow>) =>
    loader(state as DataTableState<T>) as Promise<DataTableAsyncResult<SelectTableRow>>

const getSelectedId = (selected: SelectTableRow[] | undefined) => {
  const id = selected?.[0]?.id
  return typeof id === 'string' ? id : undefined
}

const getSelectRowId = (row: SelectTableRow) => (typeof row.id === 'string' ? row.id : undefined)

const getSelectedRows = (selected: unknown): SelectTableRow[] => (Array.isArray(selected) ? selected : [])

export const DeviceService = {
  Status: DeviceStatus,

  getDisplayName(device: Pick<Device, 'name'>): string {
    return device.name?.trim() || NO_VALUE_STR
  },

  statusKeys(): DeviceStatus[] {
    return Object.values(DeviceStatus)
  },

  statusToString(status: DeviceStatus): string {
    return DeviceStatusLabel[status] ?? status
  },

  getTypeLabel(type: Device['type'], deviceTypes: DeviceTypeOption[] = []): string {
    if (typeof type === 'string') {
      const foundType = deviceTypes.find((deviceType) => deviceType.id === type)
      return foundType ? foundType.name : type
    }
    return type.name
  },

  getTypeLabels(device: Device, deviceTypes: DeviceTypeOption[] = []): string[] {
    const types = Array.isArray(device.type) ? device.type : [device.type]
    return types.filter(Boolean).map((type) => this.getTypeLabel(type, deviceTypes))
  },

  getTypeLabelsFromQuery(device: Device): string[] {
    const queryDeviceTypes = queryClient.getQueryData<DeviceTypeOption[]>(devicesQueryKeys.types) ?? []
    return this.getTypeLabels(device, queryDeviceTypes)
  },

  getTypeIds(device: Device): string[] {
    const types = Array.isArray(device.type) ? device.type : [device.type]

    return types
      .map((type) => (typeof type === 'string' ? type : type.id))
      .filter(Boolean)
      .map((type) => type.toLowerCase())
  },

  getDisplayTypes(device: Device): string[] {
    if (device.isSet && device.deviceItems?.length) {
      const queryDeviceTypes = queryClient.getQueryData<DeviceTypeOption[]>(devicesQueryKeys.types) ?? []
      const seen = new Set<string>()
      return device.deviceItems.flatMap((child) =>
        this.getTypeLabels(child, queryDeviceTypes).filter((t) => t && !seen.has(t) && seen.add(t)),
      )
    }
    return this.getTypeLabelsFromQuery(device)
  },

  getDisplayTags(device: Device): string[] {
    if (device.isSet && device.deviceItems?.length) {
      const seen = new Set<string>()
      return device.deviceItems.flatMap((child) => (child.tags ?? []).filter((t) => t && !seen.has(t) && seen.add(t)))
    }
    return device.tags ?? []
  },

  openEditInfos(context: DeviceActionContext) {
    const device = getFirstDevice(context.devices)
    if (!device) return

    Drawer.show(DrawerId.CreateDevice, { device })
  },

  async openModifySettings(context: DeviceActionContext) {
    const confirmed = await confirmDeviceAction(context, 'update settings for')
    if (!confirmed) return

    toast.info('Device settings management is not yet available.')
  },

  async assignToStore(context: DeviceActionContext) {
    const activeContractCustomerIds = Array.from(
      new Set(
        context.devices
          .map((device) => device.contract?.customer?.id || device.customer?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    )
    if (activeContractCustomerIds.length !== 1) {
      await Modals.alert({
        title: 'Assign to store',
        content: 'Select device(s) from one active customer contract before assigning a store.',
      })
      return
    }
    const customerId = activeContractCustomerIds[0]
    const currentStoreIds = Array.from(
      new Set(context.devices.map((device) => device.store?.id).filter((id): id is string => Boolean(id))),
    )
    const currentStoreId = currentStoreIds.length === 1 ? currentStoreIds[0] : undefined
    const selected = (await Modals.show(ModalId.SelectTableData, {
      title: 'Assign to store',
      queryKey: [...storesQueryKeys.all, 'select-for-device', customerId],
      loadData: toSelectLoader<Store>(async (state) => {
        const result = await getStoresRequest(state, { customerId, status: OrganizationStatus.ACTIVE })
        let items = result.items

        if (
          currentStoreId &&
          state.pagination.pageIndex === 0 &&
          !state.search.trim() &&
          !items.some((store) => store.id === currentStoreId)
        ) {
          const currentStore = await getStoreRequest(currentStoreId)
          items = [currentStore, ...items]
        }

        return {
          ...result,
          items,
        }
      }),
      columns: storeSelectColumns,
      searchPlaceholder: 'Search by ID, name...',
      searchColumns: ['id', 'name'],
      selectionMode: 'single',
      getRowCanSelect: (row) => getSelectRowId(row) !== currentStoreId,
      tableKey: 'devices.assign-to-store',
      loadingMessage: 'Loading stores...',
      emptyMessage: 'No stores found.',
      submitLabel: 'Assign',
    })) as SelectTableRow[] | undefined
    const storeId = getSelectedId(getSelectedRows(selected))
    if (!storeId) return
    if (currentStoreId && storeId === currentStoreId) return

    await Promise.all(context.devices.map((device) => assignDeviceToStoreRequest(device.id, storeId)))
    toast.success(
      context.devices.length > 1 ? `${context.devices.length} devices assigned to store.` : 'Device assigned to store.',
    )
    await Promise.all([this.refreshDevicesQuery(), queryClient.invalidateQueries({ queryKey: storesQueryKeys.all })])
  },

  async addToSet(context: DeviceActionContext) {
    const excludedDeviceIds = new Set(context.devices.map((device) => device.id))
    const currentParentIds = Array.from(
      new Set(context.devices.map((device) => device.parentId).filter((id): id is string => Boolean(id))),
    )
    const selected = (await Modals.show(ModalId.SelectTableData, {
      title: 'Add to set',
      queryKey: [...devicesQueryKeys.all, 'select-device-set'],
      loadData: toSelectLoader<Device>(async (state) => {
        const result = await getDevicesRequest(state, { isSet: true })
        const visibleItems = result.items.filter((device) => !excludedDeviceIds.has(device.id))
        const removedCount = result.items.length - visibleItems.length
        let items = visibleItems
        const currentParentId = currentParentIds.length === 1 ? currentParentIds[0] : undefined

        if (
          currentParentId &&
          state.pagination.pageIndex === 0 &&
          !state.search.trim() &&
          !items.some((device) => device.id === currentParentId)
        ) {
          const currentParentSet = await getDeviceRequest(currentParentId)
          if (!excludedDeviceIds.has(currentParentSet.id)) {
            items = [currentParentSet, ...items]
          }
        }

        return {
          ...result,
          items,
          count: Math.max(0, result.count - removedCount),
        }
      }),
      columns: deviceSetSelectColumns,
      searchPlaceholder: 'Search by ID, name, serial...',
      searchColumns: ['id', 'name', 'serialNumber'],
      selectionMode: 'single',
      tableKey: 'devices.add-to-set',
      loadingMessage: 'Loading device sets...',
      emptyMessage: 'No device sets found.',
      submitLabel: 'Add',
      initialSelectedIds: currentParentIds.length === 1 ? currentParentIds : undefined,
    })) as SelectTableRow[] | undefined
    const parentId = getSelectedId(getSelectedRows(selected))
    if (!parentId) return

    const deviceIds = context.devices.map((device) => device.id).filter((deviceId) => deviceId !== parentId)
    if (!deviceIds.length) return

    await assignDevicesToSetRequest(deviceIds, parentId)
    toast.success(deviceIds.length > 1 ? `${deviceIds.length} devices added to set.` : 'Device added to set.')
    await this.refreshDevicesQuery()
  },

  addDevicesToCurrentSet(deviceSet: Device) {
    void Drawer.show(DrawerId.AddDevicesToSet, {
      deviceSetId: deviceSet.id,
      existingDeviceIds: deviceSet.deviceItems?.map((device) => device.id) ?? [],
    }).finally(() =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [...devicesQueryKeys.all, 'set-module', deviceSet.id] }),
        queryClient.invalidateQueries({ queryKey: devicesQueryKeys.detail(deviceSet.id) }),
        queryClient.invalidateQueries({ queryKey: devicesQueryKeys.all }),
      ]),
    )
  },

  async addProduct(context: DeviceActionContext) {
    const device = getFirstDevice(context.devices)
    if (!device) return

    const customerId = device.customer?.id || undefined
    const currentProductIds = Array.from(
      new Set(
        context.devices.map((deviceItem) => deviceItem.activeProduct?.id).filter((id): id is string => Boolean(id)),
      ),
    )
    const currentProductId = currentProductIds.length === 1 ? currentProductIds[0] : undefined
    const selected = (await Modals.show(ModalId.SelectTableData, {
      title: 'Add product',
      queryKey: [...productsQueryKeys.all, 'select-for-device', customerId ?? 'all', ProductStatus.ACTIVE],
      loadData: toSelectLoader<Product>((state) =>
        getProductsRequest(state, {
          ...(customerId ? { customerId } : {}),
          status: [ProductStatus.ACTIVE],
        }),
      ),
      columns: productSelectColumns,
      searchPlaceholder: 'Search by ID, name...',
      searchColumns: ['id', 'name'],
      selectionMode: 'single',
      getRowCanSelect: (row) => getSelectRowId(row) !== currentProductId,
      tableKey: 'devices.add-product',
      loadingMessage: 'Loading products...',
      emptyMessage: 'No products found.',
      submitLabel: 'Assign',
    })) as SelectTableRow[] | undefined
    const productId = getSelectedId(getSelectedRows(selected))
    if (!productId) return
    if (currentProductId && productId === currentProductId) return

    await Promise.all(context.devices.map((deviceItem) => assignProductDeviceRequest(productId, deviceItem.id)))
    toast.success(
      context.devices.length > 1
        ? `${context.devices.length} devices assigned to product.`
        : 'Device assigned to product.',
    )
    await Promise.all([this.refreshDevicesQuery(), queryClient.invalidateQueries({ queryKey: productsQueryKeys.all })])
  },

  async addToCampaign(context: DeviceActionContext) {
    const confirmed = await confirmDeviceAction(context, 'add to campaign')
    if (!confirmed) return

    toast.info('Add to campaign is not yet available.')
    await this.refreshDevicesQuery()
  },

  createIssue() {
    toast.info('Create issue is not yet available.')
  },

  async printLabel(context: DeviceActionContext) {
    const confirmed = await confirmDeviceAction(context, 'print label for')
    if (!confirmed) return

    toast.info('Label printing is not yet available.')
  },

  async updateFirmware(context: DeviceActionContext) {
    const confirmed = await confirmDeviceAction(context, 'update firmware for')
    if (!confirmed) return

    toast.info('Firmware update is not yet available.')
    await this.refreshDevicesQuery()
  },

  async rebootDevice(context: DeviceActionContext) {
    const confirmed = await confirmDeviceAction(context, 'reboot')
    if (!confirmed) return

    await rebootDeviceCommandRequest(getFirstDevice(context.devices).id)
    toast.success('Reboot command sent.')
    await this.refreshDevicesQuery()
  },

  async addToContract(context: DeviceActionContext) {
    const currentContractIds = Array.from(
      new Set(context.devices.map((device) => device.contract?.id).filter((id): id is string => Boolean(id))),
    )
    const currentContractId = currentContractIds.length === 1 ? currentContractIds[0] : undefined
    const selected = (await Modals.show(ModalId.SelectTableData, {
      title: 'Assign to contract',
      queryKey: [...contractsQueryKeys.all, 'select-for-device'],
      loadData: toSelectLoader<Contract>((state) => getContractsRequest(state, { status: ['ACTIVE'] })),
      columns: contractSelectColumns,
      searchPlaceholder: 'Search by ID, name...',
      searchColumns: ['id', 'name'],
      selectionMode: 'single',
      getRowCanSelect: (row) => getSelectRowId(row) !== currentContractId,
      tableKey: 'devices.assign-to-contract',
      loadingMessage: 'Loading contracts...',
      emptyMessage: 'No contracts found.',
      submitLabel: 'Assign',
    })) as SelectTableRow[] | undefined
    const contractId = getSelectedId(getSelectedRows(selected))
    if (!contractId) return
    if (currentContractId && contractId === currentContractId) return

    if (currentContractIds.length) {
      const confirmed = await Modals.confirm({
        title: 'Assign to contract',
        content:
          'This will move the selected device(s) to the new contract. If the customer changes, the active product and active store will be unassigned.',
      })
      if (!confirmed) return
    }

    await Promise.all(context.devices.map((device) => assignContractDeviceRequest(contractId, device.id)))
    toast.success(
      context.devices.length > 1
        ? `${context.devices.length} devices assigned to contract.`
        : 'Device assigned to contract.',
    )
    await Promise.all([
      this.refreshDevicesQuery(),
      queryClient.invalidateQueries({ queryKey: contractsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: productsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: storesQueryKeys.all }),
    ])
  },

  async addToGroup(context: DeviceActionContext) {
    const selected = (await Modals.show(ModalId.SelectTableData, {
      title: 'Add to group',
      queryKey: [...deviceGroupsQueryKeys.all, 'select-for-device'],
      loadData: toSelectLoader<DeviceGroup>(getDeviceGroupsRequest),
      columns: entitySelectColumns,
      searchPlaceholder: 'Search by name...',
      searchColumns: ['name'],
      selectionMode: 'multiple',
      tableKey: 'devices.add-to-group',
      loadingMessage: 'Loading device groups...',
      emptyMessage: 'No device groups found.',
      submitLabel: 'Add',
    })) as SelectTableRow[] | undefined
    const groupIds = getSelectedRows(selected)
      .map((group) => group.id)
      .filter((id): id is string => typeof id === 'string')
    if (!groupIds.length) return

    const deviceIds = context.devices.map((device) => device.id)
    await Promise.all(groupIds.map((groupId) => addDevicesToGroupRequest(groupId, deviceIds)))
    toast.success(
      deviceIds.length > 1
        ? `${deviceIds.length} devices added to ${groupIds.length} group(s).`
        : `Device added to ${groupIds.length} group(s).`,
    )
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: deviceGroupsQueryKeys.all }),
      this.refreshDevicesQuery(context.devices),
    ])
  },

  async removeFromGroup(context: DeviceActionContext) {
    const confirmed = await confirmDeviceAction(context, 'remove from group', true)
    if (!confirmed) return

    toast.info('Remove from group is not yet available.')
    await this.refreshDevicesQuery(context.devices)
  },

  async deleteDevices(context: DeviceActionContext) {
    const confirmed = await confirmDeviceAction(context, 'delete', true)
    if (!confirmed) return

    await deleteDevicesRequest(context.devices.map((device) => device.id))
    await this.refreshDevicesQuery(context.devices)
  },

  async archiveDevice(context: DeviceActionContext) {
    const device = getFirstDevice(context.devices)
    const shouldUnarchive = device.entityStatus === DeviceEntityStatus.Archived
    const confirmed = await confirmDeviceAction(context, shouldUnarchive ? 'unarchive' : 'archive')
    if (!confirmed) return

    const updatedDevice = shouldUnarchive
      ? await unarchiveDeviceRequest(device.id)
      : await archiveDeviceRequest(device.id)
    this.updateDevicesQuery([updatedDevice])
    queryClient.setQueryData(devicesQueryKeys.detail(device.id), updatedDevice)
    await this.refreshDevicesQuery([updatedDevice])
  },

  async setEnabled(context: DeviceActionContext, enabled: boolean) {
    const confirmed = await confirmDeviceAction(context, enabled ? 'enable' : 'disable')
    if (!confirmed) return

    const device = getFirstDevice(context.devices)
    const updatedDevice = await updateDeviceRequest(device.id, {
      status: enabled ? 'ACTIVE' : 'DECOMMISSIONED',
    })
    this.updateDevicesQuery([updatedDevice])
    queryClient.setQueryData(devicesQueryKeys.detail(device.id), updatedDevice)
    await this.refreshDevicesQuery([updatedDevice])
  },

  async openUploadMedia(context: DeviceActionContext) {
    const confirmed = await confirmDeviceAction(context, 'upload media for', true)
    if (!confirmed) return

    toast.info('Media upload to devices is not yet available.')
  },

  updateDevicesQuery(updatedDevices: Device[]) {
    if (!updatedDevices.length) return

    queryClient.setQueryData<Device[]>(devicesQueryKeys.all, (currentDevices = []) =>
      currentDevices.map((device) => updatedDevices.find((updatedDevice) => updatedDevice.id === device.id) ?? device),
    )
  },

  async refreshDevicesQuery(devices?: Array<Device | string>) {
    const deviceIds =
      devices
        ?.map((device) => (typeof device === 'string' ? device : device.id))
        .filter((id): id is string => Boolean(id)) ?? []

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: devicesQueryKeys.all }),
      ...deviceIds.map((deviceId) => queryClient.invalidateQueries({ queryKey: devicesQueryKeys.detail(deviceId) })),
    ])
  },

  getActions(device: Device, navigate?: NavigateFunction): DropdownActionItem[] {
    const context: DeviceActionContext = { devices: [device], navigate }

    return [
      { label: 'Edit', onClick: () => this.openEditInfos(context) },
      {
        label: device.entityStatus === DeviceEntityStatus.Archived ? 'Unarchive' : 'Archive',
        onClick: () => void this.archiveDevice(context),
      },
      { label: 'Destroy', variant: 'destructive', onClick: () => void this.deleteDevices(context) },
      {
        label: device.entityStatus === DeviceEntityStatus.Disabled ? 'Enable' : 'Disable',
        onClick: () => void this.setEnabled(context, device.entityStatus === DeviceEntityStatus.Disabled),
      },
    ]
  },

  getDetailActions(context: DeviceActionContext): DeviceDetailAction[] {
    const device = getFirstDevice(context.devices)
    const enableDisableAction: DeviceDetailAction | null = device
      ? {
          label: device.entityStatus === DeviceEntityStatus.Disabled ? 'Enable' : 'Disable',
          entity: 'device',
          onClick: () => void this.setEnabled(context, device.entityStatus === DeviceEntityStatus.Disabled),
        }
      : null
    const archiveAction: DeviceDetailAction = {
      label: device?.entityStatus === DeviceEntityStatus.Archived ? 'Unarchive' : 'Archive',
      entity: 'device',
      onClick: () => void this.archiveDevice(context),
    }
    const editAction: DeviceDetailAction = {
      label: 'Edit',
      entity: 'device',
      onClick: () => this.openEditInfos(context),
    }
    const destroyAction: DeviceDetailAction = {
      label: 'Destroy',
      entity: 'device',
      onClick: () => void this.deleteDevices(context),
      variant: 'destructive',
    }
    const portal = getPortalSafe()
    const relatedActions: DeviceDetailAction[] =
      portal === Portal.CUSTOMER
        ? [
            { label: 'Assign to store', entity: 'store', onClick: () => void this.assignToStore(context) },
            { label: 'Add to group', entity: 'deviceGroup', onClick: () => void this.addToGroup(context) },
            { label: 'Add product', entity: 'product', onClick: () => void this.addProduct(context) },
            { label: 'Add to campaign', entity: 'mediaCampaign', onClick: () => void this.addToCampaign(context) },
            { label: 'Create issue', entity: 'issue', onClick: () => this.createIssue() },
            { label: 'Reboot', entity: 'device', onClick: () => void this.rebootDevice(context) },
            { label: 'Print label', onClick: () => void this.printLabel(context) },
          ]
        : [
              {
                label: 'Assign to Contract (swap)',
                entity: 'contract',
                onClick: () => void this.addToContract(context),
              },
              { label: 'Assign to store', entity: 'store', onClick: () => void this.assignToStore(context) },
              { label: 'Update settings', entity: 'device', onClick: () => void this.openModifySettings(context) },
              { label: 'Add to group', entity: 'deviceGroup', onClick: () => void this.addToGroup(context) },
              { label: 'Add to Set', entity: 'deviceSet', onClick: () => void this.addToSet(context) },
              { label: 'Add product', entity: 'product', onClick: () => void this.addProduct(context) },
              { label: 'Add to campaign', entity: 'mediaCampaign', onClick: () => void this.addToCampaign(context) },
              { label: 'Create issue', entity: 'issue', onClick: () => this.createIssue() },
              { label: 'Reboot', entity: 'device', onClick: () => void this.rebootDevice(context) },
              { label: 'Update Firmware', entity: 'device', onClick: () => void this.updateFirmware(context) },
              { label: 'Print label', onClick: () => void this.printLabel(context) },
            ]

    const scopedRelatedActions = relatedActions.filter((action) => {
      if (!device || !action.entity) return true
      if (device.isSet && action.entity === 'product') return false
      if (device.parentId && (action.entity === 'contract' || action.entity === 'store')) return false
      return true
    })

    const deviceActions: DeviceDetailAction[] = [
      editAction,
      ...(portal === Portal.CUSTOMER
        ? []
        : [...(enableDisableAction ? [enableDisableAction] : []), archiveAction, destroyAction]),
    ]

    return [
      { type: 'label', label: 'Related' },
      ...scopedRelatedActions,
      ...(deviceActions.length
        ? [
            { type: 'separator', key: 'device-separator' } as const,
            { type: 'label', label: 'Device' } as const,
            ...deviceActions,
          ]
        : []),
    ]
  },

  getDetailHeaderActions(context: DeviceActionContext): Pick<{ options: DropdownActionItem[] }, 'options'> {
    return {
      options: this.getDetailActions(context).map(toDropdownAction),
    }
  },

  getModuleAction(
    device: Device,
    module: DeviceDetailModule,
    navigate?: NavigateFunction,
  ): DeviceModuleAction | undefined {
    if (module === 'devices' && device.isSet) {
      return {
        label: 'Add Devices',
        onClick: () => this.addDevicesToCurrentSet(device),
      }
    }

    const entity = moduleActionEntity[module]
    if (!entity) return undefined

    const action = this.getDetailActions({ devices: [device], navigate }).find((item) => item.entity === entity)
    return action && 'label' in action && action.type !== 'label'
      ? { label: action.label, onClick: 'onClick' in action ? action.onClick : undefined }
      : undefined
  },

  getDevicePageCommands(context: DeviceActionContext): DataTableCommand<Device>[] {
    const actions = this.getDetailActions(context).filter(
      (action): action is DeviceDetailAction & { label: string; onClick?: () => void } =>
        !('type' in action) || action.type === 'action',
    )

    return actions.map((action) => ({
      label: action.label,
      onClick: () => action.onClick?.(),
      disabled: 'disabled' in action ? action.disabled : undefined,
      variant: 'variant' in action ? action.variant : undefined,
    }))
  },

  getTableActions(context: DeviceActionContext): DataTableCommand<Device>[] {
    const checkAtLeastOneDevice = context.devices.length == 0

    const actions: DeviceListTableAction[] = [
      { label: 'Print label', action: this.printLabel, disabled: checkAtLeastOneDevice },
      { label: 'Update firmware', action: this.updateFirmware, disabled: checkAtLeastOneDevice },
      { label: 'Reboot device', action: this.rebootDevice, disabled: checkAtLeastOneDevice },
      { label: 'Add to contract', action: this.addToContract, disabled: checkAtLeastOneDevice },
      { label: 'Add to group', action: this.addToGroup, disabled: checkAtLeastOneDevice },
      { label: 'Remove from group', action: this.removeFromGroup, disabled: checkAtLeastOneDevice },
      { label: 'Upload media', action: this.openUploadMedia, disabled: checkAtLeastOneDevice },
      { label: 'Delete', action: this.deleteDevices, disabled: checkAtLeastOneDevice },
    ]

    return actions.map((action) => ({
      label: action.label,
      onClick: () => action.action.call(this, context),
      disabled: action.disabled,
      variant: action.label.startsWith('Delete') ? 'destructive' : undefined,
    }))
  },
}
