import { useCallback, useMemo } from 'react'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { getProductFilterOptionsRequest, getProductsRequest } from '@/features/products/api'
import { getProductColumns } from '@/features/products/product-columns'
import { ProductService } from '@/features/products/product-service'
import { productsQueryKeys } from '@/features/products/query-keys'
import { useConnect } from '@/features/app/use-connect'
import { Drawer, DrawerId } from '@/providers/drawer'
import type { Product } from '@/types/product'
import { ProductStatusValues } from '@/types/product'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

export default function ProductsPage() {
  const { session } = useConnect()
  const portal = getPortalSafe()
  const isAdminContext = portal === Portal.ADMIN
  const hiddenFilters = useMemo(() => {
    if (isAdminContext) return undefined
    const customerId = session?.currentOrganization?.id
    return customerId ? { customerId } : undefined
  }, [isAdminContext, session?.currentOrganization?.id])
  const columns = useMemo(() => getProductColumns({ showCustomer: isAdminContext }), [isAdminContext])
  const loadProducts = useCallback(
    (tableState: DataTableState<Product>) => getProductsRequest(tableState, hiddenFilters),
    [hiddenFilters],
  )
  const handleGetCommands = useCallback((products: Product[]) => {
    return ProductService.getTableActions(products)
  }, [])
  const handleGetRowCommands = useCallback((product: Product) => {
    return ProductService.getActions(product)
  }, [])

  return (
    <>
      <PageHeader
        title="Product"
        primaryAction={{
          children: 'Add new product',
          onClick: () => Drawer.show(DrawerId.CreateProduct, {}),
        }}
      />

      <section className="space-y-5 p-4 md:p-6">
        <DataTableAsync
          queryKey={[...productsQueryKeys.all, 'table']}
          loadData={loadProducts}
          tableKey="products.root"
          columns={columns}
          searchPlaceholder="Search by ID, name, customer name, brand"
          searchColumns={['id', 'name']}
          filters={[
            {
              id: 'status',
              label: 'Status',
              column: 'status',
              options: [...ProductStatusValues],
              getValue: ProductService.getStatus,
            },
            ...(isAdminContext
              ? [
                  {
                    id: 'customerId',
                    label: 'Customer',
                    column: 'customer' as const,
                    selectionMode: 'single' as const,
                    queryFn: (search: string, page: number) =>
                      getProductFilterOptionsRequest('customer', search, page, hiddenFilters),
                  },
                ]
              : []),
            {
              id: 'brandId',
              label: 'Brand',
              column: 'brand',
              selectionMode: 'single',
              queryFn: (search, page) => getProductFilterOptionsRequest('brand', search, page, hiddenFilters),
            },
          ]}
          getCommands={handleGetCommands}
          getRowCommands={handleGetRowCommands}
          loadingMessage="Loading products..."
          emptyMessage="No products found."
          errorMessage="Failed to load products."
        />
      </section>
    </>
  )
}
