import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'

import type { DataTableAsyncResult, DataTableCommand, DataTableState } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import type { PageHeaderProps } from '@/components/ui/page-header'
import { getDevicesRequest } from '@/features/devices/api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { OrganizationService } from '@/features/organizations/organization-service'
import type { EntityPermissions } from '@/lib/entities/app-connect.entity'
import { Drawer, DrawerId } from '@/providers/drawer'
import { ModalId, Modals } from '@/providers/modal'
import type { SelectTableRow } from '@/providers/modal-types'
import type { Customer } from '@/types/customer'
import type { Device } from '@/types/device'

function toCustomerSpecLabel(item: DropdownActionItem): DropdownActionItem {
  return 'label' in item && item.label === 'Delete' ? { ...item, label: 'Destroy' } : item
}

function showUnavailable(label: string) {
  toast.info(`${label} is not yet available.`)
}

export type CustomerDetailModule =
  | 'locations'
  | 'users'
  | 'contracts'
  | 'products'
  | 'devices'
  | 'media'
  | 'mediaCampaigns'
  | 'issues'

type CustomerDetailActionEntity =
  | 'user'
  | 'contract'
  | 'product'
  | 'device'
  | 'media'
  | 'mediaCampaign'
  | 'issue'

type CustomerDetailAction = DropdownActionItem & {
  entity?: CustomerDetailActionEntity
}

type CustomerModuleAction = {
  label: string
  onClick?: () => void
}

function toDropdownAction({ entity, ...action }: CustomerDetailAction): DropdownActionItem {
  void entity
  return action
}

const entitySelectColumns: ColumnDef<SelectTableRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'serialNumber', header: 'Serial number' },
  { accessorKey: 'id', header: 'ID' },
]

const toSelectLoader =
  <T extends SelectTableRow>(loader: (state: DataTableState<T>) => Promise<DataTableAsyncResult<T>>) =>
  (state: DataTableState<SelectTableRow>) =>
    loader(state as DataTableState<T>) as Promise<DataTableAsyncResult<SelectTableRow>>

const moduleActionEntity: Partial<Record<CustomerDetailModule, CustomerDetailActionEntity>> = {
  users: 'user',
  contracts: 'contract',
  products: 'product',
  devices: 'device',
  media: 'media',
  mediaCampaigns: 'mediaCampaign',
  issues: 'issue',
}

export const CustomerService = {
  showCreateDrawer() {
    Drawer.show(DrawerId.CreateCustomer, {})
  },

  showEditDrawer(customer: Customer) {
    Drawer.show(DrawerId.CreateCustomer, { customer })
  },

  canManage(permissions?: EntityPermissions) {
    return !permissions || permissions.create || permissions.edit || permissions.delete || permissions.archive
  },

  async assignDevice(customer: Customer) {
    await Modals.show(ModalId.SelectTableData, {
      title: 'Assign device',
      queryKey: [...devicesQueryKeys.all, 'select-for-customer', customer.id],
      loadData: toSelectLoader<Device>(getDevicesRequest),
      columns: entitySelectColumns,
      searchPlaceholder: 'Search by ID, name, serial...',
      searchColumns: ['id', 'name', 'serialNumber'],
      selectionMode: 'single',
      tableKey: 'customers.assign-device',
      loadingMessage: 'Loading devices...',
      emptyMessage: 'No devices found.',
      submitLabel: 'Assign',
      onSelect: () => showUnavailable('Assign device'),
    })
  },

  getDetailActions(customer: Customer, permissions?: EntityPermissions): CustomerDetailAction[] {
    if (!this.canManage(permissions)) {
      return [
        { type: 'label', label: 'Related' },
        {
          entity: 'device',
          label: 'Assign device',
          onClick: () => void this.assignDevice(customer),
        },
        { entity: 'issue', label: 'Create issue', onClick: () => showUnavailable('Create issue') },
        { label: 'Swap', onClick: () => showUnavailable('Swap') },
      ]
    }

    return [
      { type: 'label', label: 'Related' },
      {
        entity: 'user',
        label: 'Add user',
        onClick: () => Drawer.show(DrawerId.CreateUser, { customerId: customer.id }),
      },
      {
        entity: 'contract',
        label: 'Add contract',
        onClick: () => Drawer.show(DrawerId.CreateContract, { customerId: customer.id }),
      },
      {
        entity: 'product',
        label: 'Add product',
        onClick: () => Drawer.show(DrawerId.CreateProduct, { customerId: customer.id }),
      },
      {
        entity: 'device',
        label: 'Assign device',
        onClick: () => void this.assignDevice(customer),
      },
      {
        entity: 'media',
        label: 'Upload media',
        onClick: () => Drawer.show(DrawerId.CreateMedia, { customerId: customer.id }),
      },
      { entity: 'mediaCampaign', label: 'Create campaign', onClick: () => showUnavailable('Create campaign') },
      { entity: 'issue', label: 'Create issue', onClick: () => showUnavailable('Create issue') },
      { type: 'separator', key: 'account-separator' },
      { type: 'label', label: 'Account' },
      ...this.getRowActions(customer, permissions),
    ]
  },

  getListHeaderActions(
    permissions?: EntityPermissions,
  ): Pick<PageHeaderProps, 'primaryAction' | 'secondaryAction' | 'options'> {
    return {
      primaryAction:
        !permissions || permissions.create
          ? { children: 'Add Customer', onClick: () => this.showCreateDrawer() }
          : undefined,
    }
  },

  getListEmptyAction(permissions?: EntityPermissions) {
    return !permissions || permissions.create
      ? { name: 'Add Customer', onClick: () => this.showCreateDrawer() }
      : undefined
  },

  getDetailHeaderActions(
    customer: Customer,
    permissions?: EntityPermissions,
  ): Pick<PageHeaderProps, 'primaryAction' | 'secondaryAction' | 'options'> {
    return {
      options: this.getDetailActions(customer, permissions).map(toDropdownAction),
    }
  },

  getModuleAction(
    customer: Customer,
    module: CustomerDetailModule,
    permissions?: EntityPermissions,
  ): CustomerModuleAction | undefined {
    const actionEntity = moduleActionEntity[module]
    if (!actionEntity) return undefined
    const action = this.getDetailActions(customer, permissions).find((item) => item.entity === actionEntity)
    return action && 'label' in action && action.type !== 'label'
      ? { label: action.label, onClick: 'onClick' in action ? action.onClick : undefined }
      : undefined
  },

  getRowActions(customer: Customer, permissions?: EntityPermissions): DropdownActionItem[] {
    return OrganizationService.getActions({ kind: 'customer', organization: customer, permissions }).map(
      toCustomerSpecLabel,
    )
  },

  getTableActions(customers: Customer[], permissions?: EntityPermissions): DataTableCommand<Customer>[] {
    return OrganizationService.getTableActions({ kind: 'customer', organizations: customers, permissions }).map(
      (item) => (item.label === 'Delete' ? { ...item, label: 'Destroy' } : item),
    )
  },
}
