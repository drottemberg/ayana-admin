import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { getStoreGroupsRequest } from '@/features/groups/api'
import { StoreGroupService } from '@/features/groups/store-group-service'
import { storeGroupColumns } from '@/features/groups/store-group-columns'
import { storeGroupsQueryKeys } from '@/features/groups/query-keys'
import type { StoreGroup } from '@/types/group'

export default function StoreGroupsPage() {
  const queryClient = useQueryClient()
  const headerActions = StoreGroupService.getListHeaderActions()

  const loadData = useCallback((state: DataTableState<StoreGroup>) => getStoreGroupsRequest(state), [])

  return (
    <>
      <PageHeader title="Store Groups" primaryAction={headerActions.primaryAction} />
      <section className="p-4 md:p-6">
        <DataTableAsync
          queryKey={[...storeGroupsQueryKeys.all, 'table']}
          loadData={loadData}
          tableKey="store-groups.root"
          columns={storeGroupColumns}
          searchPlaceholder="Search by name"
          searchColumns={['name']}
          getRowCommands={(group) => StoreGroupService.getRowActions(group, queryClient)}
          loadingMessage="Loading store groups..."
          emptyMessage="No store groups found."
          emptyAction={StoreGroupService.getListEmptyAction()}
          errorMessage="Failed to load store groups."
        />
      </section>
    </>
  )
}
