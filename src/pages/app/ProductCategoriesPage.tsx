import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { HugeiconsIcon } from '@hugeicons/react'
import DragDropHorizontalIcon from '@hugeicons/core-free-icons/DragDropHorizontalIcon'

import { AppDrawer } from '@/components/app/AppDrawer'
import { DataTableAsync, type DataTableFilter, type DataTableState } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { getCustomerFilterOptionsRequest } from '@/features/customers/api'
import { getLocationFilterOptionsRequest } from '@/features/locations/api'
import { CatalogImageEditor } from '@/features/products/CatalogImageEditor'
import { getProductCategoriesListRequest, getProductCategoriesRequest, reorderProductCategoriesRequest, uploadProductCategoryImageRequest } from '@/features/products/api'
import { getProductCategoryColumns } from '@/features/products/product-category-columns'
import { ProductCategoryCreateDrawer } from '@/features/products/ProductCategoryCreateDrawer'
import { ProductCategoryEditDrawer } from '@/features/products/ProductCategoryEditDrawer'
import { productsQueryKeys } from '@/features/products/query-keys'
import { useConnect } from '@/features/app/use-connect'
import type { ProductCategory } from '@/types/product'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

const EMPTY_CATEGORIES: ProductCategory[] = []
const CATEGORIES_TABLE_QUERY_KEY = ['product-categories', 'table'] as const
const categoriesQueryKey = (customerId: string) => [...productsQueryKeys.all, 'categories', customerId] as const

function categoryEmoji(name: string) {
  const value = name.toLocaleLowerCase()
  if (/matcha/.test(value)) return '🍵'
  if (/coffee|café|cafe/.test(value)) return '☕'
  if (/tea|thé|the|infusion/.test(value)) return '🫖'
  if (/good|merch|accessor/.test(value)) return '🛍️'
  return '✨'
}

function SortableCategoryCard({ category, index, canEdit, onEdit }: {
  category: ProductCategory
  index: number
  canEdit: boolean
  onEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id, disabled: !canEdit })
  return <article
    ref={setNodeRef}
    style={{ transform: CSS.Transform.toString(transform), transition }}
    className={`flex min-w-0 items-center gap-4 rounded-xl border bg-card p-4 ${isDragging ? 'relative z-10 shadow-lg' : ''}`}
  >
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={canEdit ? 'shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing' : 'shrink-0 text-muted-foreground'}
      aria-label={`Reorder ${category.name}`}
      disabled={!canEdit}
      {...attributes}
      {...listeners}
    >
      <HugeiconsIcon icon={DragDropHorizontalIcon} strokeWidth={2} />
    </Button>
    <span className="w-6 shrink-0 text-center text-sm text-muted-foreground">{index + 1}</span>
    <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#e7d8c4] text-3xl">
      {category.imageUrl ? <img src={category.imageUrl} alt="" className="size-full object-cover" /> : <span aria-hidden="true">{categoryEmoji(category.name)}</span>}
    </div>
    <div className="min-w-0 flex-1">
      <h2 className="truncate font-semibold">{category.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">VAT {Number(category.vatRate) * 100}%</p>
      <p className="text-sm text-muted-foreground">{category.isActive === false ? 'Disabled' : 'Active'}</p>
      <Button className="mt-2" variant="outline" size="sm" disabled={!canEdit} onClick={onEdit}>
        {category.imageUrl ? 'Edit category photo' : 'Add category photo'}
      </Button>
    </div>
  </article>
}

