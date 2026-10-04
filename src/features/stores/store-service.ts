import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'

import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import type { PageHeaderProps } from '@/components/ui/page-header'
import {
  addStoresToGroupRequest,
  getStoreGroupsRequest,
} from '@/features/groups/api'
import { storeGroupsQueryKeys } from '@/features/groups/query-keys'
import { OrganizationService } from '@/features/organizations/organization-service'
import { queryClient } from '@/lib/query-client'
import { Drawer, DrawerId } from '@/providers/drawer'
import { ModalId, Modals } from '@/providers/modal'
import type { SelectTableRow } from '@/providers/modal-types'
import type { StoreGroup } from '@/types/group'
import type { Store } from '@/types/store'

export type StoreDetailModule = 'users' | 'devices' | 'storeGroups' | 'partners' | 'issues'
type StoreDetailActionEntity = 'user' | 'device' | 'partner' | 'issue' | 'group'
type StoreDetailAction = DropdownActionItem & {
  entity?: StoreDetailActionEntity
}
type StoreModuleAction = {
  label: string
  onClick?: () => void
}

const moduleActionEntity: Record<StoreDetailModule, StoreDetailActionEntity> = {
  users: 'user',
  devices: 'device',
  storeGroups: 'group',
  partners: 'partner',
  issues: 'issue',
}

const entitySelectColumns: ColumnDef<SelectTableRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'id', header: 'ID' },
]

const toSelectLoader =
  <T extends SelectTableRow>(loader: (state: DataTableState<T>) => Promise<DataTableAsyncResult<T>>) =>
  (state: DataTableState<SelectTableRow>) =>
    loader(state as DataTableState<T>) as Promise<DataTableAsyncResult<SelectTableRow>>

const getSelectedRows = (selected: unknown): SelectTableRow[] => (Array.isArray(selected) ? selected : [])

function showUnavailable(label: string) {
  toast.info(`${label} is not yet available.`)
}

function toStoreSpecLabel(item: DropdownActionItem): DropdownActionItem {
  return 'label' in item && item.label === 'Delete' ? { ...item, label: 'Destroy' } : item
}

function toDropdownAction({ entity, ...action }: StoreDetailAction): DropdownActionItem {
  void entity
  return action
}

export const StoreService = {
  canManageDetails() {
    return true
  },

  getDetailModules(): Array<{ key: StoreDetailModule; label: string }> {
    return [
      { key: 'users', label: 'Active users' },
      { key: 'devices', label: 'Active devices' },
      { key: 'storeGroups', label: 'Store groups' },
      { key: 'partners', label: 'Maintenance partners' },
      { key: 'issues', label: 'Last issues' },
    ]
  },

  getRowActions(store: Store): DropdownActionItem[] {
    if (!this.canManageDetails()) return []

    return OrganizationService.getActions({
      kind: 'store',
      organization: store,
    }).map(toStoreSpecLabel)
  },

  async addToGroup(store: Store) {
    const selected = (await Modals.show(ModalId.SelectTableData, {
      title: 'Add to group',
      queryKey: [...storeGroupsQueryKeys.all, 'select-for-store'],
      loadData: toSelectLoader<StoreGroup>(getStoreGroupsRequest),
      columns: entitySelectColumns,
      searchPlaceholder: 'Search by name...',
      searchColumns: ['name'],
      selectionMode: 'multiple',
      tableKey: 'stores.add-to-group',
      loadingMessage: 'Loading store groups...',
      emptyMessage: 'No store groups found.',
      submitLabel: 'Add',
    })) as SelectTableRow[] | undefined
    const groupIds = getSelectedRows(selected)
      .map((group) => group.id)
      .filter((id): id is string => typeof id === 'string')
    if (!groupIds.length) return

    await Promise.all(groupIds.map((groupId) => addStoresToGroupRequest(groupId, [store.id])))
    toast.success(`Store added to ${groupIds.length} group(s).`)
    await queryClient.invalidateQueries({ queryKey: storeGroupsQueryKeys.all })
  },

  getDetailActions(store: Store): StoreDetailAction[] {
    const relatedActions: StoreDetailAction[] = [
      {
        entity: 'device',
        label: 'Assign device',
        onClick: () => Drawer.show(DrawerId.CreateDevice, {}),
      },
      { entity: 'issue', label: 'Create issue', onClick: () => showUnavailable('Create issue') },
      { entity: 'group', label: 'Add to group', onClick: () => void this.addToGroup(store) },
    ]

    if (this.canManageDetails()) {
      relatedActions.unshift(
        {
          entity: 'user',
          label: 'Add user',
          onClick: () => Drawer.show(DrawerId.CreateUser, { customerId: store.id }),
        },
        { entity: 'partner', label: 'Assign partner', onClick: () => showUnavailable('Assign partner') },
      )
    }

    return [
      { type: 'label', label: 'Related' },
      ...relatedActions,
      ...(this.canManageDetails()
        ? [
            { type: 'separator', key: 'store-separator' } as const,
            { type: 'label', label: 'Store' } as const,
            ...this.getRowActions(store),
          ]
        : []),
    ]
  },

  getDetailHeaderActions(store: Store): Pick<PageHeaderProps, 'options'> {
    return {
      options: this.getDetailActions(store).map(toDropdownAction),
    }
  },

  getModuleAction(store: Store, module: StoreDetailModule): StoreModuleAction | undefined {
    const actionEntity = moduleActionEntity[module]
    const action = this.getDetailActions(store).find((item) => item.entity === actionEntity)

    return action && 'label' in action && action.type !== 'label'
      ? { label: action.label, onClick: 'onClick' in action ? action.onClick : undefined }
      : undefined
  },
}
