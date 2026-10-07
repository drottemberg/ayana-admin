import { useMemo, useState } from 'react'
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

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
import { OrganizationStatusBadge } from '@/features/organizations/OrganizationStatusBadge'
import { getProductsRequest, productsListConfig } from '@/features/products/api'
import { getProductColumns } from '@/features/products/product-columns'
import { ProductManagementService } from '@/features/products/product-management-service'
import { ProductScopeDrawer } from '@/features/products/ProductScopeDrawer'
import { ProductEditDrawer } from '@/features/products/ProductEditDrawer'
import { productsQueryKeys } from '@/features/products/query-keys'
import { getLocationsRequest, locationsListConfig } from '@/features/locations/api'
import { locationColumns } from '@/features/locations/location-columns'
import { LocationService } from '@/features/locations/location-service'
import { locationsQueryKeys } from '@/features/locations/query-keys'
import { getUsersRequest, usersListConfig } from '@/features/users/api'
import { getUserListColumns } from '@/features/users/user-columns'
import { UserService } from '@/features/users/user-service'
import { usersQueryKeys } from '@/features/users/query-keys'
import { getPricingOptionsRequest } from '@/features/pricing-options/api'
import { pricingOptionsQueryKeys } from '@/features/pricing-options/query-keys'
import { getPricingOptionColumns } from '@/features/pricing-options/pricing-option-columns'
import { PricingOptionService } from '@/features/pricing-options/pricing-option-service'
import { CreatePricingOptionDialog } from '@/features/pricing-options/CreatePricingOptionDialog'
import { classSessionsListConfig, classTypesListConfig, getClassTypesRequest, getClassSessionsRequest } from '@/features/classes/api'
import { getClassSessionColumns } from '@/features/classes/class-session-columns'
import { getClassTypeColumns } from '@/features/classes/class-type-columns'
import { ClassTypeService } from '@/features/classes/class-type-service'
import { ClassTypeEditDrawer } from '@/features/classes/ClassTypeEditDrawer'
import { classTypesQueryKeys } from '@/features/classes/query-keys'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import { useConnect } from '@/features/app/use-connect'
import { Drawer, DrawerId } from '@/providers/drawer'
import { batchListRequest } from '@/lib/batch-api'
import {
  createTableBatchCacheEntry,
  toBatchRequestDto,
  writeBatchEntriesToQueryCache,
  type BatchCacheEntry,
} from '@/lib/batch-query-cache'
import { useDetailQuery } from '@/lib/query-hooks'
import type { Customer } from '@/types/customer'
import type { Device } from '@/types/device'
import type { Location } from '@/types/location'
import type { Issue } from '@/types/issue'
import type { Product } from '@/types/product'
import type { PricingOption } from '@/types/pricing-option'
import type { ClassType } from '@/types/class-type'
import type { ClassSession } from '@/types/class-type'
import type { User } from '@/types/user'
import { TimezoneUtils } from '@/utils'
import { formatDateTime } from '@/utils/date-utils'
import { formatPhoneNumber } from '@/lib/phone'
import { getClientContractsRequest } from '@/features/client-contracts/api'
import { getClientContractColumns } from '@/features/client-contracts/client-contract-columns'
import { ClientContractService } from '@/features/client-contracts/client-contract-service'
import { clientContractsQueryKeys } from '@/features/client-contracts/query-keys'
import type { ClientContract } from '@/types/client-contract'
import { getOrdersRequest } from '@/features/orders/api'
import { getOrderColumns } from '@/features/orders/order-columns'
import { OrderService } from '@/features/orders/order-service'
import { ordersQueryKeys } from '@/features/orders/query-keys'
import type { Order } from '@/types/order'

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
        { label: 'Contact phone', value: formatPhoneNumber(customer?.contactPhone) || NO_VALUE_STR },
        { label: 'Account email', value: customer?.email ?? NO_VALUE_STR },
        { label: 'Phone', value: formatPhoneNumber(customer?.phone) || NO_VALUE_STR },
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

