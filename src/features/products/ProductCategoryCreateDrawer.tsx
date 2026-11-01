import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectInputAsync } from '@/components/ui/select-input'
import { createProductCategoryRequest } from '@/features/products/api'
import { getCustomersListRequest } from '@/features/customers/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import type { Customer } from '@/types/customer'
import type { ProductCategory } from '@/types/product'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

export function ProductCategoryCreateDrawer({
  open,
  onOpenChange,
  isAdmin,
  customerId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isAdmin: boolean
  customerId: string
  onCreated: (category: ProductCategory) => Promise<void>
}) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [name, setName] = useState('')
  const [vatPercent, setVatPercent] = useState('')
  const [saving, setSaving] = useState(false)
  const effectiveCustomerId = isAdmin ? customer?.id ?? '' : customerId

  const reset = () => {
    setCustomer(null)
    setName('')
    setVatPercent('')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!effectiveCustomerId || saving) return
    const parsedVat = Number(vatPercent)
    if (!Number.isFinite(parsedVat) || parsedVat < 0 || parsedVat > 100) {
      toast.error('Enter a VAT rate between 0% and 100%.')
      return
    }
    setSaving(true)
    try {
      const category = await createProductCategoryRequest(effectiveCustomerId, { name: name.trim(), vatRate: parsedVat / 100 })
      toast.success('Category created.')
      await onCreated(category)
      reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the category.')
    } finally {
      setSaving(false)
    }
  }

  return <AppDrawer
    open={open}
    onOpenChange={(nextOpen) => { if (!nextOpen) reset(); onOpenChange(nextOpen) }}
    title="Add category"
    description="Add a category to a customer’s store catalog."
    contentClassName="sm:max-w-lg"
  >
    {({ containerRef }) => <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
        {isAdmin ? <SelectInputAsync<Customer>
          label="Customer"
          placeholder="Search customers"
          required
          queryKey={[...customersQueryKeys.all, 'category-create']}
          queryFn={(search) => getCustomersListRequest({ contractId: null }, search)}
          getOption={(item) => ({ value: item.id, label: item.name })}
          selectedItems={customer ? [customer] : []}
          value={customer?.id ?? ''}
          onValueChange={() => setCustomer(null)}
          onSelectedItemsChange={(items) => setCustomer(items[0] ?? null)}
          container={containerRef}
        /> : null}
        <Field label="Name"><Input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="VAT rate (%)"><Input required type="number" min="0" max="100" step="0.01" value={vatPercent} onChange={(event) => setVatPercent(event.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-5">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || !name.trim() || !effectiveCustomerId}>{saving ? 'Creating…' : 'Add category'}</Button>
      </div>
    </form>}
  </AppDrawer>
}
