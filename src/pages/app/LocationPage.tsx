import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  DetailPageLayout,
  DetailSidePanel,
  RelatedEntityModule,
  type DetailPanelSection,
} from '@/components/app/detail-page-layout'
import { PageHeader } from '@/components/ui/page-header'
import { useDetailQuery } from '@/lib/query-hooks'
import { getLocationRequest } from '@/features/locations/api'
import { locationsQueryKeys } from '@/features/locations/query-keys'
import { OrganizationStatusBadge } from '@/features/organizations/OrganizationStatusBadge'
import { formatPhoneNumber } from '@/lib/phone'
import { NO_VALUE_STR } from '@/constants'
import type { Location } from '@/types/location'
import { StringUtils, TimezoneUtils } from '@/utils'
import { formatDateTime } from '@/utils/date-utils'
import type { DataTableState } from '@/components/data-table'
import { getPricingOptionsRequest } from '@/features/pricing-options/api'
import { getPricingOptionColumns } from '@/features/pricing-options/pricing-option-columns'
import { pricingOptionsQueryKeys } from '@/features/pricing-options/query-keys'
import type { PricingOption } from '@/types/pricing-option'
import { getClassTypesRequest, getClassSessionsRequest } from '@/features/classes/api'
import { getClassSessionColumns } from '@/features/classes/class-session-columns'
import { getClassTypeColumns } from '@/features/classes/class-type-columns'
import { classSessionsQueryKeys, classTypesQueryKeys } from '@/features/classes/query-keys'
import type { ClassSession, ClassType } from '@/types/class-type'
import { EntityIcon } from '@/components/app/entity-icons'
import { ClassTypeService } from '@/features/classes/class-type-service'
import { ClassTypeEditDrawer } from '@/features/classes/ClassTypeEditDrawer'
import { useConnect } from '@/features/app/use-connect'
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
import { getProductLocationSettingsRequest, productLocationQueryKeys, type ProductLocationSettings } from '@/features/products/location-products'
import { getLocationProductColumns } from '@/features/products/location-product-columns'
import { ProductLocationSettingsDrawer } from '@/features/products/ProductLocationSettingsDrawer'

function getSections(location?: Location): DetailPanelSection[] {
  return [
    {
      title: 'Details',
      fields: [
        {
          label: 'Status',
          value: location ? (
            <OrganizationStatusBadge
              status={location.status}
              isDeleted={location.isDeleted}
              isArchived={location.isArchived}
            />
          ) : (
            NO_VALUE_STR
          ),
        },
        { label: 'ID', value: location?.id ?? NO_VALUE_STR },
        {
          label: 'Customer',
          value: location?.customerName && location.parentId
            ? <Link to={`/customers/${location.parentId}`} className="underline-offset-2 hover:underline">{location.customerName}</Link>
            : location?.customerName ?? location?.parentId ?? NO_VALUE_STR,
        },
        {
          label: 'Address',
          value: location?.address ? StringUtils.displayAddress(location.address) : NO_VALUE_STR,
        },
        { label: 'Phone', value: formatPhoneNumber(location?.phone) || NO_VALUE_STR },
        { label: 'Email', value: location?.email ?? NO_VALUE_STR },
        { label: 'Contact name', value: location?.contactName ?? NO_VALUE_STR },
        { label: 'Contact phone', value: formatPhoneNumber(location?.contactPhone) || NO_VALUE_STR },
        { label: 'Contact email', value: location?.contactEmail ?? NO_VALUE_STR },
        { label: 'Timezone', value: TimezoneUtils.getTimezoneLabel(location?.timezone) || NO_VALUE_STR },
        { label: 'Currency', value: location?.currency ?? NO_VALUE_STR },
        {
          label: 'Created at',
          value: location?.createdAt ? formatDateTime(location.createdAt, NO_VALUE_STR) : NO_VALUE_STR,
        },
      ],
    },
  ]
}

