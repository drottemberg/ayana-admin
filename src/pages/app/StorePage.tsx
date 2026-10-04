import { useMemo } from 'react'
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { ActivityFeedCard, type ActivityFeedItem } from '@/components/app/ActivityFeedCard'
import {
  DetailPageLayout,
  DetailSidePanel,
  EmptyRelatedEntityModule,
  RELATED_ENTITY_MODULE_PAGE_SIZE,
  RelatedEntityModule,
  type DetailPanelSection,
} from '@/components/app/detail-page-layout'
import type { DataTableState } from '@/components/data-table'
import { EntityIcon } from '@/components/app/entity-icons'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { NO_VALUE_STR } from '@/constants'
import { useConnect } from '@/features/app/use-connect'
import { devicesListConfig, getDevicesRequest, getDeviceTypesRequest } from '@/features/devices/api'
import { DeviceDataCard } from '@/features/devices/components/DeviceDetailCards'
import { deviceColumns } from '@/features/devices/device-columns'
import { DeviceService } from '@/features/devices/device-service'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { getIssuesRequest, issuesListConfig } from '@/features/issues/api'
import { issueColumns } from '@/features/issues/issue-columns'
import { IssueService } from '@/features/issues/issue-service'
import { issuesQueryKeys } from '@/features/issues/query-keys'
import { getStoreGroupsRequest } from '@/features/groups/api'
import { storeGroupColumns } from '@/features/groups/store-group-columns'
import { StoreGroupService } from '@/features/groups/store-group-service'
import { storeGroupsQueryKeys } from '@/features/groups/query-keys'
import { OrganizationService } from '@/features/organizations/organization-service'
import { OrganizationStatusBadge } from '@/features/organizations/OrganizationStatusBadge'
import { getPartnersRequest, partnersListConfig } from '@/features/partners/api'
import { partnerColumns } from '@/features/partners/partner-columns'
import { partnersQueryKeys } from '@/features/partners/query-keys'
import { getStoreRequest } from '@/features/stores/api'
import { storesQueryKeys } from '@/features/stores/query-keys'
import { StoreService } from '@/features/stores/store-service'
import { getUserListColumns } from '@/features/users/user-columns'
import { getUsersRequest, usersListConfig } from '@/features/users/api'
import { UserService } from '@/features/users/user-service'
import { usersQueryKeys } from '@/features/users/query-keys'
import { batchListRequest } from '@/lib/batch-api'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import {
  createTableBatchCacheEntry,
  toBatchRequestDto,
  writeBatchEntriesToQueryCache,
  type BatchCacheEntry,
} from '@/lib/batch-query-cache'
import { useDetailQuery, useDictionaryQuery } from '@/lib/query-hooks'
import { Drawer, DrawerId } from '@/providers/drawer'
import { ModalId, Modals } from '@/providers/modal'
import type { Device, DeviceData } from '@/types/device'
import type { Issue } from '@/types/issue'
import type { MaintenancePartner } from '@/types/partner'
import type { StoreGroup } from '@/types/group'
import type { Store } from '@/types/store'
import type { User } from '@/types/user'
import { StringUtils, TimezoneUtils } from '@/utils'
import * as GeoUtils from '@/utils/geo-utils'
import { formatDateTime } from '@/utils/date-utils'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

const MODULE_ANCHOR_PREFIX = 'module'
const STORE_BATCH_QUERY_KEY = 'store-detail-batch'
const storeActivityFeed: ActivityFeedItem[] = []
const storeDeviceData: DeviceData | undefined = undefined

const storeGroupsListConfig = {
  url: '/store-groups/list',
  toPayload: (tableState: DataTableState<StoreGroup>, hiddenFilters?: Record<string, unknown>) =>
    toApiListDto(tableState, hiddenFilters),
  toResult: toDataTableResult<StoreGroup>,
}

function makeViewAllTo(path: string, storeId: string) {
  const params = new URLSearchParams({ storeId })

  return `${path}?${params.toString()}`
}

