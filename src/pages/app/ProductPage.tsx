import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'

import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
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
import { PageHeader } from '@/components/ui/page-header'
import { NO_VALUE_STR } from '@/constants'
import { getProductRequest } from '@/features/products/api'
import { ProductLocationSettingsDrawer } from '@/features/products/ProductLocationSettingsDrawer'
import { ProductManagementService } from '@/features/products/product-management-service'
import { ProductService } from '@/features/products/product-service'
import { ProductScopeDrawer } from '@/features/products/ProductScopeDrawer'
import { ProductEditDrawer } from '@/features/products/ProductEditDrawer'
import { productsQueryKeys } from '@/features/products/query-keys'
import type { ProductLocationSettings } from '@/features/products/location-products'
import { getOrdersRequest, ordersListConfig } from '@/features/orders/api'
import { getOrderColumns } from '@/features/orders/order-columns'
import { OrderService } from '@/features/orders/order-service'
import { ordersQueryKeys } from '@/features/orders/query-keys'
import { useDetailQuery } from '@/lib/query-hooks'
import { batchListRequest } from '@/lib/batch-api'
import {
  createTableBatchCacheEntry,
  toBatchRequestDto,
  writeBatchEntriesToQueryCache,
} from '@/lib/batch-query-cache'
import { useConnect } from '@/features/app/use-connect'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import type { Order } from '@/types/order'
import type { Product, ProductLocationAssignment, ProductModifierGroup, ProductVariant } from '@/types/product'
import { formatDateTime } from '@/utils/date-utils'
import { HugeiconsIcon } from '@hugeicons/react'
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'

const MODULE_ANCHOR_PREFIX = 'module'
const PRODUCT_BATCH_QUERY_KEY = 'product-detail-batch'

function ProductStatusBadge({ product }: { product: Product }) {
  const status = ProductService.getStatus(product)

  return <Badge variant="outline">{status}</Badge>
}

function CustomerLink({ product }: { product?: Product }) {
  if (!product?.customer?.name) return NO_VALUE_STR

  return (
    <Link to={`/customers/${product.customer.id}`} className="font-medium underline-offset-2 hover:underline">
      {product.customer.name}
    </Link>
  )
}

function getProductDetailSections(
  product?: Product,
  onEdit?: () => void,
  onEditScope?: () => void,
): DetailPanelSection[] {
  return [
    {
      title: 'Product details',
      icon: EntityIcon.products,
      actions: product ? (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit product
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit product visibility"
            title="Edit product visibility"
            onClick={onEditScope}
          >
            <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
          </Button>
        </div>
      ) : null,
      fields: [
        { label: 'Status', value: product ? <ProductStatusBadge product={product} /> : NO_VALUE_STR },
        { label: 'ID', value: product?.id ?? NO_VALUE_STR },
        { label: 'Name', value: product?.name ?? NO_VALUE_STR },
        { label: 'Customer', value: <CustomerLink product={product} /> },
        { label: 'Category', value: product?.productType?.name ?? NO_VALUE_STR },
        {
          label: 'VAT rate',
          value: product
            ? `${(Number(product.vatRate ?? product.productType?.vatRate ?? 0) * 100).toLocaleString()}%${product.vatRate == null ? ' (category)' : ''}`
            : NO_VALUE_STR,
        },
        { label: 'Description', value: product?.description || NO_VALUE_STR },
        {
          label: 'Sales channels',
          value: product
            ? [product.isOnline ? 'Online' : null, product.isInStore ? 'In store' : null].filter(Boolean).join(', ') ||
              NO_VALUE_STR
            : NO_VALUE_STR,
        },
        { label: 'Sellable', value: product ? (product.isSellable ? 'Yes' : 'No') : NO_VALUE_STR },
        { label: 'Scope', value: product?.scope ?? 'ALL' },
        {
          label: 'Created at',
          value: product?.createdAt ? formatDateTime(product.createdAt, NO_VALUE_STR) : NO_VALUE_STR,
        },
        {
          label: 'Updated at',
          value: product?.updatedAt ? formatDateTime(product.updatedAt, NO_VALUE_STR) : NO_VALUE_STR,
        },
      ],
    },
  ]
}