export default function ProductCategoriesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session } = useConnect()
  const queryClient = useQueryClient()
  const isAdminContext = getPortalSafe() === Portal.ADMIN
  const canEdit = Boolean(session?.permissions.products?.edit)
  const activeCustomerId = session?.currentOrganization?.id ?? ''
  const customerFilterId = searchParams.get('f.customerId')?.split(',')[0] ?? ''
  const reorderCustomerId = isAdminContext ? customerFilterId : activeCustomerId

  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null)
  const [editingDetails, setEditingDetails] = useState<ProductCategory | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [reorderOpen, setReorderOpen] = useState(false)
  const [orderedCategories, setOrderedCategories] = useState<ProductCategory[]>(EMPTY_CATEGORIES)
  const [uploading, setUploading] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)

  const columns = useMemo(() => getProductCategoryColumns({ showCustomer: isAdminContext }), [isAdminContext])
  const loadCategories = useCallback((state: DataTableState<ProductCategory>) => getProductCategoriesListRequest(state), [])
  const filters = useMemo<DataTableFilter<ProductCategory>[]>(() => [
    { id: 'status', label: 'Status', column: 'isActive', options: ['ACTIVE', 'DISABLED'], getValue: (category) => category.isActive ? 'ACTIVE' : 'DISABLED' },
    ...(isAdminContext ? [{
      id: 'customerId', label: 'Customer', column: 'customerId' as const, selectionMode: 'single' as const,
      queryFn: getCustomerFilterOptionsRequest,
      getValue: (category: ProductCategory) => category.customerId,
    }] : []),
    {
      id: 'locationId', label: 'Location', column: 'locationIds' as const, selectionMode: 'single' as const,
      queryFn: getLocationFilterOptionsRequest,
      getValue: (category) => category.locationIds ?? [],
    },
  ], [isAdminContext])

  const reorderQuery = useQuery({
    queryKey: categoriesQueryKey(reorderCustomerId),
    queryFn: () => getProductCategoriesRequest(reorderCustomerId),
    enabled: Boolean(reorderOpen && reorderCustomerId),
  })
  const reorderableCategories = reorderQuery.data ?? EMPTY_CATEGORIES
  useEffect(() => { setOrderedCategories(reorderableCategories) }, [reorderableCategories])
  const orderChanged = orderedCategories.some((category, index) => category.id !== reorderableCategories[index]?.id)

  const handleCategoryDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setOrderedCategories((current) => {
      const oldIndex = current.findIndex((category) => category.id === active.id)
      const newIndex = current.findIndex((category) => category.id === over.id)
      return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex)
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const saveCategoryOrder = async () => {
    if (!reorderCustomerId || !orderChanged || savingOrder) return
    setSavingOrder(true)
    try {
      const updated = await reorderProductCategoriesRequest(reorderCustomerId, orderedCategories.map((category) => category.id))
      queryClient.setQueryData(categoriesQueryKey(reorderCustomerId), updated)
      await queryClient.invalidateQueries({ queryKey: CATEGORIES_TABLE_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: productsQueryKeys.all })
      toast.success('Category order saved.')
      setReorderOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save category order.')
    } finally {
      setSavingOrder(false)
    }
  }

  const uploadImage = async (file: File) => {
    const customerId = editingCategory?.customerId ?? activeCustomerId
    if (!editingCategory || !customerId) return false
    setUploading(true)
    try {
      const uploaded = await uploadProductCategoryImageRequest(editingCategory.id, customerId, file)
      setEditingCategory((current) => current?.id === editingCategory.id
        ? { ...current, imageUrl: uploaded.imageUrl, attachmentId: uploaded.attachmentId }
        : current)
      await queryClient.invalidateQueries({ queryKey: CATEGORIES_TABLE_QUERY_KEY })
      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey(customerId) })
      await queryClient.invalidateQueries({ queryKey: productsQueryKeys.all })
      toast.success('Category photo saved.')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the category photo.')
      return false
    } finally {
      setUploading(false)
    }
  }

  const openReorder = () => {
    if (!reorderCustomerId) {
      toast.error('Filter the list by one customer before reordering categories.')
      return
    }
    setOrderedCategories(EMPTY_CATEGORIES)
    setReorderOpen(true)
  }

  return <>
    <PageHeader
      title="Product categories"
      subtitle="Categories across customer catalogs and the locations where their products are available."
      tabs={[
        { key: 'products', label: 'Products', onClick: () => navigate('/products') },
        { key: 'categories', label: 'Categories', active: true },
      ]}
      primaryAction={canEdit ? { children: 'Add category', onClick: () => setCreateOpen(true) } : undefined}
      secondaryAction={canEdit ? { children: 'Reorder categories', onClick: openReorder } : undefined}
    />

    <section className="p-4 md:p-6">
      <DataTableAsync
        queryKey={CATEGORIES_TABLE_QUERY_KEY}
        loadData={loadCategories}
        refetchOnMount="always"
        tableKey="product-categories.root"
        columns={columns}
        searchPlaceholder="Search by category or customer"
        searchColumns={['id', 'name', 'customerName']}
        filters={filters}
        disabledSelection
        getRowCommands={(category) => canEdit ? [
          { label: 'Edit category', onClick: () => setEditingDetails(category) },
          { label: category.imageUrl ? 'Edit category photo' : 'Add category photo', onClick: () => setEditingCategory(category) },
        ] : []}
        loadingMessage="Loading categories..."
        emptyMessage="No categories found."
        errorMessage="Could not load categories."
      />
    </section>

    <ProductCategoryCreateDrawer
      open={createOpen}
      onOpenChange={setCreateOpen}
      isAdmin={isAdminContext}
      customerId={activeCustomerId}
      onCreated={async (category) => {
        setCreateOpen(false)
        await queryClient.invalidateQueries({ queryKey: CATEGORIES_TABLE_QUERY_KEY })
        await queryClient.invalidateQueries({ queryKey: categoriesQueryKey(category.customerId ?? activeCustomerId) })
        await queryClient.invalidateQueries({ queryKey: productsQueryKeys.all })
      }}
    />

    <ProductCategoryEditDrawer
      category={editingDetails}
      open={Boolean(editingDetails)}
      onOpenChange={(open) => { if (!open) setEditingDetails(null) }}
      onSaved={async () => {
        setEditingDetails(null)
        await queryClient.invalidateQueries({ queryKey: CATEGORIES_TABLE_QUERY_KEY })
        await queryClient.invalidateQueries({ queryKey: categoriesQueryKey(editingDetails?.customerId ?? '') })
        await queryClient.invalidateQueries({ queryKey: productsQueryKeys.all })
      }}
    />

    <AppDrawer
      title="Reorder categories"
      description="Choose a customer to reorder the categories shown in its store."
      open={reorderOpen}
      onOpenChange={(open) => { if (!open) setReorderOpen(false) }}
      contentClassName="sm:max-w-2xl"
    >
      {reorderQuery.isLoading ? <div className="px-5 pb-6 text-sm text-muted-foreground">Loading categories...</div>
        : reorderQuery.isError ? <div className="px-5 pb-6 text-sm text-destructive">Could not load categories for ordering.</div>
          : <div className="grid gap-4 overflow-y-auto px-5 pb-6">
            {reorderableCategories.length ? <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
              onDragEnd={handleCategoryDragEnd}
            >
              <SortableContext items={orderedCategories.map((category) => category.id)} strategy={verticalListSortingStrategy}>
                <div className="grid gap-3">
                  {orderedCategories.map((category, index) => <SortableCategoryCard
                    key={category.id}
                    category={{ ...category, customerId: reorderCustomerId }}
                    index={index}
                    canEdit={canEdit}
                    onEdit={() => setEditingCategory({ ...category, customerId: reorderCustomerId })}
                  />)}
                </div>
              </SortableContext>
            </DndContext> : <p className="text-sm text-muted-foreground">No active categories to reorder.</p>}
            <div className="sticky bottom-0 flex justify-end border-t bg-background py-3">
              <Button disabled={!orderChanged || savingOrder || !canEdit} loading={savingOrder} onClick={() => void saveCategoryOrder()}>
                Save category order
              </Button>
            </div>
          </div>}
    </AppDrawer>

    <AppDrawer
      title={editingCategory ? `Category photo · ${editingCategory.name}` : 'Category photo'}
      open={Boolean(editingCategory)}
      onOpenChange={(open) => { if (!open) setEditingCategory(null) }}
      contentClassName="sm:max-w-3xl"
    >
      {editingCategory ? <div className="grid gap-4 overflow-y-auto px-5 pb-6">
        <p className="text-sm text-muted-foreground">This photo appears on the store category card. It is independent from every product photo in this category.</p>
        <CatalogImageEditor
          label={`${editingCategory.name} category photo`}
          imageUrl={editingCategory.imageUrl ?? ''}
          attachmentId={editingCategory.attachmentId ?? ''}
          customerId={editingCategory.customerId ?? activeCustomerId}
          emptyIcon={categoryEmoji(editingCategory.name)}
          disabled={!canEdit}
          uploading={uploading}
          onUpload={uploadImage}
        />
      </div> : null}
    </AppDrawer>
  </>
}