function getStoreCounter(store: Store, key: string) {
  const counters = store.counters as Record<string, number | undefined> | undefined

  return counters?.[key]
}

function getBatchListTotal(data: Record<string, unknown> | undefined, key: string) {
  const result = data?.[key]

  if (!result || typeof result !== 'object') return undefined

  const total = (result as { total?: unknown }).total
  return typeof total === 'number' ? total : undefined
}

function getStoreCustomer(store?: Store) {
  const parent = store?.parent as { id?: string; name?: string } | undefined
  const customer = store?.customer as { id?: string; name?: string } | undefined
  const id = customer?.id ?? parent?.id ?? store?.parentId
  const name = customer?.name ?? parent?.name

  return { id, name }
}

function StoreCustomerLink({ store, className }: { store?: Store; className?: string }) {
  const customer = getStoreCustomer(store)
  if (!customer.name) return NO_VALUE_STR
  if (!customer.id) return customer.name

  return (
    <Link to={`/customers/${customer.id}`} className={className ?? 'font-medium underline-offset-2 hover:underline'}>
      {customer.name}
    </Link>
  )
}

function StoreModulesLoading({ modules }: { modules: { key: string; label: string }[] }) {
  return (
    <>
      {modules.map((module) => (
        <EmptyRelatedEntityModule
          key={module.key}
          id={`${MODULE_ANCHOR_PREFIX}-${module.key}`}
          title={module.label}
          description="Loading..."
        />
      ))}
    </>
  )
}

function StoreModulesError({ modules }: { modules: { key: string; label: string }[] }) {
  return (
    <>
      {modules.map((module) => (
        <EmptyRelatedEntityModule
          key={module.key}
          id={`${MODULE_ANCHOR_PREFIX}-${module.key}`}
          title={module.label}
          description="Failed to load."
        />
      ))}
    </>
  )
}

function StoreModuleError({ module }: { module: { key: string; label: string } }) {
  return (
    <EmptyRelatedEntityModule
      id={`${MODULE_ANCHOR_PREFIX}-${module.key}`}
      title={module.label}
      description="Failed to load."
    />
  )
}

function getStoreDetailSections(store?: Store): DetailPanelSection[] {
  return [
    {
      title: 'Details',
      actions: store ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit store details"
          onClick={() => Drawer.show(DrawerId.CreateStore, { store })}
        >
          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
        </Button>
      ) : null,
      fields: [
        {
          label: 'Status',
          value: store ? (
            <OrganizationStatusBadge
              status={store.orgStatus}
              isDeleted={store.isDeleted}
              isArchived={store.isArchived}
            />
          ) : (
            NO_VALUE_STR
          ),
        },
        { label: 'ID', value: store?.id ?? NO_VALUE_STR },
        { label: 'Name', value: store?.name ?? NO_VALUE_STR },
        { label: 'Customer', value: <StoreCustomerLink store={store} /> },
        { label: 'Retailer', value: store?.retailer ?? NO_VALUE_STR },
        {
          label: 'Address',
          value: store?.address ? StringUtils.displayAddress(store.address, { hideCountry: true }) : NO_VALUE_STR,
        },
        { label: 'City', value: store?.address?.city ?? NO_VALUE_STR },
        { label: 'Region', value: store?.address?.stateId ?? NO_VALUE_STR },
        { label: 'Country', value: GeoUtils.getCountryName(store?.address?.countryId) ?? NO_VALUE_STR },
        { label: 'Timezone', value: TimezoneUtils.getTimezoneLabel(store?.timezone) || NO_VALUE_STR },
        { label: 'Phone', value: store?.phone ?? NO_VALUE_STR },
        { label: 'Email', value: store?.email ?? NO_VALUE_STR },
        { label: 'Last seen', value: store?.lastSeen ?? NO_VALUE_STR },
        { label: 'Product level', value: store?.productLevel ?? NO_VALUE_STR },
        {
          label: 'Created at',
          value: store?.createdAt ? formatDateTime(store.createdAt, NO_VALUE_STR) : NO_VALUE_STR,
        },
      ],
    },
  ]
}

