import EyeIcon from '@hugeicons/core-free-icons/EyeIcon'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getProductManagementRequest } from '@/features/products/api'
import { productsQueryKeys } from '@/features/products/query-keys'
import type { Product } from '@/types/product'

function formatPrice(value: number | string | null | undefined, currency: string) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value))
}

export function ProductScopeCell({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const customerId = product.customerId ?? product.organizationId ?? product.customer.id
  const query = useQuery({
    queryKey: [...productsQueryKeys.detail(product.id), 'scope'],
    queryFn: () => getProductManagementRequest(product.id, customerId),
    enabled: open,
  })
  const detail = query.data ?? product
  const locations = detail.locations ?? []
  const currency = detail.customer?.currency ?? 'EUR'

  const renderOverrides = (assignment: NonNullable<Product['locations']>[number]) => {
    const variantById = new Map((detail.variants ?? []).map((variant) => [variant.id, variant]))
    return (assignment.variantOverrides ?? []).flatMap((override) => {
      const variant = variantById.get(override.variantId)
      const hasPrice = override.priceOverride != null
      const hasStock = override.stockOverride != null
      if (override.isAvailable && !hasPrice && !hasStock) return []
      return [
        <p key={override.variantId} className="mt-1 text-muted-foreground">
          {variant?.sku || variant?.id || 'Variant'}
          {!override.isAvailable ? ' · Unavailable' : ''}
          {hasPrice ? ` · ${formatPrice(override.priceOverride, currency)}` : ''}
          {hasStock ? ` · Stock ${override.stockOverride === -1 ? 'unlimited' : override.stockOverride}` : ''}
        </p>,
      ]
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      <span>{product.scope ?? 'ALL'}</span>
      <Tooltip>
        <TooltipTrigger render={<Button variant="ghost" size="icon-xs" aria-label={`View ${product.scope ?? 'ALL'} product scope`} onClick={(event) => { event.stopPropagation(); setOpen(true) }}><HugeiconsIcon icon={EyeIcon} strokeWidth={2} className="size-3.5" /></Button>} />
        <TooltipContent>View location visibility</TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader showCloseButton>
            <DialogTitle>{product.name} visibility</DialogTitle>
            <DialogDescription>{detail.scope === 'SPECIFIC' ? 'Visible only at selected locations.' : 'Visible at every location of this customer.'}</DialogDescription>
          </DialogHeader>
          {query.isFetching ? <p className="py-3 text-sm text-muted-foreground">Loading locations...</p> : null}
          {query.isError ? <p className="py-3 text-sm text-destructive">Failed to load product visibility.</p> : null}
          {!query.isFetching && !query.isError ? (
            detail.scope === 'SPECIFIC' ? (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {locations.filter((location) => location.isInScope).map((assignment) => (
                  <div key={assignment.locationId} className="rounded-lg border p-3 text-sm">
                    {assignment.location?.id
                      ? <Link to={`/locations/${assignment.location.id}`} className="font-medium underline-offset-2 hover:underline">{assignment.location.name ?? assignment.location.id}</Link>
                      : <span className="font-medium">{assignment.location?.name ?? assignment.locationId}</span>}
                    {!assignment.isAvailable ? <p className="mt-1 text-muted-foreground">Temporarily unavailable</p> : null}
                    {renderOverrides(assignment)}
                  </div>
                ))}
                {!locations.some((location) => location.isInScope) ? <p className="rounded-lg border p-3 text-sm text-muted-foreground">No locations assigned.</p> : null}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="rounded-lg border p-3 text-sm text-muted-foreground">Available throughout {detail.customer?.name ?? detail.customerName ?? 'this customer'}.</p>
                {locations.filter((location) => location.hasOverrides).map((assignment) => (
                  <div key={assignment.locationId} className="rounded-lg border p-3 text-sm">
                    {assignment.location?.id
                      ? <Link to={`/locations/${assignment.location.id}`} className="font-medium underline-offset-2 hover:underline">{assignment.location.name ?? assignment.location.id}</Link>
                      : <span className="font-medium">{assignment.location?.name ?? assignment.locationId}</span>}
                    {assignment.isAvailable === false ? <p className="mt-1 text-muted-foreground">Unavailable at this location</p> : null}
                    {renderOverrides(assignment)}
                  </div>
                ))}
                {!locations.some((location) => location.hasOverrides) ? <p className="rounded-lg border p-3 text-sm text-muted-foreground">No location-specific overrides.</p> : null}
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
