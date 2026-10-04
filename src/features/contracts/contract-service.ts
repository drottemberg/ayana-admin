import type { DataTableCommand } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import type { PageHeaderProps } from '@/components/ui/page-header'
import type { ColumnDef } from '@tanstack/react-table'
import { createElement } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { toast } from 'sonner'

import {
  assignContractDeviceRequest,
  archiveContractRequest,
  deleteContractsRequest,
  setContractStatusRequest,
  swapContractDeviceRequest,
  unarchiveContractRequest,
} from '@/features/contracts/api'
import { contractsQueryKeys } from '@/features/contracts/query-keys'
import { getDevicesRequest } from '@/features/devices/api'
import { DeviceService } from '@/features/devices/device-service'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { queryClient } from '@/lib/query-client'
import { Drawer, DrawerId } from '@/providers/drawer'
import { ModalId, Modals } from '@/providers/modal'
import type { SelectTableRow } from '@/providers/modal-types'
import {
  ContractSlaType,
  ContractSlaTypeLabel,
  ContractStatus,
  ContractStatusLabel,
  ContractStatusValues,
  ContractType,
  ContractTypeLabel,
} from '@/types/contract'
import type {
  Contract,
  ContractSlaType as ContractSlaTypeValue,
  ContractStatus as ContractStatusValue,
  ContractType as ContractTypeValue,
} from '@/types/contract'
import type { Device } from '@/types/device'

export type ContractDetailModule = 'devices'

type ContractDetailActionEntity = 'device' | 'contract'

type ContractDetailAction = DropdownActionItem & {
  entity?: ContractDetailActionEntity
}

type ContractModuleAction = {
  label: string
  onClick?: () => void
}

const moduleActionEntity: Record<ContractDetailModule, ContractDetailActionEntity> = {
  devices: 'device',
}

const entitySelectColumns: ColumnDef<SelectTableRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'serialNumber', header: 'Serial number' },
  { accessorKey: 'id', header: 'ID' },
]

function toDropdownAction({ entity, ...action }: ContractDetailAction): DropdownActionItem {
  void entity
  return action
}

function getSelectedRows(selected: unknown): SelectTableRow[] {
  return Array.isArray(selected) ? selected : []
}