function getModules(product?: Product): DetailPageModule[] {
  return [
    { key: 'variants', label: 'Variants', count: product?.variants?.length ?? 0 },
    { key: 'options', label: 'Option groups', count: product?.modifierGroups?.length ?? 0 },
    { key: 'locations', label: 'Locations', count: product?.locations?.length ?? 0 },
    { key: 'orders', label: 'Orders' },
  ]
}

type ProductVariantRow = Record<string, unknown> & ProductVariant & { id: string; label: string }
type ProductOptionGroupRow = Record<string, unknown> & ProductModifierGroup & { id: string; optionsSummary: string }
type ProductLocationRow = Record<string, unknown> &
  ProductLocationAssignment & {
    id: string
    locationName: string
    availability: string
    overrideSummary: string
    settings: ProductLocationSettings
  }

const productVariantColumns = (currency: string): ColumnDef<ProductVariantRow>[] => [
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge variant="outline">{row.original.isActive ? 'Active' : 'Disabled'}</Badge>,
  },
  { accessorKey: 'label', header: 'Variant' },
  { accessorKey: 'sku', header: 'SKU', cell: ({ row }) => row.original.sku || NO_VALUE_STR },
  {
    accessorKey: 'price',
    header: 'Price',
    cell: ({ row }) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(row.original.price),
  },
  {
    accessorKey: 'stock',
    header: 'Stock',
    cell: ({ row }) => (row.original.stock < 0 ? 'Unlimited' : row.original.stock),
  },
]

const productOptionColumns: ColumnDef<ProductOptionGroupRow>[] = [
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge variant="outline">{row.original.isActive ? 'Active' : 'Disabled'}</Badge>,
  },
  { accessorKey: 'name', header: 'Group' },
  {
    id: 'selection',
    header: 'Selection',
    cell: ({ row }) =>
      `${row.original.isRequired ? 'Required' : 'Optional'} · ${row.original.minSelect}–${row.original.maxSelect}`,
  },
  { accessorKey: 'optionsSummary', header: 'Options and prices' },
]

const productLocationColumns: ColumnDef<ProductLocationRow>[] = [
  {
    id: 'status',
    header: 'Availability',
    cell: ({ row }) => <Badge variant="outline">{row.original.availability}</Badge>,
  },
  {
    accessorKey: 'locationName',
    header: 'Location',
    cell: ({ row }) => (
      <Link to={`/locations/${row.original.locationId}`} className="font-medium underline-offset-2 hover:underline">
        {row.original.locationName}
      </Link>
    ),
  },
  { accessorKey: 'overrideSummary', header: 'Price, stock and availability overrides' },
]

function pageLocalRows<T extends Record<string, unknown>>(
  rows: T[],
  state: DataTableState<T>,
): Promise<DataTableAsyncResult<T>> {
  const { pageIndex, pageSize } = state.pagination
  return Promise.resolve({
    items: rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    count: rows.length,
    pageCount: Math.ceil(rows.length / pageSize),
  })
}

function productVariantRows(product: Product): ProductVariantRow[] {
  return (product.variants ?? [])
    .filter((variant): variant is ProductVariant & { id: string } => Boolean(variant.id))
    .map((variant, index) => ({
      ...variant,
      id: variant.id,
      label:
        variant.attributes?.map((attribute) => `${attribute.name}: ${attribute.value}`).join(' · ') ||
        variant.sku ||
        `Variant ${index + 1}`,
    }))
}

function productOptionGroupRows(product: Product): ProductOptionGroupRow[] {
  const currency = product.customer?.currency || 'EUR'
  return (product.modifierGroups ?? [])
    .filter((group): group is ProductModifierGroup & { id: string } => Boolean(group.id))
    .map((group) => ({
      ...group,
      id: group.id,
      optionsSummary:
        group.modifiers
          .map(
            (modifier) =>
              `${modifier.name} (${new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(modifier.priceOverride ?? modifier.price))}${modifier.isAvailable ? '' : ', unavailable'})`,
          )
          .join(', ') || NO_VALUE_STR,
    }))
}

