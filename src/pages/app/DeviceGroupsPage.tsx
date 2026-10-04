import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { getDeviceGroupsRequest } from '@/features/groups/api'
import { deviceGroupColumns } from '@/features/groups/device-group-columns'
import { DeviceGroupService } from '@/features/groups/device-group-service'
import { deviceGroupsQueryKeys } from '@/features/groups/query-keys'
import type { DeviceGroup } from '@/types/group'

export default function DeviceGroupsPage() {
  const queryClient = useQueryClient()
  const headerActions = DeviceGroupService.getListHeaderActions()

  const loadData = useCallback((state: DataTableState<DeviceGroup>) => getDeviceGroupsRequest(state), [])

  return (
    <>
      <PageHeader title="Device Groups" primaryAction={headerActions.primaryAction} />
      <section className="p-4 md:p-6">
        <DataTableAsync
          queryKey={[...deviceGroupsQueryKeys.all, 'table']}
          loadData={loadData}
          tableKey="device-groups.root"
          columns={deviceGroupColumns}
          searchPlaceholder="Search by name"
          searchColumns={['name']}
          getRowCommands={(group) => DeviceGroupService.getRowActions(group, queryClient)}
          loadingMessage="Loading device groups..."
          emptyMessage="No device groups found."
          emptyAction={DeviceGroupService.getListEmptyAction()}
          errorMessage="Failed to load device groups."
        />
      </section>
    </>
  )
}
