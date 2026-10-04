import { Link, useNavigate, useParams } from 'react-router-dom'

import type { DataTableState } from '@/components/data-table'
import {
  DetailPageLayout,
  DetailSidePanel,
  EmptyRelatedEntityModule,
  RelatedEntityModule,
  type DetailPanelSection,
  type DetailPageModule,
} from '@/components/app/detail-page-layout'
import { EntityIcon } from '@/components/app/entity-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { NO_VALUE_STR } from '@/constants'
import { getDevicesRequest, getDeviceTypesRequest } from '@/features/devices/api'
import { deviceColumns } from '@/features/devices/device-columns'
import { DeviceService } from '@/features/devices/device-service'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { getProductRequest } from '@/features/products/api'
import { ProductService } from '@/features/products/product-service'
import { productsQueryKeys } from '@/features/products/query-keys'
import { useDetailQuery, useDictionaryQuery } from '@/lib/query-hooks'
import { Drawer, DrawerId } from '@/providers/drawer'
import type { Device } from '@/types/device'
import { ProductStatus, type Product, type ProductStatus as ProductStatusType } from '@/types/product'
import { formatDateTime } from '@/utils/date-utils'
import { HugeiconsIcon } from '@hugeicons/react'
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'

const MODULE_ANCHOR_PREFIX = 'module'

const productStatusLabel: Record<ProductStatusType, string> = {
  [ProductStatus.ACTIVE]: 'Active',
  [ProductStatus.DISABLED]: 'Disabled',
  [ProductStatus.ARCHIVED]: 'Archived',
  [ProductStatus.DELETED]: 'Deleted',
}

const productStatusClassName: Record<ProductStatusType, string> = {
  [ProductStatus.ACTIVE]: 'bg-green-100 text-green-800 border-green-200',
  [ProductStatus.DISABLED]: 'bg-orange-100 text-orange-800 border-orange-200',
  [ProductStatus.ARCHIVED]: 'bg-muted text-muted-foreground border-border',
  [ProductStatus.DELETED]: 'bg-red-100 text-red-800 border-red-200',
}

const modules: DetailPageModule[] = [{ key: 'devices', label: 'Devices' }]

function ProductStatusBadge({ product }: { product: Product }) {
  const status = ProductService.getStatus(product)

  return (
    <Badge variant="outline" className={productStatusClassName[status]}>
      {productStatusLabel[status]}
    </Badge>
  )
}

function CustomerLink({ product }: { product?: Product }) {
  if (!product?.customer?.name) return NO_VALUE_STR

  return (
    <Link to={`/customers/${product.customer.id}`} className="font-medium underline-offset-2 hover:underline">
      {product.customer.name}
    </Link>
  )
}

function getProductDetailSections(product?: Product): DetailPanelSection[] {
  return [
    {
      title: 'Details',
      icon: EntityIcon.products,
      actions: product ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit product details"
          onClick={() => Drawer.show(DrawerId.CreateProduct, { product })}
        >
          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
        </Button>
      ) : null,
      fields: [
        { label: 'Status', value: product ? <ProductStatusBadge product={product} /> : NO_VALUE_STR },
        { label: 'ID', value: product?.id ?? NO_VALUE_STR },
        { label: 'Name', value: product?.name ?? NO_VALUE_STR },
        { label: 'Customer', value: <CustomerLink product={product} /> },
        { label: 'Brand', value: product?.brand?.name ?? NO_VALUE_STR },
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

function ProductModulesLoading() {
  return <EmptyRelatedEntityModule id={`${MODULE_ANCHOR_PREFIX}-devices`} title="Devices" description="Loading..." />
}

export default function ProductPage() {
  const { productId = '' } = useParams()
  const navigate = useNavigate()

  useDictionaryQuery({
    queryKey: devicesQueryKeys.types,
    queryFn: getDeviceTypesRequest,
  })

  const {
    data: product,
    isError,
    isLoading,
  } = useDetailQuery({
    queryKey: productsQueryKeys.detail(productId),
    queryFn: () => getProductRequest(productId),
    enabled: Boolean(productId),
  })

  if (isLoading) {
    return (
      <DetailPageLayout
        header={{ title: 'Product name', subtitle: 'Loading...', backTo: '/products' }}
        modules={modules}
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

  const headerActions = ProductService.getDetailHeaderActions(product, navigate)

  return (
    <DetailPageLayout
      header={{
        title: product.name,
        subtitle: <CustomerLink product={product} />,
        backTo: '/products',
        options: headerActions.options,
      }}
      modules={modules}
      aside={<DetailSidePanel sections={getProductDetailSections(product)} />}
    >
      <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-devices`}
        title="Devices"
        icon={EntityIcon.devices}
        viewAllTo={`/devices?${new URLSearchParams({ 'f.productId': product.id }).toString()}`}
        queryKey={[...devicesQueryKeys.all, 'product-module', product.id]}
        loadData={(state: DataTableState<Device>) => getDevicesRequest(state, { productId: product.id })}
        tableKey="products.detail.modules.devices"
        columns={deviceColumns}
        getCommands={(devices) => DeviceService.getTableActions({ devices, navigate })}
        getRowCommands={(device) => DeviceService.getActions(device, navigate)}
        action={ProductService.getModuleAction(product, 'devices', navigate)}
        loadingMessage="Loading devices..."
        emptyMessage="No devices found."
        refetchOnMount={false}
      />
    </DetailPageLayout>
  )
}
