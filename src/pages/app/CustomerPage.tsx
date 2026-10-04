import { useMemo } from 'react'
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import {
  DetailPageLayout,
  DetailSidePanel,
  EmptyRelatedEntityModule,
  RELATED_ENTITY_MODULE_PAGE_SIZE,
  RelatedEntityModule,
  type DetailPanelSection,
} from '@/components/app/detail-page-layout'
import { EntityIcon } from '@/components/app/entity-icons'
import type { DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { NO_VALUE_STR } from '@/constants'
import { contractsListConfig, getContractsRequest } from '@/features/contracts/api'
import { contractColumns } from '@/features/contracts/contract-columns'
import { ContractService } from '@/features/contracts/contract-service'
import { contractsQueryKeys } from '@/features/contracts/query-keys'
import { getCustomerRequest } from '@/features/customers/api'
import { CustomerService } from '@/features/customers/customer-service'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { devicesListConfig, getDevicesRequest } from '@/features/devices/api'
import { deviceColumns } from '@/features/devices/device-columns'
import { DeviceService } from '@/features/devices/device-service'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { getIssuesRequest, issuesListConfig } from '@/features/issues/api'
import { issueColumns } from '@/features/issues/issue-columns'
import { IssueService } from '@/features/issues/issue-service'
import { issuesQueryKeys } from '@/features/issues/query-keys'
import { getMediaRequest, mediaListConfig } from '@/features/media/api'
import { mediaColumns } from '@/features/media/media-columns'
import { MediaService } from '@/features/media/media-service'
import { mediaQueryKeys } from '@/features/media/query-keys'
import { OrganizationService } from '@/features/organizations/organization-service'
import { OrganizationStatusBadge } from '@/features/organizations/OrganizationStatusBadge'
import { getProductsRequest, productsListConfig } from '@/features/products/api'
import { productColumns } from '@/features/products/product-columns'
import { ProductService } from '@/features/products/product-service'
import { productsQueryKeys } from '@/features/products/query-keys'
import { getStoresRequest, storesListConfig } from '@/features/stores/api'
import { storeColumns } from '@/features/stores/store-columns'
import { storesQueryKeys } from '@/features/stores/query-keys'
import { getUsersRequest, usersListConfig } from '@/features/users/api'
import { getUserListColumns } from '@/features/users/user-columns'
import { UserService } from '@/features/users/user-service'
import { usersQueryKeys } from '@/features/users/query-keys'
import { useConnect } from '@/features/app/use-connect'
import { batchListRequest } from '@/lib/batch-api'
import {
  createTableBatchCacheEntry,
  toBatchRequestDto,
  writeBatchEntriesToQueryCache,
  type BatchCacheEntry,
} from '@/lib/batch-query-cache'
import { useDetailQuery } from '@/lib/query-hooks'
import type { Contract } from '@/types/contract'
import type { Customer, Store } from '@/types/customer'
import type { Device } from '@/types/device'
import type { Issue } from '@/types/issue'
import type { Media } from '@/types/media'
import { OrganizationStatus } from '@/types/organization'
import type { Product } from '@/types/product'
import type { User } from '@/types/user'
import { TimezoneUtils } from '@/utils'
import { formatDateTime } from '@/utils/date-utils'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

const MODULE_ANCHOR_PREFIX = 'module'
const CUSTOMER_BATCH_QUERY_KEY = 'customer-detail-batch'

function getCustomerDetailSections(customer?: Customer, canEdit = false): DetailPanelSection[] {
  return [
    {
      title: 'Details',
      actions:
        customer && canEdit ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit customer details"
            onClick={() => CustomerService.showEditDrawer(customer)}
          >
            <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
          </Button>
        ) : null,
      fields: [
        {
          label: 'Status',
          value: customer ? (
            <OrganizationStatusBadge
              status={customer.status}
              isDeleted={customer.isDeleted}
              isArchived={customer.isArchived}
            />
          ) : (
            NO_VALUE_STR
          ),
        },
        { label: 'ID', value: customer?.id ?? NO_VALUE_STR },
        { label: 'Contact name', value: customer?.contactName ?? NO_VALUE_STR },
        { label: 'Contact email', value: customer?.contactEmail ?? NO_VALUE_STR },
        { label: 'Contact phone', value: customer?.contactPhone ?? NO_VALUE_STR },
        { label: 'Account email', value: customer?.email ?? NO_VALUE_STR },
        { label: 'Phone', value: customer?.phone ?? NO_VALUE_STR },
        { label: 'Timezone', value: TimezoneUtils.getTimezoneLabel(customer?.timezone) || NO_VALUE_STR },
        {
          label: 'Created at',
          value: customer?.createdAt ? formatDateTime(customer.createdAt, NO_VALUE_STR) : NO_VALUE_STR,
        },
      ],
    },
  ]
}