function makePricingOptionsViewAllTo(customer: Customer) {
  return `/pricing-options?${new URLSearchParams({ filterCustomerId: customer.id }).toString()}`
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
  const navigate = useNavigate()
  const [isCreatePricingOptionOpen, setIsCreatePricingOptionOpen] = useState(false)
  const [editingPricingOption, setEditingPricingOption] = useState<PricingOption | null>(null)
  const [editingClassType, setEditingClassType] = useState<ClassType | null>(null)
  const [editingProductScope, setEditingProductScope] = useState<Product | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const { session } = useConnect()
  const queryClient = useQueryClient()
  const permissions = session?.permissions.customers
  const canEditUserPermissions = session?.permissions.users?.edit
  const canManageCustomer = CustomerService.canManage(permissions)
  const canShowUsers = canManageCustomer
  const canEditCustomer = !permissions || permissions.edit
  const customerUsersHiddenFilters = useMemo(() => ({ organizationId: customerId }), [customerId])
  const batchEntries = useMemo<BatchCacheEntry[]>(() => {
    if (!customerId) return []

    const entries: BatchCacheEntry[] = [
      createTableBatchCacheEntry<Location>({
        key: 'locations',
        queryKey: [...locationsQueryKeys.customer(customerId), 'module'],
        tableKey: 'customers.detail.modules.locations',
        pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
        url: locationsListConfig.url,
        payload: (tableState) => locationsListConfig.toPayload(tableState, { customerId }),
        map: locationsListConfig.toResult,
      }),
      ...(canManageCustomer
        ? [
            createTableBatchCacheEntry<ClassType>({
              key: 'classes',
              queryKey: [...classTypesQueryKeys.customer(customerId), 'module'],
              tableKey: 'customers.detail.modules.classes',
              pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
              url: classTypesListConfig.url,
              payload: (tableState) => classTypesListConfig.toPayload(tableState, { customerId }),
              map: classTypesListConfig.toResult,
            }),
            createTableBatchCacheEntry<ClassSession>({
              key: 'class-sessions',
              queryKey: [...classSessionsQueryKeys.all, 'customer-module', customerId],
              tableKey: 'customers.detail.modules.class-sessions',
              pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
              url: classSessionsListConfig.url,
              payload: (tableState) => classSessionsListConfig.toPayload(tableState, { customerId }),
              map: classSessionsListConfig.toResult,
            }),
          ]
        : []),
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
    queryKey: [CUSTOMER_BATCH_QUERY_KEY, customerId, canManageCustomer, canShowUsers],
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
      { key: 'locations', label: 'Locations' },
      ...(canShowUsers ? [{ key: 'users', label: 'Users' }] : []),
      ...(canManageCustomer ? [{ key: 'pricing-options', label: 'Pricing options' }] : []),
      ...(canManageCustomer ? [{ key: 'classes', label: 'Classes' }] : []),
      ...(canManageCustomer ? [{ key: 'class-sessions', label: 'Class sessions' }] : []),
      ...(canManageCustomer ? [{ key: 'client-contracts', label: 'Client contracts' }, { key: 'orders', label: 'Orders' }] : []),
      { key: 'products', label: 'Products' },
      { key: 'devices', label: 'Devices' },
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
          primaryAction: canManageCustomer
            ? { children: 'Message contacts', onClick: () => navigate(`/messages?customerId=${encodeURIComponent(customer.id)}`) }
            : headerActions.primaryAction,
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
            {failedModuleKeys.has('locations') ? (
              <CustomerModuleError module={{ key: 'locations', label: 'Locations' }} />
            ) : (
              <RelatedEntityModule
                id={`${MODULE_ANCHOR_PREFIX}-locations`}
                title="Locations"
                icon={EntityIcon.locations}
                initialTotal={getInitialTotal('locations', customer.locations)}
                viewAllTo={makeViewAllTo('/locations', customer)}
                action={
                  canManageCustomer
                    ? {
                        label: 'Add location',
                        onClick: () => Drawer.show(DrawerId.CreateLocation, { customerId: customer.id }),
                      }
                    : undefined
                }
                queryKey={[...locationsQueryKeys.customer(customer.id), 'module']}
                loadData={(state: DataTableState<Location>) => getLocationsRequest(state, { customerId: customer.id })}
                tableKey="customers.detail.modules.locations"
                columns={locationColumns}
                getRowCommands={(location) =>
                  LocationService.getRowActions(location, {
                    edit: Boolean(permissions?.edit),
                    manageStatus: Boolean(permissions?.edit),
                    delete: Boolean(permissions?.delete),
                  })
                }
                loadingMessage="Loading locations..."
                emptyMessage="No locations found."
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
                  loadData={(state: DataTableState<User>) => getUsersRequest(state, { organizationId: customer.id })}
                  tableKey="customers.detail.modules.users"
                  columns={getUserListColumns({
                    usage: 'customer-details',
                    customerId: customer.id,
                    canEditPermissions: canEditUserPermissions,
                  })}
                  getRowCommands={(user) => UserService.getActions(user, session?.permissions.users)}
                  loadingMessage="Loading users..."
                  emptyMessage="No users found."
                  refetchOnMount={false}
                />
              )
            ) : null}
            {canManageCustomer ? (
              <RelatedEntityModule
                id={`${MODULE_ANCHOR_PREFIX}-pricing-options`}
                title="Pricing options"
                icon={EntityIcon.pricingOptions}
                viewAllTo={makePricingOptionsViewAllTo(customer)}
                action={{ label: 'Add pricing option', onClick: () => setIsCreatePricingOptionOpen(true) }}
                queryKey={pricingOptionsQueryKeys.customer(customer.id)}
                loadData={(state: DataTableState<PricingOption>) => getPricingOptionsRequest(state, { customerId: customer.id })}
                tableKey="customers.detail.modules.pricing-options"
                columns={getPricingOptionColumns()}
                getRowCommands={(option) => PricingOptionService.getRowActions(option, {
                  canEdit: Boolean(session?.permissions.customers?.edit),
                  canDelete: Boolean(session?.permissions.customers?.delete),
                  onEdit: (selectedOption) => {
                    setEditingPricingOption(selectedOption)
                    setIsCreatePricingOptionOpen(true)
                  },
                })}
                emptyMessage="No pricing options found."
                loadingMessage="Loading pricing options..."
                refetchOnMount={false}
              />
            ) : null}
            {canManageCustomer ? (
              failedModuleKeys.has('classes') ? (
                <CustomerModuleError module={{ key: 'classes', label: 'Classes' }} />
              ) : (
                <RelatedEntityModule
                  id={`${MODULE_ANCHOR_PREFIX}-classes`}
                  title="Classes"
                  icon={EntityIcon.classes}
                  viewAllTo={`/classes?${new URLSearchParams({ filterCustomerId: customer.id }).toString()}`}
                  queryKey={[...classTypesQueryKeys.customer(customer.id), 'module']}
                  loadData={(state: DataTableState<ClassType>) => getClassTypesRequest(state, { customerId: customer.id })}
                  tableKey="customers.detail.modules.classes"
                  columns={getClassTypeColumns({ showLocation: true })}
                  getRowCommands={(classType) => ClassTypeService.getRowActions(classType, {
                    canEdit: Boolean(session?.permissions.customers?.edit),
                    onEdit: setEditingClassType,
                  })}
                  loadingMessage="Loading classes..."
                  emptyMessage="No classes found."
                  refetchOnMount={false}
                />
              )
            ) : null}
            {canManageCustomer ? (
              failedModuleKeys.has('class-sessions') ? (
                <CustomerModuleError module={{ key: 'class-sessions', label: 'Class sessions' }} />
              ) : (
                <RelatedEntityModule
                  id={`${MODULE_ANCHOR_PREFIX}-class-sessions`}
                  title="Class sessions"
                  icon={EntityIcon.classes}
                  initialTotal={getInitialTotal('class-sessions')}
                  viewAllTo={`/class-sessions?${new URLSearchParams({ filterCustomerId: customer.id }).toString()}`}
                  queryKey={[...classSessionsQueryKeys.all, 'customer-module', customer.id]}
                  loadData={(state: DataTableState<ClassSession>) => getClassSessionsRequest(state, { customerId: customer.id })}
                  tableKey="customers.detail.modules.class-sessions"
                  columns={getClassSessionColumns({ showLocation: true })}
                  loadingMessage="Loading class sessions..."
                  emptyMessage="No class sessions found."
                  refetchOnMount={false}
                />
              )
            ) : null}
            {canManageCustomer ? (
              <RelatedEntityModule
                id={`${MODULE_ANCHOR_PREFIX}-client-contracts`}
                title="Client contracts"
                icon={EntityIcon.clientContracts}
                viewAllTo={`/client-contracts?${new URLSearchParams({ filterCustomerId: customer.id }).toString()}`}
                queryKey={clientContractsQueryKeys.customer(customer.id)}
                loadData={(state: DataTableState<ClientContract>) => getClientContractsRequest(state, { customerId: customer.id })}
                tableKey="customers.detail.modules.client-contracts"
                columns={getClientContractColumns({ showCustomer: false })}
                getRowCommands={(contract) => ClientContractService.getRowActions(contract, Boolean(permissions?.edit))}
                loadingMessage="Loading client contracts..."
                emptyMessage="No client contracts found."
                refetchOnMount={false}
              />
            ) : null}
            {canManageCustomer ? (
              <RelatedEntityModule
                id={`${MODULE_ANCHOR_PREFIX}-orders`}
                title="Orders"
                icon={EntityIcon.orders}
                viewAllTo={`/orders?${new URLSearchParams({ filterCustomerId: customer.id }).toString()}`}
                queryKey={ordersQueryKeys.customer(customer.id)}
                loadData={(state: DataTableState<Order>) => getOrdersRequest(state, { customerId: customer.id })}
                tableKey="customers.detail.modules.orders"
                columns={getOrderColumns({ showCustomer: false })}
                getRowCommands={(order) => OrderService.getRowActions(order, Boolean(permissions?.edit))}
                loadingMessage="Loading orders..."
                emptyMessage="No orders found."
                refetchOnMount={false}
              />
            ) : null}
            {failedModuleKeys.has('products') ? (
              <CustomerModuleError module={{ key: 'products', label: 'Products' }} />
            ) : (
              <RelatedEntityModule
                id={`${MODULE_ANCHOR_PREFIX}-products`}
                title="Products"
                icon={EntityIcon.products}
                initialTotal={getInitialTotal('products')}
                viewAllTo={makeViewAllTo('/products', customer)}
                queryKey={[...productsQueryKeys.all, 'customer-module', customer.id]}
                loadData={(state: DataTableState<Product>) => getProductsRequest(state, { customerId: customer.id })}
                tableKey="customers.detail.modules.products"
                columns={getProductColumns({ showCustomer: false })}
                getRowCommands={(product) => ProductManagementService.getRowActions(product, {
                  canEdit: Boolean(permissions?.edit),
                  onEdit: setEditingProduct,
                  onEditScope: setEditingProductScope,
                })}
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
      <CreatePricingOptionDialog
        customerId={editingPricingOption?.organizationId ?? customer.id}
        currency={customer.currency ?? 'EUR'}
        option={editingPricingOption ?? undefined}
        open={isCreatePricingOptionOpen}
        onOpenChange={(open) => {
          setIsCreatePricingOptionOpen(open)
          if (!open) setEditingPricingOption(null)
        }}
      />
      <ClassTypeEditDrawer
        classType={editingClassType}
        open={Boolean(editingClassType)}
        onOpenChange={(open) => { if (!open) setEditingClassType(null) }}
      />
      <ProductScopeDrawer
        product={editingProductScope}
        open={Boolean(editingProductScope)}
        onOpenChange={(open) => { if (!open) setEditingProductScope(null) }}
      />
      <ProductEditDrawer
        product={editingProduct}
        open={Boolean(editingProduct)}
        onOpenChange={(open) => { if (!open) setEditingProduct(null) }}
      />
    </>
  )
}
