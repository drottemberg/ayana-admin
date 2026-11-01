import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateProductCategoryRequest } from '@/features/products/api'
import type { ProductCategory } from '@/types/product'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

export function ProductCategoryEditDrawer({
  category,
  open,
  onOpenChange,
  onSaved,
}: {
  category: ProductCategory | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [vatPercent, setVatPercent] = useState('')
  const [position, setPosition] = useState('1')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !category) return
    setName(category.name)
    setVatPercent(String(Number(category.vatRate) * 100))
    setPosition(String(Number(category.sortOrder ?? 0) + 1))
    setIsActive(category.isActive ?? true)
  }, [category, open])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!category || saving) return
    const parsedVat = Number(vatPercent)
    const parsedPosition = Number(position)
    if (!Number.isFinite(parsedVat) || parsedVat < 0 || parsedVat > 100) {
      toast.error('Enter a VAT rate between 0% and 100%.')
      return
    }
    if (!Number.isInteger(parsedPosition) || parsedPosition < 1) {
      toast.error('Position must be a positive whole number.')
      return
    }
    setSaving(true)
    try {
      await updateProductCategoryRequest(category, { name: name.trim(), vatRate: parsedVat / 100, isActive, position: parsedPosition })
      toast.success('Category updated.')
      await onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the category.')
    } finally {
      setSaving(false)
    }
  }

  return <AppDrawer
    open={open}
    onOpenChange={onOpenChange}
    title="Edit category"
    description={category?.customerName ? `Customer · ${category.customerName}` : undefined}
    contentClassName="sm:max-w-lg"
  >
    <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
        <Field label="Name"><Input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="VAT rate (%)"><Input required type="number" min="0" max="100" step="0.01" value={vatPercent} onChange={(event) => setVatPercent(event.target.value)} /></Field>
        <Field label="Position"><Input required type="number" min="1" step="1" value={position} onChange={(event) => setPosition(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">Position in this customer’s category list.</span></Field>
        <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Active
        </label>
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-5">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </form>
  </AppDrawer>
}
