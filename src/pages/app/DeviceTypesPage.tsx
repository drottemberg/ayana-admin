import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import {
  DeviceTypeStatusValues,
  getDeviceTypeCode,
  getDeviceTypeGroupFilterOptions,
  getDeviceTypeConfigsRequest,
  getDeviceTypeGroupsRequest,
  getDeviceTypesTableRequest,
  type DeviceTypeConfig,
} from '@/features/device-types/api'
import { deviceTypeColumns } from '@/features/device-types/device-type-columns'
import { DeviceTypeService } from '@/features/device-types/device-type-service'
import { deviceTypeConfigsQueryKeys } from '@/features/device-types/query-keys'

export default function DeviceTypesPage() {
  const queryClient = useQueryClient()
  const { data: configs = [] } = useQuery({
    queryKey: deviceTypeConfigsQueryKeys.all,
    queryFn: getDeviceTypeConfigsRequest,
  })
  const { data: groups = [] } = useQuery({
    queryKey: deviceTypeConfigsQueryKeys.groups,
    queryFn: getDeviceTypeGroupsRequest,
  })
  const existingTypes = configs.map(getDeviceTypeCode)
  const loadData = useCallback((state: DataTableState<DeviceTypeConfig>) => getDeviceTypesTableRequest(state), [])

  return (
    <>
      <PageHeader
        title="Device Types"
        subtitle="Configure MQTT variable mappings per device type."
        backTo="/device-type-groups"
      />
      <section className="space-y-5 p-4 md:p-6">
        <DataTableAsync
          queryKey={[...deviceTypeConfigsQueryKeys.all, 'table']}
          loadData={loadData}
          tableKey="device-types.root.v2"
          columns={deviceTypeColumns}
          searchPlaceholder="Search by name"
          searchColumns={['name']}
          filters={[
            {
              id: 'status',
              label: 'Status',
              column: 'status',
              options: [...DeviceTypeStatusValues],
              getValue: (type) => DeviceTypeService.getStatus(type),
            },
            {
              id: 'groupId',
              label: 'Group',
              column: 'groupId',
              getValue: (type) => type.group?.name ?? type.groupId,
              queryFn: getDeviceTypeGroupFilterOptions,
            },
          ]}
          getRowCommands={(config) => DeviceTypeService.getRowActions(config, { groups, existingTypes, queryClient })}
          loadingMessage="Loading device types..."
          emptyMessage="No device types found."
          errorMessage="Failed to load device types."
        />
      </section>
    </>
  )
}