function productLocationRows(product: Product): ProductLocationRow[] {
  const currency = product.customer?.currency || 'EUR'
  return (product.locations ?? [])
    .filter((assignment): assignment is ProductLocationAssignment & { locationId: string } =>
      Boolean(assignment.locationId),
    )
    .map((assignment) => {
      const activeVariants = (product.variants ?? []).filter((variant): variant is ProductVariant & { id: string } =>
        Boolean(variant.id && variant.isActive),
      )
      const variants = activeVariants.map((variant) => {
        const override = assignment.variantOverrides?.find((entry) => entry.variantId === variant.id)
        const price = override?.priceOverride ?? Number(variant.price)
        const stock = override?.stockOverride ?? variant.stock
        return {
          id: variant.id,
          name: variant.attributes?.map((attribute) => `${attribute.name}: ${attribute.value}`).join(' · ') || variant.sku || 'Default',
          sku: variant.sku ?? null,
          price,
          basePrice: Number(variant.price),
          stock,
          baseStock: variant.stock,
          isAvailable: override?.isAvailable ?? true,
          isPriceOverridden: override?.priceOverride != null,
          isStockOverridden: override?.stockOverride != null,
        }
      })
      const effective = product.scope === 'ALL' || assignment.isInScope
      const availability = !effective ? 'Out of scope' : assignment.isAvailable ? 'Available' : 'Unavailable'
      const overrideSummary =
        variants
          .filter((variant) => variant.isPriceOverridden || variant.isStockOverridden || !variant.isAvailable)
          .map((variant) => {
            const changed = [
              variant.isPriceOverridden
                ? new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(variant.price)
                : null,
              variant.isStockOverridden ? `stock ${variant.stock}` : null,
              !variant.isAvailable ? 'disabled' : null,
            ].filter(Boolean)
            return `${variant.name}: ${changed.join(' · ')}`
          })
          .join(', ') || NO_VALUE_STR
      const settings: ProductLocationSettings = {
        id: product.id,
        name: product.name,
        description: product.description ?? null,
        isOnline: product.isOnline ?? false,
        isInStore: product.isInStore ?? true,
        isSellable: product.isSellable ?? true,
        isAvailable: assignment.isAvailable,
        variants,
      }
      return {
        ...assignment,
        id: assignment.locationId,
        locationName: assignment.location?.name ?? assignment.locationId,
        availability,
        overrideSummary,
        settings,
      }
    })
}

function ProductModulesLoading() {
  return <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Loading product modules...</div>
}

