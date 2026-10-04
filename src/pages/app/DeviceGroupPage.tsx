import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  DetailPageLayout,
  DetailSidePanel,
  RelatedEntityModule,
  type DetailPanelSection,
} from '@/components/app/detail-page-layout'
import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { NO_VALUE_STR } from '@/constants'
import { EntityIcon } from '@/components/app/entity-icons'
import { getDeviceGroupDevicesRequest, getDeviceGroupRequest } from '@/features/groups/api'
import { DeviceGroupService } from '@/features/groups/device-group-service'
import { deviceGroupsQueryKeys } from '@/features/groups/query-keys'
import { deviceColumns } from '@/features/devices/device-columns'
import { DeviceService } from '@/features/devices/device-service'
import type { Device } from '@/types/device'
import type { DeviceGroup } from '@/types/group'
import { formatDateTime } from '@/utils/date-utils'
import { StringUtils } from '@/utils'

function getDeviceGroupFromListCache(queryClient: ReturnType<typeof useQueryClient>, groupId: string) {
  const cachedQueries = queryClient.getQueriesData<DataTableAsyncResult<DeviceGroup>>({
    queryKey: deviceGroupsQueryKeys.all,
  })

  for (const [, data] of cachedQueries) {
    const group = Array.isArray(data?.items) ? data.items.find((item) => item.id === groupId) : undefined
    if (group) return group
  }

  return undefined
}

function getDeviceGroupDevicesFromCache(queryClient: ReturnType<typeof useQueryClient>, groupId: string) {
  const cachedQueries = queryClient.getQueriesData<DataTableAsyncResult<Device>>({
    queryKey: deviceGroupsQueryKeys.devices(groupId),
  })

  for (const [, data] of cachedQueries) {
    if (Array.isArray(data?.items)) return data.items
  }

  return []
}

function toMembersResult(items: Device[], state: DataTableState<Device>): DataTableAsyncResult<Device> {
  const search = state.search.trim().toLocaleLowerCase()
  const filteredItems = search
    ? items.filter((device) =>
        [
          DeviceService.getDisplayName(device),
          device.serialNumber,
          device.customer?.name,
          device.store?.name,
          typeof device.type === 'object' ? device.type.name : device.type,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase().includes(search)),
      )
    : items
  const [sort] = state.sorting
  const sortedItems = sort
    ? [...filteredItems].sort((left, right) => {
        const result = StringUtils.safeLocaleCompare(
          String(left[sort.id as keyof Device] ?? ''),
          String(right[sort.id as keyof Device] ?? ''),
        )
        return sort.desc ? -result : result
      })
    : filteredItems
  const { pageIndex, pageSize } = state.pagination
  const start = pageIndex * pageSize

  return {
    items: sortedItems.slice(start, start + pageSize),
    count: sortedItems.length,
    pageCount: Math.max(1, Math.ceil(sortedItems.length / pageSize)),
  }
}

export default function DeviceGroupPage() {
  const { groupId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const groupQuery = useQuery({
    queryKey: deviceGroupsQueryKeys.detail(groupId),
    queryFn: () => getDeviceGroupRequest(groupId),
    enabled: Boolean(groupId),
    initialData: () => getDeviceGroupFromListCache(queryClient, groupId),
  })

  const group = groupQuery.data
  const deviceCount = group?.deviceCount ?? 0
  const headerActions = group
    ? DeviceGroupService.getDetailHeaderActions(group, queryClient, () => navigate('/device-groups'))
    : undefined

  const sections: DetailPanelSection[] = [
    {
      title: 'Details',
      icon: EntityIcon.groups,
      fields: [
        { label: 'ID', value: group?.id ?? NO_VALUE_STR },
        { label: 'Owner', value: group?.ownerId ?? NO_VALUE_STR },
        { label: 'Created at', value: formatDateTime(group?.createdAt, NO_VALUE_STR) },
        { label: 'Devices count', value: deviceCount },
      ],
    },
  ]

  const loadDevices = useCallback(
    async (state: DataTableState<Device>) => toMembersResult(await getDeviceGroupDevicesRequest(groupId), state),
    [groupId],
  )

  return (
    <DetailPageLayout
      header={{
        title: group?.name ?? 'Device Group',
        backTo: '/device-groups',
        options: headerActions?.options,
      }}
      modules={[{ key: 'devices', label: 'Devices', count: deviceCount }]}
      aside={<DetailSidePanel sections={sections} isLoading={groupQuery.isLoading} />}
    >
      <RelatedEntityModule
        id="module-devices"
        title="Devices"
        icon={EntityIcon.devices}
        initialTotal={deviceCount}
        action={{
          label: 'Add devices',
          onClick: () =>
            void DeviceGroupService.showAddDevicesModal(
              groupId,
              getDeviceGroupDevicesFromCache(queryClient, groupId),
              queryClient,
            ),
        }}
        queryKey={deviceGroupsQueryKeys.devices(groupId)}
        loadData={loadDevices}
        tableKey={`device-groups.${groupId}.devices`}
        columns={deviceColumns}
        getCommands={DeviceGroupService.getMemberTableActions(groupId, queryClient, navigate)}
        getRowCommands={DeviceGroupService.getMemberRowActions(groupId, queryClient)}
        loadingMessage="Loading group devices..."
        emptyMessage="No devices in this group."
        errorMessage="Failed to load group devices."
      />
    </DetailPageLayout>
  )
}
