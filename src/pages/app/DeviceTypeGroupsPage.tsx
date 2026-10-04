import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import {
  DeviceTypeGroupStatusValues,
  getDeviceTypeGroupsTableRequest,
  type DeviceTypeGroup,
} from '@/features/device-types/api'
import { deviceTypeGroupColumns } from '@/features/device-types/device-type-group-columns'
import { DeviceTypeGroupService } from '@/features/device-types/device-type-group-service'
import { deviceTypeConfigsQueryKeys } from '@/features/device-types/query-keys'

export default function DeviceTypeGroupsPage() {
  const queryClient = useQueryClient()
  const headerActions = DeviceTypeGroupService.getListHeaderActions()

  const loadData = useCallback((state: DataTableState<DeviceTypeGroup>) => getDeviceTypeGroupsTableRequest(state), [])

  return (
    <>
      <PageHeader
        title="Device Type Groups"
        subtitle="Namespaces for hardware device types and inherited defaults."
        primaryAction={headerActions.primaryAction}
        secondaryAction={headerActions.secondaryAction}
        options={headerActions.options}
      />
      <section className="p-4 md:p-6">
        <DataTableAsync
          queryKey={[...deviceTypeConfigsQueryKeys.groups, 'table']}
          loadData={loadData}
          tableKey="device-type-groups.root"
          columns={deviceTypeGroupColumns}
          searchPlaceholder="Search by name"
          searchColumns={['name']}
          filters={[
            {
              id: 'status',
              label: 'Status',
              column: 'status',
              options: [...DeviceTypeGroupStatusValues],
              getValue: (group) => DeviceTypeGroupService.getStatus(group),
            },
          ]}
          getRowCommands={(group) => DeviceTypeGroupService.getRowActions(group, queryClient)}
          loadingMessage="Loading device type groups..."
          emptyMessage="No device type groups found."
          emptyAction={DeviceTypeGroupService.getListEmptyAction()}
          errorMessage="Failed to load device type groups."
        />
      </section>
    </>
  )
}