function makeViewAllTo(path: string, customer: Customer) {
  const params = new URLSearchParams({ 'f.customerId': customer.id })
  return `${path}?${params.toString()}`
}

function getBatchListTotal(data: Record<string, unknown> | undefined, key: string) {
  const result = data?.[key]

  if (!result || typeof result !== 'object') return undefined

  const total = (result as { total?: unknown }).total
  return typeof total === 'number' ? total : undefined
}

function CustomerModulesLoading({ modules }: { modules: { key: string; label: string }[] }) {
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

function CustomerModulesError({ modules }: { modules: { key: string; label: string }[] }) {
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

function CustomerModuleError({ module }: { module: { key: string; label: string } }) {
  return (
    <EmptyRelatedEntityModule
      id={`${MODULE_ANCHOR_PREFIX}-${module.key}`}
      title={module.label}
      description="Failed to load."
    />
  )
}

export default function CustomerPage() {
  const { customerId = '' } = useParams()
  const { session } = useConnect()
  const queryClient = useQueryClient()
  const permissions = session?.permissions.customers
  const portal = getPortalSafe()
  const currentOrganizationId = session?.currentOrganization?.id ?? undefined
  const canEditUserPermissions = session?.permissions.users?.edit
  const canManageCustomer = CustomerService.canManage(permissions)
  const canShowUsers = canManageCustomer || portal === Portal.OPS
  const canEditCustomer = !permissions || permissions.edit
  const customerUsersHiddenFilters = useMemo(
    () => (portal === Portal.OPS ? { customerId, partnerId: currentOrganizationId } : { organizationId: customerId }),
    [currentOrganizationId, customerId, portal],
  )
  const batchEntries = useMemo<BatchCacheEntry[]>(() => {
    if (!customerId) return []

    const entries: BatchCacheEntry[] = [
      createTableBatchCacheEntry<Store>({
        key: 'stores',
        queryKey: [...storesQueryKeys.customer(customerId), 'module'],
        tableKey: 'customers.detail.modules.stores',
        pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
        url: storesListConfig.url,
        payload: (tableState) => storesListConfig.toPayload(tableState, { customerId }),
        map: storesListConfig.toResult,
      }),
      ...(canShowUsers
        ? [
            createTableBatchCacheEntry<User>({
              key: 'users',
              queryKey: [...usersQueryKeys.organization(customerId), 'module'],
              tableKey: 'customers.detail.modules.users',
              pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
              url: usersListConfig.url,
              payload: (tableState) => usersListConfig.toPayload(tableState, customerUsersHiddenFilters),
              map: usersListConfig.toResult,
            }),
          ]
        : []),
      createTableBatchCacheEntry<Contract>({
        key: 'contracts',
        queryKey: [...contractsQueryKeys.all, 'customer-module', customerId, canManageCustomer ? 'all' : 'active'],
        tableKey: 'customers.detail.modules.contracts',
        pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
        url: contractsListConfig.url,
        payload: (tableState) =>
          contractsListConfig.toPayload(tableState, {
            organizationId: customerId,
            ...(canManageCustomer ? {} : { status: OrganizationStatus.ACTIVE }),
          }),
        map: contractsListConfig.toResult,
      }),
      createTableBatchCacheEntry<Product>({
        key: 'products',
        queryKey: [...productsQueryKeys.all, 'customer-module', customerId],
        tableKey: 'customers.detail.modules.products',
        pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
        url: productsListConfig.url,
        payload: (tableState) => productsListConfig.toPayload(tableState, { customerId }),
        map: productsListConfig.toResult,
      }),
      createTableBatchCacheEntry<Device>({
        key: 'devices',
        queryKey: [...devicesQueryKeys.all, 'customer-module', customerId],
        tableKey: 'customers.detail.modules.devices',
        pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
        url: devicesListConfig.url,
        payload: (tableState) => devicesListConfig.toPayload(tableState, { customerId }),
        map: devicesListConfig.toResult,
      }),
      ...(canManageCustomer
        ? [
            createTableBatchCacheEntry<Media>({
              key: 'media',
              queryKey: [...mediaQueryKeys.all, 'customer-module', customerId],
              tableKey: 'customers.detail.modules.media',
              pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
              url: mediaListConfig.url,
              payload: (tableState) => mediaListConfig.toPayload(tableState, { customerId }),
              map: mediaListConfig.toResult,
            }),
          ]
        : []),
      createTableBatchCacheEntry<Issue>({
        key: 'issues',
        queryKey: [...issuesQueryKeys.all, 'customer-module', customerId],
        tableKey: 'customers.detail.modules.issues',
        pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
        url: issuesListConfig.url,
        payload: (tableState) => issuesListConfig.toPayload(tableState, { customerId }),
        map: issuesListConfig.toResult,
      }),
    ]

    return entries
  }, [canManageCustomer, canShowUsers, customerId, customerUsersHiddenFilters])
  const detailQuery = useDetailQuery({
    queryKey: customersQueryKeys.detail(customerId),
    queryFn: () => getCustomerRequest(customerId),
    enabled: Boolean(customerId),
  })
  const customer = detailQuery.data
  const customerBatchQuery = useQuery({
    queryKey: [CUSTOMER_BATCH_QUERY_KEY, customerId, canManageCustomer, canShowUsers, currentOrganizationId, portal],
    queryFn: async () => {
      const data = await batchListRequest(toBatchRequestDto(batchEntries))
      const failedKeys = writeBatchEntriesToQueryCache({ data, entries: batchEntries, queryClient })

      return { data, failedKeys }
    },
    enabled: Boolean(customerId) && Boolean(session) && Boolean(customer),
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const isLoadingCustomer = detailQuery.isLoading
  const areModulesLoading =
    !session || customerBatchQuery.isFetching || (!customerBatchQuery.isSuccess && !customerBatchQuery.isError)
  const areModulesErrored = Boolean(session) && customerBatchQuery.isError
  const failedModuleKeys = new Set(customerBatchQuery.data?.failedKeys ?? [])
  const batchData = customerBatchQuery.data?.data
  const isError = detailQuery.isError

  const detailModules = useMemo(
    () => [
      { key: 'stores', label: 'Stores' },
      ...(canShowUsers ? [{ key: 'users', label: 'Users' }] : []),
      { key: 'contracts', label: canManageCustomer ? 'Contracts' : 'Active contracts' },
      { key: 'products', label: 'Products' },
      { key: 'devices', label: 'Devices' },
      ...(canManageCustomer
        ? [
            { key: 'media', label: 'Media' },
            { key: 'mediaCampaigns', label: 'Media campaigns' },
            { key: 'partners', label: 'Maintenance partners' },
          ]
        : []),
      { key: 'issues', label: 'Issues' },
    ],
    [canManageCustomer, canShowUsers],
  )

  if (isLoadingCustomer) {
    return (
      <>
        <PageHeader title="Customer name" subtitle="Loading..." backTo="/customers" />
        <DetailPageLayout aside={<DetailSidePanel sections={getCustomerDetailSections()} isLoading />}>
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading customer...
          </div>
        </DetailPageLayout>
      </>
    )
  }

  if (isError || !customer) {
    return (
      <>
        <PageHeader title="Customer not found" subtitle={customerId} backTo="/customers" />
        <section className="p-4 md:p-6">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Failed to load this customer.
          </div>
        </section>
      </>
    )
  }

  const headerActions = CustomerService.getDetailHeaderActions(customer, permissions)
  const getInitialTotal = (key: string, fallback?: number) => getBatchListTotal(batchData, key) ?? fallback ?? 0

  return (
    <>
      <DetailPageLayout
        header={{
          title: customer.name,
          subtitle: customer.contactEmail ?? undefined,
          backTo: '/customers',
          primaryAction: headerActions.primaryAction,
          secondaryAction: headerActions.secondaryAction,
          options: headerActions.options,
        }}
        modules={detailModules}
        aside={<DetailSidePanel sections={getCustomerDetailSections(customer, canEditCustomer)} />}
      >
        {areModulesLoading ? <CustomerModulesLoading modules={detailModules} /> : null}
        {areModulesErrored ? <CustomerModulesError modules={detailModules} /> : null}
        {!areModulesLoading && !areModulesErrored ? (
          <>
            {failedModuleKeys.has('stores') ? (
              <CustomerModuleError module={{ key: 'stores', label: 'Stores' }} />
            ) : (
              <RelatedEntityModule
                id={`${MODULE_ANCHOR_PREFIX}-stores`}
                title="Stores"
                icon={EntityIcon.stores}
                initialTotal={getInitialTotal('stores', customer.stores)}
                viewAllTo={makeViewAllTo('/stores', customer)}
                action={CustomerService.getModuleAction(customer, 'stores', permissions)}
                queryKey={[...storesQueryKeys.customer(customer.id), 'module']}
                loadData={(state: DataTableState<Store>) => getStoresRequest(state, { customerId: customer.id })}
                tableKey="customers.detail.modules.stores"
                columns={storeColumns}
                getRowCommands={(store) => OrganizationService.getActions({ kind: 'store', organization: store })}
                loadingMessage="Loading stores..."
                emptyMessage="No stores found."
                refetchOnMount={false}
              />
            )}
            {canShowUsers ? (
              failedModuleKeys.has('users') ? (
                <CustomerModuleError module={{ key: 'users', label: 'Users' }} />
              ) : (
                <RelatedEntityModule
                  id={`${MODULE_ANCHOR_PREFIX}-users`}
                  title="Users"
                  icon={EntityIcon.users}
                  initialTotal={getInitialTotal('users', customer.users)}
                  viewAllTo={makeViewAllTo('/users', customer)}
                  action={
                    canManageCustomer ? CustomerService.getModuleAction(customer, 'users', permissions) : undefined
                  }
                  queryKey={[...usersQueryKeys.organization(customer.id), 'module']}
                  loadData={(state: DataTableState<User>) =>
                    getUsersRequest(
                      state,
                      portal === Portal.OPS
                        ? { customerId: customer.id, partnerId: currentOrganizationId }
                        : { organizationId: customer.id },
                    )
                  }
                  tableKey="customers.detail.modules.users"
                  columns={getUserListColumns({
                    usage: 'customer-details',
                    portal,
                    customerId: customer.id,
                    partnerId: portal === Portal.OPS ? currentOrganizationId : undefined,
                    canEditPermissions: canEditUserPermissions,
                  })}
                  getRowCommands={(user) => UserService.getActions(user, session?.permissions.users)}
                  loadingMessage="Loading users..."
                  emptyMessage="No users found."
                  refetchOnMount={false}
                />
              )
            ) : null}
            {failedModuleKeys.has('contracts') ? (
              <CustomerModuleError
                module={{ key: 'contracts', label: canManageCustomer ? 'Contracts' : 'Active contracts' }}
              />
            ) : (
              <RelatedEntityModule
                id={`${MODULE_ANCHOR_PREFIX}-contracts`}
                title={canManageCustomer ? 'Contracts' : 'Active contracts'}
                icon={EntityIcon.contracts}
                initialTotal={getInitialTotal('contracts')}
                viewAllTo={makeViewAllTo('/contracts', customer)}
                action={CustomerService.getModuleAction(customer, 'contracts', permissions)}
                queryKey={[
                  ...contractsQueryKeys.all,
                  'customer-module',
                  customer.id,
                  canManageCustomer ? 'all' : 'active',
                ]}
                loadData={(state: DataTableState<Contract>) =>
                  getContractsRequest(state, {
                    organizationId: customer.id,
                    ...(canManageCustomer ? {} : { status: OrganizationStatus.ACTIVE }),
                  })
                }
                tableKey="customers.detail.modules.contracts"
                columns={contractColumns}
                getRowCommands={(contract) => ContractService.getActions(contract)}
                loadingMessage="Loading contracts..."
                emptyMessage="No contracts found."
                refetchOnMount={false}
              />
            )}
            {failedModuleKeys.has('products') ? (
              <CustomerModuleError module={{ key: 'products', label: 'Products' }} />
            ) : (
              <RelatedEntityModule
                id={`${MODULE_ANCHOR_PREFIX}-products`}
                title="Products"
                icon={EntityIcon.products}
                initialTotal={getInitialTotal('products')}
                viewAllTo={makeViewAllTo('/products', customer)}
                action={CustomerService.getModuleAction(customer, 'products', permissions)}
                queryKey={[...productsQueryKeys.all, 'customer-module', customer.id]}
                loadData={(state: DataTableState<Product>) => getProductsRequest(state, { customerId: customer.id })}
                tableKey="customers.detail.modules.products"
                columns={productColumns}
                getRowCommands={(product) => ProductService.getActions(product)}
                loadingMessage="Loading products..."
                emptyMessage="No products found."
                refetchOnMount={false}
              />
            )}
            {failedModuleKeys.has('devices') ? (
              <CustomerModuleError module={{ key: 'devices', label: 'Devices' }} />
            ) : (
              <RelatedEntityModule
                id={`${MODULE_ANCHOR_PREFIX}-devices`}
                title="Devices"
                icon={EntityIcon.devices}
                initialTotal={getInitialTotal('devices')}
                viewAllTo={makeViewAllTo('/devices', customer)}
                action={CustomerService.getModuleAction(customer, 'devices', permissions)}
                queryKey={[...devicesQueryKeys.all, 'customer-module', customer.id]}
                loadData={(state: DataTableState<Device>) => getDevicesRequest(state, { customerId: customer.id })}
                tableKey="customers.detail.modules.devices"
                columns={deviceColumns}
                getRowCommands={(device) => DeviceService.getActions(device)}
                loadingMessage="Loading devices..."
                emptyMessage="No devices found."
                refetchOnMount={false}
              />
            )}
            {canManageCustomer ? (
              <>
                {failedModuleKeys.has('media') ? (
                  <CustomerModuleError module={{ key: 'media', label: 'Media' }} />
                ) : (
                  <RelatedEntityModule
                    id={`${MODULE_ANCHOR_PREFIX}-media`}
                    title="Media"
                    icon={EntityIcon.media}
                    initialTotal={getInitialTotal('media')}
                    viewAllTo={makeViewAllTo('/media', customer)}
                    action={CustomerService.getModuleAction(customer, 'media', permissions)}
                    queryKey={[...mediaQueryKeys.all, 'customer-module', customer.id]}
                    loadData={(state: DataTableState<Media>) => getMediaRequest(state, { customerId: customer.id })}
                    tableKey="customers.detail.modules.media"
                    columns={mediaColumns}
                    getRowCommands={(media) => MediaService.getMediaActions(media)}
                    loadingMessage="Loading media..."
                    emptyMessage="No media found."
                    refetchOnMount={false}
                  />
                )}
                <EmptyRelatedEntityModule
                  id={`${MODULE_ANCHOR_PREFIX}-mediaCampaigns`}
                  title="Media campaigns"
                  icon={EntityIcon.mediaCampaigns}
                  action={CustomerService.getModuleAction(customer, 'mediaCampaigns', permissions)}
                  description="Media campaign preview is not connected yet."
                />
                <EmptyRelatedEntityModule
                  id={`${MODULE_ANCHOR_PREFIX}-partners`}
                  title="Maintenance partners"
                  icon={EntityIcon.partners}
                  action={CustomerService.getModuleAction(customer, 'partners', permissions)}
                  description="Maintenance partner preview is not connected yet."
                />
              </>
            ) : null}
            {failedModuleKeys.has('issues') ? (
              <CustomerModuleError module={{ key: 'issues', label: 'Issues' }} />
            ) : (
              <RelatedEntityModule
                id={`${MODULE_ANCHOR_PREFIX}-issues`}
                title="Issues"
                icon={EntityIcon.issues}
                initialTotal={getInitialTotal('issues')}
                viewAllTo={makeViewAllTo('/issues', customer)}
                action={CustomerService.getModuleAction(customer, 'issues', permissions)}
                queryKey={[...issuesQueryKeys.all, 'customer-module', customer.id]}
                loadData={(state: DataTableState<Issue>) => getIssuesRequest(state, { customerId: customer.id })}
                tableKey="customers.detail.modules.issues"
                columns={issueColumns}
                getRowCommands={(issue) => IssueService.getActions(issue)}
                loadingMessage="Loading issues..."
                emptyMessage="No issues found."
                refetchOnMount={false}
              />
            )}
          </>
        ) : null}
      </DetailPageLayout>
    </>
  )
}
