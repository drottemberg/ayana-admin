import { useCallback, useMemo, useState } from 'react'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { getProductsRequest } from '@/features/products/api'
import { getProductColumns } from '@/features/products/product-columns'
import { ProductService } from '@/features/products/product-service'
import { ProductManagementService } from '@/features/products/product-management-service'
import { ProductScopeDrawer } from '@/features/products/ProductScopeDrawer'
import { ProductEditDrawer } from '@/features/products/ProductEditDrawer'
import { productsQueryKeys } from '@/features/products/query-keys'
import { getCustomersListRequest } from '@/features/customers/api'
import { useConnect } from '@/features/app/use-connect'
import type { Product } from '@/types/product'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

export default function ProductsPage() {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingScopeProduct, setEditingScopeProduct] = useState<Product | null>(null)
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
  const handleGetRowCommands = useCallback((product: Product) => {
    return ProductManagementService.getRowActions(product, {
      canEdit: Boolean(session?.permissions.customers?.edit),
      onEdit: setEditingProduct,
      onEditScope: setEditingScopeProduct,
    })
  }, [session?.permissions.customers?.edit])

  return (
    <>
      <PageHeader title="Products" subtitle="Customer catalog and location visibility." />

      <section className="space-y-5 p-4 md:p-6">
        <DataTableAsync
          queryKey={[...productsQueryKeys.all, 'table']}
          loadData={loadProducts}
          tableKey="products.root"
          columns={columns}
          searchPlaceholder="Search by ID or name"
          searchColumns={['id', 'name']}
          filters={[
            {
              id: 'status',
              label: 'Status',
              column: 'status',
              options: ['ACTIVE', 'DISABLED'],
              getValue: ProductService.getStatus,
            },
            ...(isAdminContext
              ? [
                  {
                    id: 'customerId',
                    label: 'Customer',
                    column: 'customer' as const,
                    selectionMode: 'single' as const,
                    queryFn: (search: string, _page: number) =>
                      getCustomersListRequest(undefined, search).then((items) => ({
                        items: items.map((customer) => ({ id: customer.id, label: customer.name })),
                        total: items.length,
                      })),
                  },
                ]
              : []),
          ]}
          getRowCommands={handleGetRowCommands}
          loadingMessage="Loading products..."
          emptyMessage="No products found."
          errorMessage="Failed to load products."
        />
      </section>
      <ProductEditDrawer product={editingProduct} open={Boolean(editingProduct)} onOpenChange={(open) => { if (!open) setEditingProduct(null) }} />
      <ProductScopeDrawer product={editingScopeProduct} open={Boolean(editingScopeProduct)} onOpenChange={(open) => { if (!open) setEditingScopeProduct(null) }} />
    </>
  )
}