export default function LocationPage() {
  const { locationId = '' } = useParams()
  const [editingClassType, setEditingClassType] = useState<ClassType | null>(null)
  const [editingProduct, setEditingProduct] = useState<ProductLocationSettings | null>(null)
  const { session } = useConnect()
  const canManageOrdersAndContracts = Boolean(session?.permissions.customers?.edit)
  const modules = useMemo(() => [
    { key: 'pricing-options', label: 'Pricing options' },
    { key: 'classes', label: 'Classes' },
    { key: 'class-sessions', label: 'Class sessions' },
    ...(canManageOrdersAndContracts ? [{ key: 'products', label: 'Products' }] : []),
    ...(canManageOrdersAndContracts
      ? [{ key: 'client-contracts', label: 'Client contracts' }, { key: 'orders', label: 'Orders' }]
      : []),
  ], [canManageOrdersAndContracts])
  const {
    data: location,
    isError,
    isLoading,
  } = useDetailQuery({
    queryKey: locationsQueryKeys.detail(locationId),
    queryFn: () => getLocationRequest(locationId),
    enabled: Boolean(locationId),
  })

  if (isError || (!isLoading && !location)) {
    return (
      <>
        <PageHeader title="Location not found" subtitle={locationId} backTo="/locations" />
        <section className="p-4 md:p-6">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Failed to load this location.
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <DetailPageLayout
        header={{
          title: location?.name ?? 'Location',
          subtitle: isLoading ? 'Loading...' : locationId,
          backTo: '/locations',
        }}
        modules={modules}
        aside={<DetailSidePanel sections={getSections(location)} isLoading={isLoading} />}
      >
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          {isLoading ? 'Loading location...' : location?.description || 'No description.'}
        </div>
        <RelatedEntityModule
          id="module-pricing-options"
          title="Pricing options"
          icon={EntityIcon.pricingOptions}
          queryKey={pricingOptionsQueryKeys.location(locationId)}
          loadData={(state: DataTableState<PricingOption>) => getPricingOptionsRequest(state, { locationId })}
          tableKey="locations.detail.modules.pricing-options"
          columns={getPricingOptionColumns({ showScope: false, locationScoped: true })}
          loadingMessage="Loading pricing options..."
          emptyMessage="No pricing options available for this location."
        />
        <RelatedEntityModule
          id="module-classes"
          title="Classes"
          icon={EntityIcon.classes}
          viewAllTo={`/classes?${new URLSearchParams({ filterLocationId: locationId }).toString()}`}
          queryKey={classTypesQueryKeys.location(locationId)}
          loadData={(state: DataTableState<ClassType>) => getClassTypesRequest(state, { locationId })}
          tableKey="locations.detail.modules.classes"
          columns={getClassTypeColumns()}
          getRowCommands={(classType) => ClassTypeService.getRowActions(classType, {
            canEdit: Boolean(session?.permissions.customers?.edit),
            onEdit: setEditingClassType,
          })}
          loadingMessage="Loading classes..."
          emptyMessage="No classes configured for this location."
        />
        <RelatedEntityModule
          id="module-class-sessions"
          title="Class sessions"
          icon={EntityIcon.classes}
          viewAllTo={`/class-sessions?${new URLSearchParams({ filterLocationId: locationId }).toString()}`}
          queryKey={classSessionsQueryKeys.location(locationId)}
          loadData={(state: DataTableState<ClassSession>) => getClassSessionsRequest(state, { locationId })}
          tableKey={`locations.detail.modules.class-sessions.${locationId}`}
          columns={getClassSessionColumns()}
          loadingMessage="Loading class sessions..."
          emptyMessage="No class sessions found for this location."
        />
        {canManageOrdersAndContracts ? <RelatedEntityModule
          id="module-products"
          title="Products"
          icon={EntityIcon.products}
          queryKey={productLocationQueryKeys.location(locationId)}
          loadData={(state: DataTableState<ProductLocationSettings>) => getProductLocationSettingsRequest(locationId, state, location?.parentId)}
          tableKey={`locations.detail.modules.products.${locationId}`}
          columns={getLocationProductColumns(location?.currency)}
          getRowCommands={(product) => [{ label: 'Edit location settings', onClick: () => setEditingProduct(product) }]}
          loadingMessage="Loading products..."
          emptyMessage="No products configured for this customer."
        /> : null}
        {canManageOrdersAndContracts ? <RelatedEntityModule
          id="module-client-contracts"
          title="Client contracts"
          icon={EntityIcon.clientContracts}
          viewAllTo={`/client-contracts?${new URLSearchParams({ filterLocationId: locationId }).toString()}`}
          queryKey={clientContractsQueryKeys.location(locationId)}
          loadData={(state: DataTableState<ClientContract>) => getClientContractsRequest(state, { locationId })}
          tableKey={`locations.detail.modules.client-contracts.${locationId}`}
          columns={getClientContractColumns({ showLocation: false })}
          getRowCommands={(contract) => ClientContractService.getRowActions(contract, Boolean(session?.permissions.customers?.edit))}
          loadingMessage="Loading client contracts..."
          emptyMessage="No client contracts found for this location."
        /> : null}
        {canManageOrdersAndContracts ? <RelatedEntityModule
          id="module-orders"
          title="Orders"
          icon={EntityIcon.orders}
          viewAllTo={`/orders?${new URLSearchParams({ filterLocationId: locationId }).toString()}`}
          queryKey={ordersQueryKeys.location(locationId)}
          loadData={(state: DataTableState<Order>) => getOrdersRequest(state, { locationId })}
          tableKey={`locations.detail.modules.orders.${locationId}`}
          columns={getOrderColumns({ showLocation: false })}
          getRowCommands={(order) => OrderService.getRowActions(order, Boolean(session?.permissions.customers?.edit))}
          loadingMessage="Loading orders..."
          emptyMessage="No orders found for this location."
        /> : null}
      </DetailPageLayout>
      <ClassTypeEditDrawer
        classType={editingClassType}
        open={Boolean(editingClassType)}
        onOpenChange={(open) => { if (!open) setEditingClassType(null) }}
      />
      <ProductLocationSettingsDrawer
        product={editingProduct}
        locationId={locationId}
        customerId={location?.parentId}
        currency={location?.currency}
        open={Boolean(editingProduct)}
        onOpenChange={(open) => { if (!open) setEditingProduct(null) }}
      />
    </>
  )
}
