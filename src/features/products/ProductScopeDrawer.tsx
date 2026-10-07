import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { SelectInput } from '@/components/ui/select-input'
import { getProductManagementRequest, updateProductScopeRequest } from '@/features/products/api'
import { productLocationQueryKeys } from '@/features/products/location-products'
import { productsQueryKeys } from '@/features/products/query-keys'
import type { Product } from '@/types/product'

export function ProductScopeDrawer({ product, open, onOpenChange }: {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const customerId = product?.customerId ?? product?.organizationId ?? product?.customer.id ?? ''
  const details = useQuery({
    queryKey: [...productsQueryKeys.detail(product?.id ?? ''), 'scope'],
    queryFn: () => getProductManagementRequest(product!.id, customerId),
    enabled: open && Boolean(product?.id && customerId),
  })
  const [scope, setScope] = useState<'ALL' | 'SPECIFIC'>('ALL')
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!details.data) return
    setScope(details.data.scope ?? 'ALL')
    setLocationIds((details.data.locations ?? []).filter((location) => location.isInScope).map((location) => location.locationId))
  }, [details.data])

  const toggleLocation = (locationId: string) => setLocationIds((current) => current.includes(locationId)
    ? current.filter((id) => id !== locationId)
    : [...current, locationId])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!product) return
    if (scope === 'SPECIFIC' && locationIds.length === 0) {
      toast.error('Select at least one location.')
      return
    }
    setIsSaving(true)
    try {
      await updateProductScopeRequest(product, scope, scope === 'SPECIFIC' ? locationIds : [])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: productLocationQueryKeys.all }),
      ])
      toast.success('Product visibility updated.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update product visibility.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} title="Product visibility" description={product?.name} contentClassName="sm:max-w-xl">
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
          <SelectInput
            label="Scope"
            aria-label="Product visibility scope"
            items={[{ value: 'ALL', label: 'All locations' }, { value: 'SPECIFIC', label: 'Specific locations' }]}
            value={scope}
            onValueChange={(value) => setScope(String(value) as 'ALL' | 'SPECIFIC')}
          />
          {scope === 'SPECIFIC' ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Choose the locations where this product is available.</p>
              {details.isFetching ? <p className="text-sm text-muted-foreground">Loading locations...</p> : null}
              {details.isError ? <p className="text-sm text-destructive">Failed to load locations.</p> : null}
              {(details.data?.locations ?? []).map((assignment) => (
                <label key={assignment.locationId} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                  <input type="checkbox" checked={locationIds.includes(assignment.locationId)} onChange={() => toggleLocation(assignment.locationId)} />
                  {assignment.location?.name ?? assignment.locationId}
                </label>
              ))}
              {!details.isFetching && !(details.data?.locations ?? []).length ? <p className="text-sm text-muted-foreground">This customer has no locations.</p> : null}
            </div>
          ) : <p className="rounded-md border p-3 text-sm text-muted-foreground">The product is visible at every location. Each location can still override its price, stock, or availability.</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button type="submit" disabled={isSaving || details.isLoading || !product}>{isSaving ? 'Saving…' : 'Save visibility'}</Button>
        </div>
      </form>
    </AppDrawer>
  )
}