export default function StorePage() {
  const { storeId = '' } = useParams()
  const { session } = useConnect()
  const queryClient = useQueryClient()
  const portal = getPortalSafe()
  const currentOrganizationId = session?.currentOrganization?.id ?? undefined
  const canEditUserPermissions = session?.permissions.users?.edit
  const canManageStoreDetails = StoreService.canManageDetails()
  const canShowUsers = canManageStoreDetails || portal === Portal.OPS
  const modules = StoreService.getDetailModules()
  const userHiddenFilters = useMemo(
    () => ({
      storeId,
      partnerId: portal === Portal.OPS ? currentOrganizationId : undefined,
    }),
    [currentOrganizationId, portal, storeId],
  )
  const {
    data: store,
    isError,
    isLoading,
  } = useDetailQuery({
    queryKey: storesQueryKeys.detail(storeId),
    queryFn: () => getStoreRequest(storeId),
    enabled: Boolean(storeId),
  })

  useDictionaryQuery({
    queryKey: devicesQueryKeys.types,
    queryFn: getDeviceTypesRequest,
  })

  const batchEntries = useMemo<BatchCacheEntry[]>(() => {
    if (!storeId) return []

    const entries: BatchCacheEntry[] = [
      ...(canShowUsers
        ? [
            createTableBatchCacheEntry<User>({
              key: 'users',
              queryKey: [...usersQueryKeys.organization(storeId), 'store-module'],
              tableKey: 'stores.detail.modules.users',
              pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
              url: usersListConfig.url,
              payload: (tableState) => usersListConfig.toPayload(tableState, userHiddenFilters),
              map: usersListConfig.toResult,
            }),
          ]
        : []),
      createTableBatchCacheEntry<Device>({
        key: 'devices',
        queryKey: [...devicesQueryKeys.all, 'store-module', storeId],
        tableKey: 'stores.detail.modules.devices',
        pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
        url: devicesListConfig.url,
        payload: (tableState) => devicesListConfig.toPayload(tableState, { storeId }),
        map: devicesListConfig.toResult,
      }),
      createTableBatchCacheEntry<StoreGroup>({
        key: 'storeGroups',
        queryKey: [...storeGroupsQueryKeys.all, 'store-module', storeId],
        tableKey: 'stores.detail.modules.store-groups',
        pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
        url: storeGroupsListConfig.url,
        payload: (tableState) => storeGroupsListConfig.toPayload(tableState, { storeId }),
        map: (result) => storeGroupsListConfig.toResult(result as ApiListResult<StoreGroup>),
      }),
      ...(canManageStoreDetails
        ? [
            createTableBatchCacheEntry<MaintenancePartner>({
              key: 'partners',
              queryKey: [...partnersQueryKeys.all, 'store-module', storeId],
              tableKey: 'stores.detail.modules.partners',
              pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
              url: partnersListConfig.url,
              payload: (tableState) => partnersListConfig.toPayload(tableState, { storeId }),
              map: partnersListConfig.toResult,
            }),
          ]
        : []),
      createTableBatchCacheEntry<Issue>({
        key: 'issues',
        queryKey: [...issuesQueryKeys.all, 'store-module', storeId],
        tableKey: 'stores.detail.modules.issues',
        pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
        url: issuesListConfig.url,
        payload: (tableState) => issuesListConfig.toPayload(tableState, { storeId }),
        map: issuesListConfig.toResult,
      }),
    ]

    return entries
  }, [canManageStoreDetails, canShowUsers, storeId, userHiddenFilters])

  const storeBatchQuery = useQuery({
    queryKey: [STORE_BATCH_QUERY_KEY, storeId, canShowUsers, currentOrganizationId, portal],
    queryFn: async () => {
      const data = await batchListRequest(toBatchRequestDto(batchEntries))
      const failedKeys = writeBatchEntriesToQueryCache({ data, entries: batchEntries, queryClient })

      return { data, failedKeys }
    },
    enabled: Boolean(storeId) && Boolean(session) && Boolean(store),
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const areModulesLoading =
    !session || storeBatchQuery.isFetching || (!storeBatchQuery.isSuccess && !storeBatchQuery.isError)
  const areModulesErrored = Boolean(session) && storeBatchQuery.isError
  const failedModuleKeys = new Set(storeBatchQuery.data?.failedKeys ?? [])
  const batchData = storeBatchQuery.data?.data

  if (isLoading) {
    return (
      <DetailPageLayout
        header={{
          title: 'Store name',
          subtitle: 'Loading...',
          backTo: '/stores',
        }}
        modules={modules}
        aside={<DetailSidePanel sections={getStoreDetailSections()} isLoading />}
      >
        <StoreOverview storeId={storeId} isLoading />
        <StoreModulesLoading modules={modules} />
      </DetailPageLayout>
    )
  }

  if (isError || !store) {
    return (
      <>
        <PageHeader title="Store not found" subtitle={storeId} backTo="/stores" />
        <section className="p-4 md:p-6">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Failed to load this store.
          </div>
        </section>
      </>
    )
  }

  const headerActions = StoreService.getDetailHeaderActions(store)
  const customerId = getStoreCustomer(store).id
  const getInitialTotal = (key: string, fallback?: number) =>
    getBatchListTotal(batchData, key) ?? fallback ?? getStoreCounter(store, key) ?? 0

  return (
    <DetailPageLayout
      header={{
        title: store.name,
        subtitle: <StoreCustomerLink store={store} className="underline-offset-2 hover:underline" />,
        backTo: '/stores',
        options: headerActions.options,
      }}
      modules={modules}
      aside={<DetailSidePanel sections={getStoreDetailSections(store)} />}
    >
      <StoreOverview storeId={store.id} store={store} />
      {areModulesLoading ? <StoreModulesLoading modules={modules} /> : null}
      {areModulesErrored ? <StoreModulesError modules={modules} /> : null}
      {!areModulesLoading && !areModulesErrored ? (
        <>
          {canShowUsers ? (
            failedModuleKeys.has('users') ? (
              <StoreModuleError module={{ key: 'users', label: 'Active users' }} />
            ) : (
              <RelatedEntityModule
                id={`${MODULE_ANCHOR_PREFIX}-users`}
                title="Active users"
                icon={EntityIcon.users}
                queryKey={[...usersQueryKeys.organization(store.id), 'store-module']}
                loadData={(tableState) =>
                  getUsersRequest(tableState, {
                    storeId: store.id,
                    partnerId: portal === Portal.OPS ? currentOrganizationId : undefined,
                  })
                }
                tableKey="stores.detail.modules.users"
                columns={getUserListColumns({
                  usage: 'store-details',
                  portal,
                  storeId: store.id,
                  customerId,
                  partnerId: portal === Portal.OPS ? currentOrganizationId : undefined,
                  canEditPermissions: canEditUserPermissions,
                })}
                getRowCommands={(user: User) => UserService.getActions(user, session?.permissions.users)}
                action={StoreService.getModuleAction(store, 'users')}
                initialTotal={getInitialTotal('users', store.users)}
                viewAllTo={makeViewAllTo('/users', store.id)}
                loadingMessage="Loading users..."
                emptyMessage="No users found."
                refetchOnMount={false}
              />
            )
          ) : null}
          {failedModuleKeys.has('devices') ? (
            <StoreModuleError module={{ key: 'devices', label: 'Active devices' }} />
          ) : (
            <RelatedEntityModule
              id={`${MODULE_ANCHOR_PREFIX}-devices`}
              title="Active devices"
              icon={EntityIcon.devices}
              queryKey={[...devicesQueryKeys.all, 'store-module', store.id]}
              loadData={(tableState) => getDevicesRequest(tableState, { storeId: store.id })}
              tableKey="stores.detail.modules.devices"
              columns={deviceColumns}
              getRowCommands={(device: Device) => DeviceService.getActions(device)}
              action={StoreService.getModuleAction(store, 'devices')}
              initialTotal={getInitialTotal('devices')}
              viewAllTo={makeViewAllTo('/devices', store.id)}
              loadingMessage="Loading devices..."
              emptyMessage="No devices found."
              refetchOnMount={false}
            />
          )}
          {failedModuleKeys.has('storeGroups') ? (
            <StoreModuleError module={{ key: 'storeGroups', label: 'Store groups' }} />
          ) : (
            <RelatedEntityModule
              id={`${MODULE_ANCHOR_PREFIX}-storeGroups`}
              title="Store groups"
              icon={EntityIcon.groups}
              queryKey={[...storeGroupsQueryKeys.all, 'store-module', store.id]}
              loadData={(tableState: DataTableState<StoreGroup>) =>
                getStoreGroupsRequest(tableState, { storeId: store.id })
              }
              tableKey="stores.detail.modules.store-groups"
              columns={storeGroupColumns}
              getRowCommands={(group) => StoreGroupService.getRowActions(group, queryClient)}
              action={StoreService.getModuleAction(store, 'storeGroups')}
              initialTotal={getInitialTotal('storeGroups')}
              viewAllTo={`/store-groups?${new URLSearchParams({ 'f.storeId': store.id }).toString()}`}
              loadingMessage="Loading store groups..."
              emptyMessage="No store groups found."
              refetchOnMount={false}
            />
          )}
          {canManageStoreDetails ? (
            failedModuleKeys.has('partners') ? (
              <StoreModuleError module={{ key: 'partners', label: 'Maintenance partners' }} />
            ) : (
              <RelatedEntityModule
                id={`${MODULE_ANCHOR_PREFIX}-partners`}
                title="Maintenance partners"
                icon={EntityIcon.partners}
                queryKey={[...partnersQueryKeys.all, 'store-module', store.id]}
                loadData={(tableState) => getPartnersRequest(tableState, { storeId: store.id })}
                tableKey="stores.detail.modules.partners"
                columns={partnerColumns}
                getRowCommands={(partner: MaintenancePartner) =>
                  OrganizationService.getActions({
                    kind: 'partner',
                    organization: partner,
                  })
                }
                action={StoreService.getModuleAction(store, 'partners')}
                initialTotal={getInitialTotal('partners')}
                viewAllTo={makeViewAllTo('/partners', store.id)}
                loadingMessage="Loading maintenance partners..."
                emptyMessage="No maintenance partners found."
                refetchOnMount={false}
              />
            )
          ) : null}
          {failedModuleKeys.has('issues') ? (
            <StoreModuleError module={{ key: 'issues', label: 'Last issues' }} />
          ) : (
            <RelatedEntityModule
              id={`${MODULE_ANCHOR_PREFIX}-issues`}
              title="Last issues"
              icon={EntityIcon.issues}
              queryKey={[...issuesQueryKeys.all, 'store-module', store.id]}
              loadData={(tableState) => getIssuesRequest(tableState, { storeId: store.id })}
              tableKey="stores.detail.modules.issues"
              columns={issueColumns}
              getRowCommands={(issue: Issue) => IssueService.getActions(issue)}
              action={StoreService.getModuleAction(store, 'issues')}
              initialTotal={getInitialTotal('issues')}
              viewAllTo={makeViewAllTo('/issues', store.id)}
              loadingMessage="Loading issues..."
              emptyMessage="No issues found."
              refetchOnMount={false}
            />
          )}
        </>
      ) : null}
    </DetailPageLayout>
  )
}

function StoreOverview({ store, storeId, isLoading = false }: { store?: Store; storeId: string; isLoading?: boolean }) {
  return (
    <div id={`${MODULE_ANCHOR_PREFIX}-overview`} className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <DeviceDataCard data={storeDeviceData} isLoading={isLoading || !store} />
        <ActivityFeedCard
          isLoading={isLoading}
          items={storeActivityFeed}
          onAddComment={() => Modals.show(ModalId.AddComment, { deviceId: store?.id ?? storeId })}
          onSettings={() => {}}
        />
      </div>
    </div>
  )
}
