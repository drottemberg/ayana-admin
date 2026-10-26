import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { SelectInputAsync } from '@/components/ui/select-input'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { getCustomersListRequest } from '@/features/customers/api'
import { useConnect } from '@/features/app/use-connect'
import { CatalogImageEditor } from '@/features/products/CatalogImageEditor'
import { getProductCategoriesRequest, uploadProductCategoryImageRequest } from '@/features/products/api'
import { productsQueryKeys } from '@/features/products/query-keys'
import type { Customer } from '@/types/customer'
import type { ProductCategory } from '@/types/product'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

const categoriesQueryKey = (customerId: string) => [...productsQueryKeys.all, 'categories', customerId] as const

function categoryEmoji(name: string) {
  const value = name.toLocaleLowerCase()
  if (/matcha/.test(value)) return '🍵'
  if (/coffee|café|cafe/.test(value)) return '☕'
  if (/tea|thé|the|infusion/.test(value)) return '🫖'
  if (/good|merch|accessor/.test(value)) return '🛍️'
  return '✨'
}

export default function ProductCategoriesPage() {
  const navigate = useNavigate()
  const { session } = useConnect()
  const queryClient = useQueryClient()
  const isAdminContext = getPortalSafe() === Portal.ADMIN
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null)
  const [uploading, setUploading] = useState(false)
  const customerId = isAdminContext ? selectedCustomerId : session?.currentOrganization?.id ?? ''
  const canEdit = Boolean(session?.permissions.products?.edit)
  const categoriesQuery = useQuery({
    queryKey: categoriesQueryKey(customerId),
    queryFn: () => getProductCategoriesRequest(customerId),
    enabled: Boolean(customerId),
  })
  const selectedCustomers = useMemo(() => selectedCustomer ? [selectedCustomer] : [], [selectedCustomer])
  const categories = categoriesQuery.data ?? []

  const uploadImage = async (file: File) => {
    if (!editingCategory || !customerId) return false
    setUploading(true)
    try {
      const result = await uploadProductCategoryImageRequest(editingCategory.id, customerId, file)
      const updatedCategory = { ...editingCategory, attachmentId: result.attachmentId, imageUrl: result.imageUrl }
      queryClient.setQueryData<ProductCategory[]>(categoriesQueryKey(customerId), (current) =>
        current?.map((category) => category.id === updatedCategory.id ? updatedCategory : category),
      )
      queryClient.invalidateQueries({ queryKey: productsQueryKeys.all })
      setEditingCategory(updatedCategory)
      toast.success('Category photo saved.')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the category photo.')
      return false
    } finally {
      setUploading(false)
    }
  }

  return <>
    <PageHeader
      title="Product categories"
      subtitle="Category photos are shared across the store and managed separately from product photos."
      tabs={[
        { key: 'products', label: 'Products', onClick: () => navigate('/products') },
        { key: 'categories', label: 'Categories', active: true },
      ]}
    />
    <section className="space-y-5 p-4 md:p-6">
      {isAdminContext ? <div className="max-w-lg">
        <SelectInputAsync<Customer>
          label="Customer"
          placeholder="Select customer"
          queryKey={customersQueryKeys.all}
          queryFn={(search) => getCustomersListRequest(undefined, search)}
          getOption={(customer) => ({ value: customer.id, label: customer.name })}
          selectedItems={selectedCustomers}
          value={selectedCustomerId}
          onValueChange={(value) => setSelectedCustomerId(String(value))}
          onSelectedItemsChange={(items) => setSelectedCustomer(items[0] ?? null)}
        />
      </div> : null}

      {!customerId ? <div className="rounded-lg border p-6 text-sm text-muted-foreground">Select a customer to manage its product categories.</div>
        : categoriesQuery.isLoading ? <div className="rounded-lg border p-6 text-sm text-muted-foreground">Loading categories…</div>
          : categoriesQuery.isError ? <div className="rounded-lg border p-6 text-sm text-destructive">Could not load product categories.</div>
            : categories.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => <article key={category.id} className="flex min-w-0 items-center gap-4 rounded-xl border bg-card p-4">
                <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#e7d8c4] text-3xl">
                  {category.imageUrl ? <img src={category.imageUrl} alt="" className="size-full object-contain p-1" /> : <span aria-hidden="true">{categoryEmoji(category.name)}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{category.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">VAT {Number(category.vatRate) * 100}%</p>
                  <Button className="mt-3" variant="outline" size="sm" disabled={!canEdit} onClick={() => setEditingCategory(category)}>
                    {category.imageUrl ? 'Edit category photo' : 'Add category photo'}
                  </Button>
                </div>
              </article>)}
            </div> : <div className="rounded-lg border p-6 text-sm text-muted-foreground">No product categories found.</div>}
    </section>

    <AppDrawer
      title={editingCategory ? `Category photo · ${editingCategory.name}` : 'Category photo'}
      open={Boolean(editingCategory)}
      onOpenChange={(open) => { if (!open) setEditingCategory(null) }}
      contentClassName="sm:max-w-xl"
    >
      {editingCategory ? <div className="grid gap-4 overflow-y-auto px-5 pb-6">
        <p className="text-sm text-muted-foreground">This photo appears on the store category card. It is independent from every product photo in this category.</p>
        <CatalogImageEditor
          label={`${editingCategory.name} category photo`}
          imageUrl={editingCategory.imageUrl ?? ''}
          attachmentId={editingCategory.attachmentId ?? ''}
          customerId={customerId}
          emptyIcon={categoryEmoji(editingCategory.name)}
          disabled={!canEdit}
          uploading={uploading}
          onUpload={uploadImage}
        />
      </div> : null}
    </AppDrawer>
  </>
}