export const ContractService = {
  statusKeys(): ContractStatusValue[] {
    return [ContractStatus.Active, ContractStatus.Suspended, ContractStatus.Completed, ContractStatus.Cancelled]
  },

  statusFilterKeys(): ContractStatusValue[] {
    return [...ContractStatusValues]
  },

  getStatus(contract: Contract): ContractStatusValue {
    if (contract.isDeleted) return ContractStatus.Deleted
    if (contract.isArchived) return ContractStatus.Archived
    return contract.status
  },

  statusToString(status: ContractStatusValue): string {
    return ContractStatusLabel[status] ?? status
  },

  slaTypeKeys(): ContractSlaTypeValue[] {
    return Object.values(ContractSlaType)
  },

  slaTypeToString(slaType: ContractSlaTypeValue): string {
    return ContractSlaTypeLabel[slaType] ?? slaType
  },

  typeKeys(): ContractTypeValue[] {
    return Object.values(ContractType)
  },

  typeToString(type: ContractTypeValue): string {
    return ContractTypeLabel[type] ?? type
  },

  getDeviceNames(contract: Contract): string[] {
    return contract.devices?.map((device) => device.name) ?? []
  },

  async refreshContracts() {
    await queryClient.invalidateQueries({ queryKey: contractsQueryKeys.all })
  },

  async refreshContractDetail(contractId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: contractsQueryKeys.detail(contractId) }),
      queryClient.invalidateQueries({ queryKey: [...devicesQueryKeys.all, 'contract-module', contractId] }),
      this.refreshContracts(),
    ])
  },

  async deleteContracts(contracts: Contract[]) {
    if (!contracts.length) return false

    const confirmed = await Modals.confirm({
      operation: `delete ${contracts.length} contract(s)`,
      okButtonProps: { variant: 'destructive' },
    })
    if (!confirmed) return false

    await deleteContractsRequest(contracts.map((contract) => contract.id))
    await this.refreshContracts()
    return true
  },

  async setArchived(contract: Contract, isArchived: boolean) {
    if (isArchived) {
      await archiveContractRequest(contract.id)
    } else {
      await unarchiveContractRequest(contract.id)
    }
    await this.refreshContracts()
  },

  async setEnabled(contract: Contract, enabled: boolean) {
    await setContractStatusRequest(contract.id, enabled ? ContractStatus.Active : ContractStatus.Suspended)
    await this.refreshContracts()
  },

  async assignDevice(contract: Contract) {
    const selected = await Modals.show(ModalId.SelectTableData, {
      title: 'Assign device',
      queryKey: [...devicesQueryKeys.all, 'select-for-contract', contract.id],
      loadData: (state) => getDevicesRequest(state, { customerId: contract.customer.id }),
      columns: entitySelectColumns,
      searchPlaceholder: 'Search by ID, name, serial...',
      searchColumns: ['id', 'name', 'serialNumber'],
      selectionMode: 'single',
      tableKey: 'contracts.assign-device',
      loadingMessage: 'Loading devices...',
      emptyMessage: 'No devices found.',
      submitLabel: 'Assign',
    })
    const deviceId = getSelectedRows(selected).find((device) => typeof device.id === 'string')?.id
    if (typeof deviceId !== 'string') return

    await assignContractDeviceRequest(contract.id, deviceId)
    await this.refreshContractDetail(contract.id)
    toast.success('Device assigned to contract.')
  },

  async swapDevice(contract: Contract, currentDevice: Device) {
    const selected = await Modals.show(ModalId.SelectTableData, {
      title: 'Swap device',
      queryKey: [...devicesQueryKeys.all, 'select-for-contract-swap', contract.id, currentDevice.id],
      loadData: (state) => getDevicesRequest(state, { customerId: contract.customer.id }),
      columns: entitySelectColumns,
      searchPlaceholder: 'Search by ID, name, serial...',
      searchColumns: ['id', 'name', 'serialNumber'],
      selectionMode: 'single',
      tableKey: 'contracts.swap-device',
      loadingMessage: 'Loading devices...',
      emptyMessage: 'No devices found.',
      submitLabel: 'Swap',
    })
    const newDeviceId = getSelectedRows(selected).find((device) => typeof device.id === 'string')?.id
    if (typeof newDeviceId !== 'string' || newDeviceId === currentDevice.id) return

    await swapContractDeviceRequest(contract.id, currentDevice.id, newDeviceId)
    await this.refreshContractDetail(contract.id)
    toast.success('Device swapped on contract.')
  },

  getActions(contract: Contract): DropdownActionItem[] {
    if (contract.isDeleted) return []

    return [
      {
        label: 'Edit',
        onClick: () => Drawer.show(DrawerId.CreateContract, { contract }),
      },
      {
        label: contract.isArchived ? 'Unarchive' : 'Archive',
        onClick: () => void this.setArchived(contract, !contract.isArchived),
      },
      {
        label: 'Destroy',
        variant: 'destructive',
        onClick: () => void this.deleteContracts([contract]),
      },
      {
        label: contract.status === ContractStatus.Suspended ? 'Enable' : 'Disable',
        onClick: () => void this.setEnabled(contract, contract.status === ContractStatus.Suspended),
      },
    ]
  },

  getDetailActions(contract: Contract, navigate?: NavigateFunction): ContractDetailAction[] {
    const isSuspended = contract.status === ContractStatus.Suspended

    return [
      { type: 'label', label: 'Related' },
      { entity: 'device', label: 'Assign or swap device', onClick: () => void this.assignDevice(contract) },
      { type: 'separator', key: 'contract-separator' },
      { type: 'label', label: 'Contract' },
      {
        entity: 'contract',
        label: 'Edit',
        onClick: () => Drawer.show(DrawerId.CreateContract, { contract }),
      },
      {
        entity: 'contract',
        label: isSuspended ? 'Enable' : 'Disable',
        onClick: () => void this.setEnabled(contract, isSuspended),
      },
      {
        entity: 'contract',
        label: contract.isArchived ? 'Unarchive' : 'Archive',
        onClick: () => void this.setArchived(contract, !contract.isArchived),
      },
      {
        entity: 'contract',
        label: 'Destroy',
        variant: 'destructive',
        onClick: () => {
          void this.deleteContracts([contract]).then((deleted) => {
            if (deleted) navigate?.('/contracts')
          })
        },
      },
    ]
  },

  getDetailHeaderActions(
    contract: Contract,
    navigate?: NavigateFunction,
  ): Pick<PageHeaderProps, 'primaryAction' | 'secondaryAction' | 'options'> {
    return {
      options: this.getDetailActions(contract, navigate).map(toDropdownAction),
    }
  },

  getModuleAction(
    contract: Contract,
    module: ContractDetailModule,
    navigate?: NavigateFunction,
  ): ContractModuleAction | undefined {
    const actionEntity = moduleActionEntity[module]
    const action = this.getDetailActions(contract, navigate).find((item) => item.entity === actionEntity)

    return action && 'label' in action && action.type !== 'label'
      ? { label: action.label, onClick: 'onClick' in action ? action.onClick : undefined }
      : undefined
  },

  getDeviceRowActions(device: Device, contract: Contract, navigate?: NavigateFunction): DropdownActionItem[] {
    return [
      {
        label: 'Swap device',
        onClick: () => void this.swapDevice(contract, device),
      },
      { type: 'separator', key: 'contract-device-separator' },
      ...DeviceService.getActions(device, navigate),
    ]
  },

  getDeviceCommands(devices: Device[], contract: Contract): DataTableCommand<Device>[] {
    const noSelection = devices.length === 0

    return [
      {
        label: 'Edit dates',
        disabled: noSelection,
        onClick: () => toast.info('Edit contract-device dates: coming soon.'),
      },
      {
        label: 'Mark as sold',
        disabled: noSelection,
        onClick: () => toast.info('Mark as sold: coming soon.'),
      },
      {
        label: 'Change SLA',
        disabled: noSelection,
        onClick: () => toast.info('Change SLA: coming soon.'),
      },
      {
        label: 'Remove from contract',
        disabled: noSelection,
        onClick: async (selectedDevices: Device[]) => {
          const count = selectedDevices.length
          const plural = count === 1 ? 'device' : 'devices'
          const confirmed = await Modals.confirm({
            title: 'Confirmation',
            content: createElement(
              'div',
              { className: 'grid gap-4' },
              createElement(
                'p',
                null,
                'You are about to remove ',
                createElement('strong', null, `${count} ${plural} from ${contract.name}`),
                ', would you like to continue?',
              ),
              createElement('p', null, "The contract users won't have access to their data anymore."),
            ),
            okText: 'Confirm',
            cancelText: 'Cancel',
          })

          if (!confirmed) return

          toast.info('Remove from contract: coming soon.')
        },
      },
    ]
  },

  getTableActions(contracts: Contract[]): DataTableCommand<Contract>[] {
    const noSelection = contracts.length === 0

    return [
      {
        label: 'Destroy',
        disabled: noSelection,
        variant: 'destructive',
        onClick: (selectedContracts) => void this.deleteContracts(selectedContracts),
      },
    ]
  },
}
