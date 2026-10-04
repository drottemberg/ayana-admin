import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Link, useNavigate, useParams, type NavigateFunction } from 'react-router-dom'

import type { DataTableState } from '@/components/data-table'
import {
  DetailPageLayout,
  DetailSidePanel,
  EmptyRelatedEntityModule,
  RELATED_ENTITY_MODULE_PAGE_SIZE,
  RelatedEntityModule,
  type DetailPanelSection,
  type DetailPageModule,
} from '@/components/app/detail-page-layout'
import { EntityIcon } from '@/components/app/entity-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader, type PageHeaderProps } from '@/components/ui/page-header'
import {
  ActivityFeedCard,
  DeviceDataCard,
  DeviceInfoCard,
  SupportMaintenanceCard,
} from '@/features/devices/components/DeviceDetailCards'
import {
  assignDeviceToStoreRequest,
  devicesListConfig,
  getDeviceRequest,
  getDevicesRequest,
  getDeviceTypesRequest,
  runDeviceTypeCommandRequest,
  unassignDeviceFromStoreRequest,
} from '@/features/devices/api'
import { DeviceEntityStatusBadge, DeviceStatus } from '@/features/devices/components/DeviceStatus'
import { getDeviceTypeConfigsRequest, type DeviceTypeConfig } from '@/features/device-types/api'
import { deviceTypeConfigsQueryKeys } from '@/features/device-types/query-keys'
import { DeviceService } from '@/features/devices/device-service'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { useConnect } from '@/features/app/use-connect'
import { IssueService } from '@/features/issues/issue-service'
import {
  assignContractDeviceRequest,
  deviceContractHistoryListConfig,
  getDeviceContractHistoryRequest,
  unassignContractDeviceRequest,
} from '@/features/contracts/api'
import { contractDeviceHistoryColumns } from '@/features/contracts/contract-columns'
import { contractsQueryKeys } from '@/features/contracts/query-keys'
import { getIssuesRequest, issuesListConfig } from '@/features/issues/api'
import { issueColumns } from '@/features/issues/issue-columns'
import { issuesQueryKeys } from '@/features/issues/query-keys'
import { getDeviceGroupsRequest } from '@/features/groups/api'
import { deviceGroupColumns } from '@/features/groups/device-group-columns'
import { DeviceGroupService } from '@/features/groups/device-group-service'
import { deviceGroupsQueryKeys } from '@/features/groups/query-keys'
import {
  assignProductDeviceRequest,
  deviceProductHistoryListConfig,
  getDeviceProductHistoryRequest,
  unassignProductDeviceRequest,
} from '@/features/products/api'
import { productDeviceHistoryColumns } from '@/features/products/product-columns'
import { productsQueryKeys } from '@/features/products/query-keys'
import { deviceStoreHistoryListConfig, getDeviceStoreHistoryRequest } from '@/features/stores/api'
import { storeDeviceHistoryColumns } from '@/features/stores/store-columns'
import { storesQueryKeys } from '@/features/stores/query-keys'
import { useDetailQuery, useDictionaryQuery } from '@/lib/query-hooks'
import { useQuery } from '@tanstack/react-query'
import { batchListRequest } from '@/lib/batch-api'
import {
  createTableBatchCacheEntry,
  toBatchRequestDto,
  writeBatchEntriesToQueryCache,
  type BatchCacheEntry,
} from '@/lib/batch-query-cache'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import type { ContractDeviceHistory } from '@/types/contract'
import type { Device } from '@/types/device'
import type { DeviceGroup } from '@/types/group'
import type { Issue } from '@/types/issue'
import type { ProductDeviceHistory } from '@/types/product'
import type { StoreDeviceHistory } from '@/types/store'
import { FormError } from '@/components/form-error'
import { NO_VALUE_STR } from '@/constants'
import { Drawer, DrawerId } from '@/providers/drawer'
import { ModalId, Modals } from '@/providers/modal'
import { Feature } from '@/types/feature'
import { HugeiconsIcon } from '@hugeicons/react'
import { PencilEdit02Icon } from '@hugeicons/core-free-icons'
import { formatDateTime } from '@/utils/date-utils'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

type DeviceModuleKey = 'devices' | 'deviceGroups' | 'products' | 'mediaCampaigns' | 'contracts' | 'stores' | 'issues'

