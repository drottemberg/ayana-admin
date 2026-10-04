import { useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import {
  DeviceTypeStatusValues,
  getDeviceTypeCode,
  getDeviceTypeConfigsRequest,
  getDeviceTypeGroupRequest,
  getDeviceTypeGroupsRequest,
  getDeviceTypesTableRequest,
  type DeviceTypeConfig,
} from '@/features/device-types/api'
import { deviceTypeColumns } from '@/features/device-types/device-type-columns'
import { DeviceTypeGroupService } from '@/features/device-types/device-type-group-service'
import { DeviceTypeService } from '@/features/device-types/device-type-service'
import { deviceTypeConfigsQueryKeys } from '@/features/device-types/query-keys'

export default function DeviceTypeGroupPage() {
  const { groupId = '' } = useParams()
  const queryClient = useQueryClient()
  const { data: group, isError } = useQuery({
    queryKey: deviceTypeConfigsQueryKeys.groupDetail(groupId),
    queryFn: () => getDeviceTypeGroupRequest(groupId),
    enabled: !!groupId,
  })
  const { data: groups = [] } = useQuery({
    queryKey: deviceTypeConfigsQueryKeys.groups,
    queryFn: getDeviceTypeGroupsRequest,
  })
  const { data: configs = [] } = useQuery({
    queryKey: deviceTypeConfigsQueryKeys.all,
    queryFn: getDeviceTypeConfigsRequest,
  })
  const existingTypes = configs.map(getDeviceTypeCode)
  const headerActions = DeviceTypeService.getDetailHeaderActions(
    group,
    groups,
    existingTypes,
    deviceTypeConfigsQueryKeys.groupDetail(groupId),
  )
  const groupHeaderActions = DeviceTypeGroupService.getDetailHeaderActions(group)
  const loadData = useCallback(
    (state: DataTableState<DeviceTypeConfig>) => getDeviceTypesTableRequest(state, { groupId }),
    [groupId],
  )

  return (
    <>
      <PageHeader
        title={group?.name ?? 'Device Type Group'}
        subtitle="Configure MQTT variable mappings per device type."
        backTo="/device-type-groups"
        primaryAction={headerActions.primaryAction}
        options={groupHeaderActions.options}
      />
      <section className="space-y-5 p-4 md:p-6">
        {isError ? <p className="text-sm text-destructive">Failed to load device type group.</p> : null}
        <DataTableAsync
          queryKey={[...deviceTypeConfigsQueryKeys.groupDetail(groupId), 'types-table']}
          loadData={loadData}
          tableKey={`device-type-groups.${groupId}.types.v2`}
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
          ]}
          getRowCommands={(config) =>
            DeviceTypeService.getRowActions(config, {
              groups,
              existingTypes,
              queryClient,
              extraInvalidateQueryKey: deviceTypeConfigsQueryKeys.groupDetail(groupId),
            })
          }
          loadingMessage="Loading device types..."
          emptyMessage="No device types in this group."
          errorMessage="Failed to load device types."
        />
      </section>
    </>
  )
}
