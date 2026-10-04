import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'

import type { DataTableAsyncResult, DataTableCommand, DataTableState } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import type { PageHeaderProps } from '@/components/ui/page-header'
import { addStoresToGroupRequest, deleteStoreGroupRequest, removeStoreFromGroupRequest } from '@/features/groups/api'
import { storeGroupsQueryKeys } from '@/features/groups/query-keys'
import { getStoresRequest } from '@/features/stores/api'
import { storesQueryKeys } from '@/features/stores/query-keys'
import { Drawer, DrawerId } from '@/providers/drawer'
import { ModalId, Modals } from '@/providers/modal'
import type { SelectTableRow } from '@/providers/modal-types'
import type { StoreGroup } from '@/types/group'
import type { Store } from '@/types/store'

const storeSelectColumns: ColumnDef<SelectTableRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'customer', header: 'Customer', cell: ({ row }) => (row.original.customer as { name?: string })?.name ?? '' },
  { accessorKey: 'id', header: 'ID' },
]

const toSelectLoader =
  <T extends SelectTableRow>(loader: (state: DataTableState<T>) => Promise<DataTableAsyncResult<T>>) =>
  (state: DataTableState<SelectTableRow>) =>
    loader(state as DataTableState<T>) as Promise<DataTableAsyncResult<SelectTableRow>>

async function deleteGroup(group: StoreGroup, queryClient: QueryClient) {
  const confirmed = await Modals.confirm({
    title: 'Delete Store Group',
    content: `Delete "${group.name}"? This cannot be undone.`,
    okText: 'Delete',
    okButtonProps: { variant: 'destructive' },
  })

  if (!confirmed) return false

  await deleteStoreGroupRequest(group.id)
  await queryClient.invalidateQueries({ queryKey: storeGroupsQueryKeys.all })
  toast.success('Store Group deleted.')

  return true
}

async function removeStoresFromGroup(groupId: string, stores: Store[], queryClient: QueryClient) {
  if (!stores.length) return

  const confirmed = await Modals.confirm({
    title: 'Remove from group',
    content:
      stores.length === 1
        ? `Remove "${stores[0].name || stores[0].id}" from this group?`
        : `Remove ${stores.length} stores from this group?`,
    okText: 'Remove',
    okButtonProps: { variant: 'destructive' },
  })

  if (!confirmed) return

  await Promise.all(stores.map((store) => removeStoreFromGroupRequest(groupId, store.id)))
  await queryClient.invalidateQueries({ queryKey: storeGroupsQueryKeys.stores(groupId) })
  await queryClient.invalidateQueries({ queryKey: storeGroupsQueryKeys.detail(groupId) })
  toast.success(stores.length === 1 ? 'Store removed from group.' : 'Stores removed from group.')
}

export const StoreGroupService = {
  showCreateDrawer() {
    Drawer.show(DrawerId.StoreGroup, {})
  },

  showRenameDrawer(group: StoreGroup) {
    Drawer.show(DrawerId.StoreGroup, { group })
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

  getRowActions(group: StoreGroup, queryClient: QueryClient): DropdownActionItem[] {
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
    group: StoreGroup,
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

  getMemberRowActions(groupId: string, queryClient: QueryClient): (store: Store) => DropdownActionItem[] {
    return (store) => [
      {
        label: 'Remove store from group',
        variant: 'destructive',
        onClick: () => void removeStoresFromGroup(groupId, [store], queryClient),
      },
    ]
  },

  getMemberTableActions(groupId: string, queryClient: QueryClient): (stores: Store[]) => DataTableCommand<Store>[] {
    return (stores) => [
      {
        label: 'Remove from group',
        variant: 'destructive',
        disabled: stores.length === 0,
        onClick: () => void removeStoresFromGroup(groupId, stores, queryClient),
      },
    ]
  },

  async showAddStoresModal(groupId: string, existingStores: Store[], queryClient: QueryClient) {
    const existingStoreIds = new Set(existingStores.map((store) => store.id))

    await Modals.show(ModalId.SelectTableData, {
      title: 'Add stores to group',
      queryKey: [...storesQueryKeys.all, 'select-for-store-group', groupId],
      loadData: toSelectLoader<Store>(async (state) => {
        const result = await getStoresRequest(state)
        return {
          ...result,
          items: result.items.filter((store) => !existingStoreIds.has(store.id)),
        }
      }),
      columns: storeSelectColumns,
      searchPlaceholder: 'Search by ID, name...',
      searchColumns: ['id', 'name'],
      selectionMode: 'multiple',
      tableKey: `store-groups.${groupId}.add-stores`,
      loadingMessage: 'Loading stores...',
      emptyMessage: 'No stores found.',
      submitLabel: 'Add',
      onSelect: async (selectedStores: SelectTableRow[]) => {
        const storeIds = selectedStores
          .map((store) => store.id)
          .filter((id): id is string => typeof id === 'string')
        if (!storeIds.length) return

        await addStoresToGroupRequest(groupId, storeIds)
        await queryClient.invalidateQueries({ queryKey: storeGroupsQueryKeys.stores(groupId) })
        await queryClient.invalidateQueries({ queryKey: storeGroupsQueryKeys.detail(groupId) })
        toast.success(storeIds.length === 1 ? 'Store added to group.' : 'Stores added to group.')
      },
    })
  },
}