export default function ProductPage() {
  const { productId = '' } = useParams()
  const navigate = useNavigate()
  const [editingScope, setEditingScope] = useState<Product | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [addProductSection, setAddProductSection] = useState<'variants' | 'options' | null>(null)
  const [focusProductSection, setFocusProductSection] = useState<'variants' | 'options' | null>(null)
  const [addOptionGroupId, setAddOptionGroupId] = useState<string | null>(null)
  const [editingLocation, setEditingLocation] = useState<{
    locationId: string
    settings: ProductLocationSettings
  } | null>(null)
  const { session } = useConnect()
  const queryClient = useQueryClient()
  const canManageOrders = Boolean(session?.permissions.customers?.edit)

  const {
    data: product,
    isError,
    isLoading,
    isFetching: isFetchingProduct,
  } = useDetailQuery({
    queryKey: productsQueryKeys.detail(productId),
    queryFn: () => getProductRequest(productId),
    enabled: Boolean(productId),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const batchEntries = product
    ? [
        createTableBatchCacheEntry<Order>({
          key: 'orders',
          queryKey: ordersQueryKeys.product(product.id),
          tableKey: 'products.detail.modules.orders',
          pageSize: RELATED_ENTITY_MODULE_PAGE_SIZE,
          url: ordersListConfig.url,
          payload: (tableState) =>
            ordersListConfig.toPayload(tableState, {
              productId: product.id,
              customerId: product.customerId ?? product.organizationId ?? product.customer.id,
            }),
          map: ordersListConfig.toResult,
        }),
      ]
    : []

  const productBatchQuery = useQuery({
    queryKey: [PRODUCT_BATCH_QUERY_KEY, productId, product?.customerId ?? product?.organizationId],
    queryFn: async () => {
      const data = await batchListRequest(toBatchRequestDto(batchEntries))
      const failedKeys = writeBatchEntriesToQueryCache({ data, entries: batchEntries, queryClient })

      return { failedKeys }
    },
    enabled: Boolean(productId) && Boolean(session) && Boolean(product) && !isFetchingProduct,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const isLoadingModules =
    Boolean(session) &&
    Boolean(product) &&
    (isFetchingProduct || productBatchQuery.isFetching || (!productBatchQuery.isSuccess && !productBatchQuery.isError))
  const failedBatchKeys = productBatchQuery.data?.failedKeys ?? []

  if (isLoading || isLoadingModules) {
    return (
      <DetailPageLayout
        header={{ title: 'Product name', subtitle: 'Loading...', backTo: '/products' }}
        modules={getModules()}
        aside={<DetailSidePanel sections={getProductDetailSections()} isLoading />}
      >
        <ProductModulesLoading />
      </DetailPageLayout>
    )
  }

  if (isError || !product) {
    return (
      <>
        <PageHeader title="Product not found" subtitle={productId} backTo="/products" />
        <section className="p-4 md:p-6">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Failed to load this product.
          </div>
        </section>
      </>
    )
  }

  const openProductEditor = (
    section: 'variants' | 'options' | null = null,
    add = false,
    groupId: string | null = null,
  ) => {
    setAddProductSection(add ? section : null)
    setFocusProductSection(section)
    setAddOptionGroupId(groupId)
    setEditingProduct(product)
  }
  const closeProductEditor = (open: boolean) => {
    if (open) return
    setEditingProduct(null)
    setAddProductSection(null)
    setFocusProductSection(null)
    setAddOptionGroupId(null)
  }
  const headerActions = ProductService.getDetailHeaderActions(product, navigate)

  return (
    <DetailPageLayout
      header={{
        title: product.name,
        subtitle: <CustomerLink product={product} />,
        backTo: '/products',
        primaryAction: headerActions.primaryAction,
        secondaryAction: headerActions.secondaryAction,
        options: headerActions.options,
      }}
      modules={getModules(product)}
      aside={
        <DetailSidePanel
          sections={getProductDetailSections(
            product,
            () => openProductEditor(),
            () => setEditingScope(product),
          )}
        />
      }
    >
      <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-variants`}
        title="Variants and prices"
        icon={EntityIcon.products}
        initialTotal={product.variants?.length ?? 0}
        queryKey={[...productsQueryKeys.detail(product.id), 'module', 'variants']}
        loadData={(state: DataTableState<ProductVariantRow>) => pageLocalRows(productVariantRows(product), state)}
        tableKey="products.detail.modules.variants"
        columns={productVariantColumns(product.customer?.currency || 'EUR')}
        getRowCommands={(variant): DropdownActionItem[] => [
          { label: 'Edit variant', onClick: () => openProductEditor('variants') },
          {
            label: variant.isActive ? 'Disable' : 'Enable',
            onClick: () => void ProductManagementService.setVariantActive(product, variant.id, !variant.isActive),
          },
        ]}
        action={{ label: 'Add variant', onClick: () => openProductEditor('variants', true) }}
        loadingMessage="Loading variants..."
        emptyMessage="No variants configured. Add a variant to set a price."
        refetchOnMount="always"
      />
      <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-options`}
        title="Option groups and supplements"
        icon={EntityIcon.products}
        initialTotal={product.modifierGroups?.length ?? 0}
        queryKey={[...productsQueryKeys.detail(product.id), 'module', 'options']}
        loadData={(state: DataTableState<ProductOptionGroupRow>) =>
          pageLocalRows(productOptionGroupRows(product), state)
        }
        tableKey="products.detail.modules.options"
        columns={productOptionColumns}
        getRowCommands={(group): DropdownActionItem[] => [
          { label: 'Edit group and options', onClick: () => openProductEditor('options') },
          ...(group.id ? [{ label: 'Add option', onClick: () => openProductEditor('options', false, group.id) }] : []),
          ...(group.id
            ? [
                {
                  label: 'Remove from product',
                  onClick: () => void ProductManagementService.removeModifierGroup(product, group.id),
                },
              ]
            : []),
        ]}
        action={{ label: 'Add option group', onClick: () => openProductEditor('options', true) }}
        loadingMessage="Loading option groups..."
        emptyMessage="No option groups linked to this product."
        refetchOnMount="always"
      />
      <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-locations`}
        title="Locations and overrides"
        icon={EntityIcon.locations}
        initialTotal={product.locations?.length ?? 0}
        queryKey={[...productsQueryKeys.detail(product.id), 'module', 'locations']}
        loadData={(state: DataTableState<ProductLocationRow>) => pageLocalRows(productLocationRows(product), state)}
        tableKey="products.detail.modules.locations"
        columns={productLocationColumns}
        getRowCommands={(location): DropdownActionItem[] => [
          {
            label: 'Edit location settings',
            onClick: () => setEditingLocation({ locationId: location.locationId, settings: location.settings }),
          },
        ]}
        action={{ label: 'Add location', onClick: () => setEditingScope(product) }}
        loadingMessage="Loading location settings..."
        emptyMessage="No locations found for this customer."
        refetchOnMount="always"
      />
      {productBatchQuery.isError || failedBatchKeys.includes('orders') ? (
        <EmptyRelatedEntityModule
          id={`${MODULE_ANCHOR_PREFIX}-orders`}
          title="Orders containing this product"
          icon={EntityIcon.orders}
          description="Failed to load product orders. Reopen this page to try again."
        />
      ) : (
        <RelatedEntityModule
          id={`${MODULE_ANCHOR_PREFIX}-orders`}
          title="Orders containing this product"
          icon={EntityIcon.orders}
          viewAllTo={`/orders?${new URLSearchParams({ filterProductId: product.id }).toString()}`}
          queryKey={ordersQueryKeys.product(product.id)}
          loadData={(state: DataTableState<Order>) =>
            getOrdersRequest(state, {
              productId: product.id,
              customerId: product.customerId ?? product.organizationId ?? product.customer.id,
            })
          }
          tableKey="products.detail.modules.orders"
          columns={getOrderColumns({ showCustomer: false })}
          getRowCommands={(order) => OrderService.getRowActions(order, canManageOrders)}
          loadingMessage="Loading product orders..."
          emptyMessage="No orders contain this product."
          refetchOnMount={false}
        />
      )}
      <ProductEditDrawer
        product={editingProduct}
        open={Boolean(editingProduct)}
        addSection={addProductSection}
        focusSection={focusProductSection}
        addOptionGroupId={addOptionGroupId}
        onOpenChange={closeProductEditor}
      />
      <ProductScopeDrawer
        product={editingScope}
        open={Boolean(editingScope)}
        onOpenChange={(open) => {
          if (!open) setEditingScope(null)
        }}
      />
      <ProductLocationSettingsDrawer
        product={editingLocation?.settings ?? null}
        locationId={editingLocation?.locationId ?? ''}
        customerId={product.customerId ?? product.organizationId ?? product.customer.id}
        currency={product.customer?.currency ?? 'EUR'}
        open={Boolean(editingLocation)}
        onOpenChange={(open) => {
          if (!open) setEditingLocation(null)
        }}
      />
    </DetailPageLayout>
  )
}
