import { useEffect, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { SelectInput, SelectInputAsync } from '@/components/ui/select-input'
import { addClassTypeProductRequest, getClassTypeProductOptionsRequest, updateClassTypeProductRequest, type ClassTypeProduct, type ClassTypeProductKind, type ClassTypeProductOption } from '@/features/classes/api'

const kindOptions = [
  { value: 'REQUIRED', label: 'Required for this class' },
  { value: 'RECOMMENDED', label: 'Recommended' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

export function ClassTypeProductDrawer({
  classTypeId,
  locationId,
  linkedProduct,
  open,
  onOpenChange,
}: {
  classTypeId: string
  locationId: string
  linkedProduct: ClassTypeProduct | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [productId, setProductId] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<ClassTypeProductOption[]>([])
  const [kind, setKind] = useState<ClassTypeProductKind>('RECOMMENDED')
  const [isSaving, setIsSaving] = useState(false)
  const queryKey = ['class-types', classTypeId, 'products', locationId] as const

  useEffect(() => {
    if (!open) return
    setProductId('')
    setSelectedProducts([])
    setKind(linkedProduct?.kind ?? 'RECOMMENDED')
  }, [open, linkedProduct])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!linkedProduct && !productId) {
      toast.error('Select a product.')
      return
    }
    setIsSaving(true)
    try {
      if (linkedProduct) {
        await updateClassTypeProductRequest(classTypeId, locationId, linkedProduct.productId, kind)
      } else {
        await addClassTypeProductRequest(classTypeId, locationId, productId, kind)
      }
      await queryClient.invalidateQueries({ queryKey })
      toast.success(linkedProduct ? 'Class product updated.' : 'Product linked to this class.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the class product.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={linkedProduct ? 'Edit linked product' : 'Add a product'}
      description="Link a customer product to this class. Availability, price, and stock are checked at the active location when the assistant responds."
      contentClassName="sm:max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
          {linkedProduct ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{linkedProduct.productName}</div>
              <div className="text-muted-foreground">{linkedProduct.productTypeName ?? 'Product'} · {linkedProduct.productId}</div>
            </div>
          ) : (
            <Field label="Product">
              <SelectInputAsync<ClassTypeProductOption>
                aria-label="Product"
                placeholder="Search customer products…"
                value={productId}
                selectedItems={selectedProducts}
                queryKey={['class-types', classTypeId, 'product-options', locationId]}
                queryFn={(search) => getClassTypeProductOptionsRequest(classTypeId, locationId, search)}
                getOption={(option) => ({ value: option.id, label: `${option.name}${option.productTypeName ? ` · ${option.productTypeName}` : ''}` })}
                onValueChange={(value) => setProductId(String(value ?? ''))}
                onSelectedItemsChange={setSelectedProducts}
                emptyMessage="No active, sellable products found for this customer."
              />
            </Field>
          )}
          <Field label="How should the assistant present it?">
            <SelectInput
              aria-label="Product relevance"
              items={kindOptions}
              value={kind}
              onValueChange={(value) => setKind(String(value) as ClassTypeProductKind)}
            />
          </Field>
          <p className="text-sm text-muted-foreground">
            “Required” means members need to bring or use this item. If it is available at the active location, the assistant will tell them they can buy it there and offer to help place an order. It will only start the purchase if they choose to buy.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button type="submit" disabled={isSaving || (!linkedProduct && !productId)}>{isSaving ? 'Saving…' : linkedProduct ? 'Save changes' : 'Add product'}</Button>
        </div>
      </form>
    </AppDrawer>
  )
}