const deviceGroupsListConfig = {
  url: '/device-groups/list',
  toPayload: (tableState: DataTableState<DeviceGroup>, hiddenFilters?: Record<string, unknown>) =>
    toApiListDto(tableState, hiddenFilters),
  toResult: toDataTableResult<DeviceGroup>,
}

const MODULE_ANCHOR_PREFIX = 'module'
const DEVICE_BATCH_QUERY_KEY = 'device-detail-batch'

function getDeviceDetailSections(device?: Device, onEditInfos?: () => void): DetailPanelSection[] {
  return [
    {
      title: 'Details',
      icon: EntityIcon.devices,
      actions: device ? (
        <Button variant="ghost" size="icon-sm" aria-label="Edit device details" onClick={onEditInfos}>
          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
        </Button>
      ) : null,
      fields: [
        {
          label: 'Type',
          value: device ? DeviceService.getDisplayTypes(device).join(', ') || NO_VALUE_STR : NO_VALUE_STR,
        },
        { label: 'Active customer', value: device?.customer?.name || NO_VALUE_STR },
        { label: 'Active store', value: device?.store?.name || NO_VALUE_STR },
        { label: 'Active product', value: device?.activeProduct?.name || NO_VALUE_STR },
      ],
    },
  ]
}

const deviceSetDeviceColumns: ColumnDef<Device>[] = [
  {
    accessorKey: 'entityStatus',
    header: 'Status',
    cell: ({ row }) => <DeviceEntityStatusBadge status={row.original.entityStatus} />,
  },
  {
    accessorKey: 'status',
    header: 'Connection',
    cell: ({ row }) => <DeviceStatus status={row.original.status} />,
  },
  {
    accessorKey: 'name',
    header: 'Device name',
    cell: ({ row }) => (
      <Link to={`/devices/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
        {DeviceService.getDisplayName(row.original)}
      </Link>
    ),
  },
  { accessorKey: 'serialNumber', header: 'Serial number', enableSorting: false },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-2">
        {DeviceService.getTypeLabelsFromQuery(row.original).map((type) => (
          <Badge key={type} variant="secondary" className="bg-muted text-xs text-foreground">
            {type}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    accessorKey: 'firmwareVersion',
    header: 'Firmware',
    cell: ({ row }) => row.original.configuration?.firmwareVersion ?? NO_VALUE_STR,
  },
  {
    accessorKey: 'lastSeen',
    header: 'Last seen (UTC)',
    cell: ({ row }) => row.original.lastSeen ?? NO_VALUE_STR,
  },
]

export default function DevicePage() {
  const { deviceId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useConnect()

  const {
    data: device,
    isError,
    isLoading,
  } = useDetailQuery({
    queryKey: devicesQueryKeys.detail(deviceId),
    queryFn: () => getDeviceRequest(deviceId),
    enabled: Boolean(deviceId),
  })

  useDictionaryQuery({
    queryKey: devicesQueryKeys.types,
    queryFn: getDeviceTypesRequest,
  })

  const { data: deviceTypeConfigs = [] } = useQuery({
    queryKey: deviceTypeConfigsQueryKeys.all,
    queryFn: getDeviceTypeConfigsRequest,
  })

  const batchEntries = useMemo<BatchCacheEntry[]>(() => {
    if (!deviceId) return []

    return [
      ...(device?.isSet
        ? [
            createTableBatchCacheEntry<Device>({
              key: 'devices',
              queryKey: [...devicesQueryKeys.all, 'set-module', deviceId],
              tableKey: 'devices.detail.modules.devices',
              pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
              url: devicesListConfig.url,
              payload: (tableState) => devicesListConfig.toPayload(tableState, { parentId: deviceId }),
              map: devicesListConfig.toResult,
            }),
          ]
        : []),
      createTableBatchCacheEntry<DeviceGroup>({
        key: 'deviceGroups',
        queryKey: [...deviceGroupsQueryKeys.all, 'device-module', deviceId],
        tableKey: 'devices.detail.modules.device-groups',
        pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
        url: deviceGroupsListConfig.url,
        payload: (tableState) => deviceGroupsListConfig.toPayload(tableState, { deviceId }),
        map: (result) => deviceGroupsListConfig.toResult(result as ApiListResult<DeviceGroup>),
      }),
      ...(device?.isSet
        ? []
        : [
            createTableBatchCacheEntry<ProductDeviceHistory>({
              key: 'products',
              queryKey: [...productsQueryKeys.all, 'device-module', deviceId],
              tableKey: 'devices.detail.modules.products',
              pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
              url: deviceProductHistoryListConfig.url(deviceId),
              payload: (tableState) => deviceProductHistoryListConfig.toPayload(tableState),
              map: deviceProductHistoryListConfig.toResult,
            }),
          ]),
      createTableBatchCacheEntry<ContractDeviceHistory>({
        key: 'contracts',
        queryKey: [...contractsQueryKeys.all, 'device-module', deviceId],
        tableKey: 'devices.detail.modules.contracts',
        pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
        url: deviceContractHistoryListConfig.url(deviceId),
        payload: (tableState) => deviceContractHistoryListConfig.toPayload(tableState),
        map: deviceContractHistoryListConfig.toResult,
      }),
      createTableBatchCacheEntry<StoreDeviceHistory>({
        key: 'stores',
        queryKey: [...storesQueryKeys.all, 'device-module', deviceId],
        tableKey: 'devices.detail.modules.stores',
        pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
        url: deviceStoreHistoryListConfig.url(deviceId),
        payload: (tableState) => deviceStoreHistoryListConfig.toPayload(tableState),
        map: deviceStoreHistoryListConfig.toResult,
      }),
      createTableBatchCacheEntry<Issue>({
        key: 'issues',
        queryKey: [...issuesQueryKeys.all, 'device-module', deviceId],
        tableKey: 'devices.detail.modules.issues',
        pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
        url: issuesListConfig.url,
        payload: (tableState) => issuesListConfig.toPayload(tableState, { deviceId }),
        map: issuesListConfig.toResult,
      }),
    ]
  }, [device?.isSet, deviceId])

  const deviceBatchQuery = useQuery({
    queryKey: [DEVICE_BATCH_QUERY_KEY, deviceId, device?.isSet],
    queryFn: async () => {
      const data = await batchListRequest(toBatchRequestDto(batchEntries))
      const failedKeys = writeBatchEntriesToQueryCache({ data, entries: batchEntries, queryClient })

      return { data, failedKeys }
    },
    enabled: Boolean(deviceId) && Boolean(session) && Boolean(device),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const handleEditInfos = useCallback(() => {
    if (!device) return

    DeviceService.openEditInfos({ devices: [device], navigate })
  }, [device, navigate])

  if (isLoading) {
    return (
      <>
        <PageHeader title="Device name" subtitle="Loading..." backTo="/devices" />
        <DevicePageCards isLoading />
      </>
    )
  }

  if (isError || !device) {
    return (
      <>
        <PageHeader title="Device not found" subtitle={deviceId} backTo="/devices" />
        <section className="p-4 md:p-6">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Failed to load this device.
          </div>
        </section>
      </>
    )
  }

  const headerActions = DeviceService.getDetailHeaderActions({ devices: [device], navigate })
  const areModulesLoading =
    !session || deviceBatchQuery.isFetching || (!deviceBatchQuery.isSuccess && !deviceBatchQuery.isError)
  const areModulesErrored = Boolean(session) && deviceBatchQuery.isError
  const failedModuleKeys = new Set(deviceBatchQuery.data?.failedKeys ?? [])
  const batchData = deviceBatchQuery.data?.data
  const parentSetSubtitle =
    device.parentId && device.parentSet ? (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{device.serialNumber}</span>
        <span aria-hidden="true">·</span>
        <span>
          Set:{' '}
          <Link
            to={`/devices/${device.parentSet.id}`}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {device.parentSet.name || device.parentSet.serialNumber || device.parentSet.id}
          </Link>
        </span>
      </span>
    ) : null

  return (
    <DevicePageCards
      device={device}
      header={{
        title: (
          <span className="inline-flex min-w-0 flex-wrap items-center gap-3">
            <span className="truncate">{DeviceService.getDisplayName(device)}</span>
            {device.isSet ? null : <DeviceStatus status={device.status} />}
            <DeviceEntityStatusBadge status={device.entityStatus} />
          </span>
        ),
        subtitle: parentSetSubtitle ?? device.serialNumber,
        options: headerActions.options,
        backTo: '/devices',
      }}
      navigate={navigate}
      deviceTypeConfigs={deviceTypeConfigs}
      canEditDeviceTypeDocumentation={Boolean(session?.hasFeature(Feature.DEVICE_TYPE))}
      areModulesLoading={areModulesLoading}
      areModulesErrored={areModulesErrored}
      failedModuleKeys={failedModuleKeys}
      batchData={batchData}
      onEditInfos={handleEditInfos}
      onSetPassword={() => console.log('Set password for device:', device)}
    />
  )
}

function DevicePageCards({
  device,
  header,
  navigate,
  deviceTypeConfigs = [],
  canEditDeviceTypeDocumentation = false,
  isLoading = false,
  areModulesLoading = false,
  areModulesErrored = false,
  failedModuleKeys = new Set<string>(),
  batchData,
  onEditInfos,
  onSetPassword,
}: {
  device?: Device
  header?: Omit<PageHeaderProps, 'tabs'>
  navigate?: NavigateFunction
  deviceTypeConfigs?: DeviceTypeConfig[]
  canEditDeviceTypeDocumentation?: boolean
  isLoading?: boolean
  areModulesLoading?: boolean
  areModulesErrored?: boolean
  failedModuleKeys?: Set<string>
  batchData?: Record<string, unknown>
  onEditInfos?: () => void
  onSetPassword?: () => void
}) {
  const queryClient = useQueryClient()
  const deviceTypeId =
    device?.type && typeof device.type === 'object' ? device.type.id : (device?.type as string | undefined)
  const config = deviceTypeConfigs.find((c) => c.code === deviceTypeId)
  const initCommandKey = device?.id && config?.commands?.requestInfo ? `${device.id}:requestInfo` : ''
  const requestedInitCommandsRef = useRef(new Set<string>())

  useEffect(() => {
    if (!device?.id || !initCommandKey) return
    if (requestedInitCommandsRef.current.has(initCommandKey)) return

    requestedInitCommandsRef.current.add(initCommandKey)
    void runDeviceTypeCommandRequest(device.id, 'requestInfo')
      .then(() => new Promise((resolve) => window.setTimeout(resolve, 1000)))
      .then(() => queryClient.invalidateQueries({ queryKey: devicesQueryKeys.detail(device.id) }))
      .catch(() => {
        requestedInitCommandsRef.current.delete(initCommandKey)
      })
  }, [device?.id, initCommandKey, queryClient])

  const handleEditDeviceTypeDocumentation = useCallback(() => {
    if (!device || !config) return

    void Drawer.show(DrawerId.DeviceTypeDocumentation, { config }).finally(() =>
      queryClient.invalidateQueries({ queryKey: devicesQueryKeys.detail(device.id) }),
    )
  }, [config, device, queryClient])
  const supportMaintenanceAddAction =
    canEditDeviceTypeDocumentation && config ? handleEditDeviceTypeDocumentation : undefined
  const modules = getDeviceModules(device)

  if (!device || isLoading) {
    return (
      <DetailPageLayout
        header={header}
        modules={modules}
        aside={
          <>
            <DetailSidePanel sections={getDeviceDetailSections()} isLoading />
            <DeviceDataCard isLoading />
            <SupportMaintenanceCard isLoading />
            <ActivityFeedCard isLoading />
            <DeviceInfoCard isLoading />
          </>
        }
      >
        <DeviceModulesLoading modules={modules} />
      </DetailPageLayout>
    )
  }

  return (
    <DetailPageLayout
      header={header}
      modules={modules}
      aside={
        <>
          <DetailSidePanel sections={getDeviceDetailSections(device, onEditInfos)} />
          <DeviceDataCard data={device.data} />
          <SupportMaintenanceCard documents={device.maintenanceDocuments} onAdd={supportMaintenanceAddAction} />
          <ActivityFeedCard deviceId={device.id} items={device.activityFeed} />
          <DeviceInfoCard device={device} config={config} onSetPassword={onSetPassword} />
        </>
      }
    >
      <FormError
        message={device.activeIssue?.title ?? null}
        button={{
          name: 'Mark as resolve',
          onClick: () => {
            if (!device.activeIssue) return

            if (device.activeIssue.resolutionGuide?.steps.length) {
              Modals.show(ModalId.IssueResolution, { issue: device.activeIssue })
              return
            }

            void IssueService.markAsResolved([device.activeIssue])
          },
        }}
      />

      {areModulesLoading ? <DeviceModulesLoading modules={modules} /> : null}
      {areModulesErrored ? <DeviceModulesError modules={modules} /> : null}
      {!areModulesLoading && !areModulesErrored ? (
        <DeviceCenterModules
          device={device}
          navigate={navigate}
          failedModuleKeys={failedModuleKeys}
          batchData={batchData}
        />
      ) : null}
    </DetailPageLayout>
  )
}

function DeviceModulesLoading({ modules }: { modules: DetailPageModule[] }) {
  return (
    <>
      {modules.map((module) => (
        <EmptyRelatedEntityModule
          key={module.key}
          id={getDeviceModuleId(module.key as DeviceModuleKey)}
          title={module.label}
          description="Loading..."
        />
      ))}
    </>
  )
}

function DeviceModulesError({ modules }: { modules: DetailPageModule[] }) {
  return (
    <>
      {modules.map((module) => (
        <EmptyRelatedEntityModule
          key={module.key}
          id={getDeviceModuleId(module.key as DeviceModuleKey)}
          title={module.label}
          description="Failed to load."
        />
      ))}
    </>
  )
}

function DeviceModuleError({ module }: { module: DetailPageModule }) {
  return (
    <EmptyRelatedEntityModule
      id={getDeviceModuleId(module.key as DeviceModuleKey)}
      title={module.label}
      description="Failed to load."
    />
  )
}

function getDeviceModules(device?: Device): DetailPageModule[] {
  return [
    ...(device?.isSet ? [{ key: 'devices', label: 'Devices', count: device.devicesCount }] : []),
    { key: 'deviceGroups', label: 'Device groups' },
    ...(device?.isSet ? [] : [{ key: 'products', label: 'Products history' }]),
    { key: 'mediaCampaigns', label: 'Media campaigns' },
    { key: 'contracts', label: 'Contracts history' },
    { key: 'stores', label: 'Stores history' },
    { key: 'issues', label: 'Issues' },
  ]
}

function getDeviceModuleId(key: DeviceModuleKey) {
  return `${MODULE_ANCHOR_PREFIX}-${key}`
}

function getBatchListTotal(data: Record<string, unknown> | undefined, key: string) {
  const result = data?.[key]

  if (!result || typeof result !== 'object') return undefined

  const total = (result as ApiListResult<unknown>).total
  return typeof total === 'number' ? total : undefined
}

function DeviceCenterModules({
  device,
  navigate,
  failedModuleKeys,
  batchData,
}: {
  device: Device
  navigate?: NavigateFunction
  failedModuleKeys: Set<string>
  batchData?: Record<string, unknown>
}) {
  const queryClient = useQueryClient()
  const portal = getPortalSafe()
  const canManageProductAssignments = portal !== Portal.OPS
  const isChildDevice = Boolean(device.parentId)
  const canManageContractAssignments = portal !== Portal.CUSTOMER && !isChildDevice
  const canManageStoreAssignments = !isChildDevice
  const getInitialTotal = (key: string, fallback?: number) => getBatchListTotal(batchData, key) ?? fallback ?? 0
  const refreshProductHistory = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [...productsQueryKeys.all, 'device-module', device.id] }),
      queryClient.invalidateQueries({ queryKey: devicesQueryKeys.detail(device.id) }),
      queryClient.invalidateQueries({ queryKey: devicesQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: productsQueryKeys.all }),
    ])
  }, [device.id, queryClient])
  const refreshContractHistory = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [...contractsQueryKeys.all, 'device-module', device.id] }),
      queryClient.invalidateQueries({ queryKey: [...productsQueryKeys.all, 'device-module', device.id] }),
      queryClient.invalidateQueries({ queryKey: [...storesQueryKeys.all, 'device-module', device.id] }),
      queryClient.invalidateQueries({ queryKey: devicesQueryKeys.detail(device.id) }),
      queryClient.invalidateQueries({ queryKey: devicesQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: contractsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: productsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: storesQueryKeys.all }),
    ])
  }, [device.id, queryClient])
  const refreshStoreHistory = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [...storesQueryKeys.all, 'device-module', device.id] }),
      queryClient.invalidateQueries({ queryKey: devicesQueryKeys.detail(device.id) }),
      queryClient.invalidateQueries({ queryKey: devicesQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: storesQueryKeys.all }),
    ])
  }, [device.id, queryClient])
  const getProductHistoryRowCommands = useCallback(
    (item: ProductDeviceHistory) => [
      ...(canManageProductAssignments
        ? [
            {
              label: item.status === 'ACTIVE' ? 'Unassign' : 'Assign',
              variant: item.status === 'ACTIVE' ? ('destructive' as const) : ('default' as const),
              onClick: () => {
                void (async () => {
                  if (item.status === 'ACTIVE') {
                    const confirmed = await Modals.confirm({
                      operation: `unassign "${item.product.name}" from this device`,
                      okButtonProps: { variant: 'destructive' },
                    })
                    if (!confirmed) return

                    await unassignProductDeviceRequest(item.productId, device.id)
                  } else {
                    await assignProductDeviceRequest(item.productId, device.id)
                  }

                  await refreshProductHistory()
                })()
              },
            },
          ]
        : []),
      {
        label: 'History',
        onClick: () =>
          void Modals.alert({
            title: `${item.product.name} history`,
            content: <ProductAssignmentHistoryContent item={item} />,
            okText: 'Close',
          }),
      },
    ],
    [canManageProductAssignments, device.id, refreshProductHistory],
  )
  const getContractHistoryRowCommands = useCallback(
    (item: ContractDeviceHistory) => [
      ...(canManageContractAssignments
        ? [
            {
              label: item.status === 'ACTIVE' ? 'Unassign' : 'Assign',
              variant: item.status === 'ACTIVE' ? ('destructive' as const) : ('default' as const),
              onClick: () => {
                void (async () => {
                  if (item.status === 'ACTIVE') {
                    const confirmed = await Modals.confirm({
                      operation: `unassign "${item.contract.name || item.contract.id}" from this device`,
                      okButtonProps: { variant: 'destructive' },
                    })
                    if (!confirmed) return

                    await unassignContractDeviceRequest(item.contractId, device.id)
                  } else {
                    await assignContractDeviceRequest(item.contractId, device.id)
                  }

                  await refreshContractHistory()
                })()
              },
            },
          ]
        : []),
      {
        label: 'History',
        onClick: () =>
          void Modals.alert({
            title: `${item.contract.name || item.contract.id} history`,
            content: <ContractAssignmentHistoryContent item={item} />,
            okText: 'Close',
          }),
      },
    ],
    [canManageContractAssignments, device.id, refreshContractHistory],
  )
  const getStoreHistoryRowCommands = useCallback(
    (item: StoreDeviceHistory) => [
      ...(canManageStoreAssignments
        ? [
            {
              label: item.status === 'ACTIVE' ? 'Unassign' : 'Assign',
              variant: item.status === 'ACTIVE' ? ('destructive' as const) : ('default' as const),
              onClick: () => {
                void (async () => {
                  if (item.status === 'ACTIVE') {
                    const confirmed = await Modals.confirm({
                      operation: `unassign "${item.store.name || item.store.id}" from this device`,
                      okButtonProps: { variant: 'destructive' },
                    })
                    if (!confirmed) return

                    await unassignDeviceFromStoreRequest(device.id, item.storeId)
                  } else {
                    await assignDeviceToStoreRequest(device.id, item.storeId)
                  }

                  await refreshStoreHistory()
                })()
              },
            },
          ]
        : []),
      {
        label: 'History',
        onClick: () =>
          void Modals.alert({
            title: `${item.store.name || item.store.id} history`,
            content: <StoreAssignmentHistoryContent item={item} />,
            okText: 'Close',
          }),
      },
    ],
    [canManageStoreAssignments, device.id, refreshStoreHistory],
  )

  return (
    <>
      {device.isSet ? (
        failedModuleKeys.has('devices') ? (
          <DeviceModuleError module={{ key: 'devices', label: 'Devices' }} />
        ) : (
          <RelatedEntityModule
            id={getDeviceModuleId('devices')}
            title="Devices"
            icon={EntityIcon.devices}
            initialTotal={getInitialTotal('devices', device.devicesCount ?? device.deviceItems?.length ?? 0)}
            viewAllTo={`/devices?${new URLSearchParams({ 'f.parentId': device.id }).toString()}`}
            queryKey={[...devicesQueryKeys.all, 'set-module', device.id]}
            loadData={(state: DataTableState<Device>) => getDevicesRequest(state, { parentId: device.id })}
            tableKey="devices.detail.modules.devices"
            columns={deviceSetDeviceColumns}
            getCommands={(devices) => DeviceService.getTableActions({ devices, navigate })}
            getRowCommands={(device) => DeviceService.getActions(device, navigate)}
            action={DeviceService.getModuleAction(device, 'devices', navigate)}
            loadingMessage="Loading devices..."
            emptyMessage="No devices found."
            refetchOnMount={false}
          />
        )
      ) : null}
      {failedModuleKeys.has('deviceGroups') ? (
        <DeviceModuleError module={{ key: 'deviceGroups', label: 'Device groups' }} />
      ) : (
        <RelatedEntityModule
          id={getDeviceModuleId('deviceGroups')}
          title="Device groups"
          icon={EntityIcon.groups}
          initialTotal={getInitialTotal('deviceGroups')}
          viewAllTo={`/device-groups?${new URLSearchParams({ 'f.deviceId': device.id }).toString()}`}
          queryKey={[...deviceGroupsQueryKeys.all, 'device-module', device.id]}
          loadData={(state: DataTableState<DeviceGroup>) => getDeviceGroupsRequest(state, { deviceId: device.id })}
          tableKey="devices.detail.modules.device-groups"
          columns={deviceGroupColumns}
          getRowCommands={(group) => DeviceGroupService.getRowActions(group, queryClient)}
          action={DeviceService.getModuleAction(device, 'deviceGroups', navigate)}
          loadingMessage="Loading device groups..."
          emptyMessage="No device groups found."
          refetchOnMount={false}
        />
      )}
      {device.isSet ? null : failedModuleKeys.has('products') ? (
        <DeviceModuleError module={{ key: 'products', label: 'Products history' }} />
      ) : (
        <RelatedEntityModule
          id={getDeviceModuleId('products')}
          title="Products history"
          icon={EntityIcon.products}
          initialTotal={getInitialTotal('products', device.activeProduct?.id ? 1 : 0)}
          queryKey={[...productsQueryKeys.all, 'device-module', device.id]}
          loadData={(state: DataTableState<ProductDeviceHistory>) => getDeviceProductHistoryRequest(device.id, state)}
          tableKey="devices.detail.modules.products"
          columns={productDeviceHistoryColumns}
          getRowCommands={getProductHistoryRowCommands}
          action={DeviceService.getModuleAction(device, 'products', navigate)}
          loadingMessage="Loading products..."
          emptyMessage="No products found."
          refetchOnMount={false}
        />
      )}
      <EmptyRelatedEntityModule
        id={getDeviceModuleId('mediaCampaigns')}
        title="Media campaigns"
        icon={EntityIcon.mediaCampaigns}
        action={DeviceService.getModuleAction(device, 'mediaCampaigns', navigate)}
        description={
          device.activeCampaign?.name
            ? `${device.activeCampaign.name}${device.activeCampaign.status ? ` (${device.activeCampaign.status})` : ''}`
            : 'No active media campaign.'
        }
      />
      {failedModuleKeys.has('contracts') ? (
        <DeviceModuleError module={{ key: 'contracts', label: 'Contracts history' }} />
      ) : (
        <RelatedEntityModule
          id={getDeviceModuleId('contracts')}
          title="Contracts history"
          icon={EntityIcon.contracts}
          initialTotal={getInitialTotal('contracts', device.contract?.id ? 1 : 0)}
          queryKey={[...contractsQueryKeys.all, 'device-module', device.id]}
          loadData={(state: DataTableState<ContractDeviceHistory>) => getDeviceContractHistoryRequest(device.id, state)}
          tableKey="devices.detail.modules.contracts"
          columns={contractDeviceHistoryColumns}
          getRowCommands={getContractHistoryRowCommands}
          action={DeviceService.getModuleAction(device, 'contracts', navigate)}
          loadingMessage="Loading contracts..."
          emptyMessage="No contracts found."
          refetchOnMount={false}
        />
      )}
      {failedModuleKeys.has('stores') ? (
        <DeviceModuleError module={{ key: 'stores', label: 'Stores history' }} />
      ) : (
        <RelatedEntityModule
          id={getDeviceModuleId('stores')}
          title="Stores history"
          icon={EntityIcon.stores}
          initialTotal={getInitialTotal('stores', device.store?.id ? 1 : 0)}
          queryKey={[...storesQueryKeys.all, 'device-module', device.id]}
          loadData={(state: DataTableState<StoreDeviceHistory>) => getDeviceStoreHistoryRequest(device.id, state)}
          tableKey="devices.detail.modules.stores"
          columns={storeDeviceHistoryColumns}
          getRowCommands={getStoreHistoryRowCommands}
          action={DeviceService.getModuleAction(device, 'stores', navigate)}
          loadingMessage="Loading stores..."
          emptyMessage="No stores found."
          refetchOnMount={false}
        />
      )}
      {failedModuleKeys.has('issues') ? (
        <DeviceModuleError module={{ key: 'issues', label: 'Issues' }} />
      ) : (
        <RelatedEntityModule
          id={getDeviceModuleId('issues')}
          title="Issues"
          icon={EntityIcon.issues}
          initialTotal={getInitialTotal('issues', device.activeIssue ? 1 : 0)}
          viewAllTo={`/issues?${new URLSearchParams({ 'f.deviceId': device.id }).toString()}`}
          queryKey={[...issuesQueryKeys.all, 'device-module', device.id]}
          loadData={(state: DataTableState<Issue>) => getIssuesRequest(state, { deviceId: device.id })}
          tableKey="devices.detail.modules.issues"
          columns={issueColumns}
          getRowCommands={(issue) => IssueService.getActions(issue)}
          action={DeviceService.getModuleAction(device, 'issues', navigate)}
          loadingMessage="Loading issues..."
          emptyMessage="No issues found."
          refetchOnMount={false}
        />
      )}
    </>
  )
}

function ProductAssignmentHistoryContent({ item }: { item: ProductDeviceHistory }) {
  return (
    <div className="max-h-[420px] overflow-auto">
      <div className="grid gap-2 text-sm">
        {item.history.map((period) => (
          <div key={period.id} className="grid gap-1 rounded-md border border-border p-3">
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
              <span className="text-muted-foreground">Assigned</span>
              <span className="font-medium">{formatDateTime(period.assignedAt, NO_VALUE_STR)}</span>
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
              <span className="text-muted-foreground">Unassigned</span>
              <span className="font-medium">{formatDateTime(period.unassignedAt ?? undefined, NO_VALUE_STR)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ContractAssignmentHistoryContent({ item }: { item: ContractDeviceHistory }) {
  return (
    <div className="max-h-[420px] overflow-auto">
      <div className="grid gap-2 text-sm">
        {item.history.map((period) => (
          <div key={period.id} className="grid gap-1 rounded-md border border-border p-3">
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
              <span className="text-muted-foreground">Assigned</span>
              <span className="font-medium">{formatDateTime(period.assignedAt, NO_VALUE_STR)}</span>
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
              <span className="text-muted-foreground">Unassigned</span>
              <span className="font-medium">{formatDateTime(period.unassignedAt ?? undefined, NO_VALUE_STR)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StoreAssignmentHistoryContent({ item }: { item: StoreDeviceHistory }) {
  return (
    <div className="max-h-[420px] overflow-auto">
      <div className="grid gap-2 text-sm">
        {item.history.map((period) => (
          <div key={period.id} className="grid gap-1 rounded-md border border-border p-3">
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
              <span className="text-muted-foreground">Assigned</span>
              <span className="font-medium">{formatDateTime(period.assignedAt, NO_VALUE_STR)}</span>
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3">
              <span className="text-muted-foreground">Unassigned</span>
              <span className="font-medium">{formatDateTime(period.unassignedAt ?? undefined, NO_VALUE_STR)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
