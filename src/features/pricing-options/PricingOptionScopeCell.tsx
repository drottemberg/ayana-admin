import EyeIcon from '@hugeicons/core-free-icons/EyeIcon'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getPricingOptionRequest } from '@/features/pricing-options/api'
import { pricingOptionsQueryKeys } from '@/features/pricing-options/query-keys'
import type { PricingOption, PricingOptionLocation } from '@/types/pricing-option'

function formatPrice(amount: number | string | null | undefined, currency: string) {
  if (amount == null || !Number.isFinite(Number(amount))) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount))
}

function locationName(location: PricingOptionLocation) {
  return location.location?.name ?? location.locationId
}

export function PricingOptionScopeCell({ option, customerId }: { option: PricingOption; customerId: string }) {
  const [open, setOpen] = useState(false)
  const details = useQuery({
    queryKey: pricingOptionsQueryKeys.detail(customerId, option.id),
    queryFn: () => getPricingOptionRequest(customerId, option.id),
    enabled: open,
  })
  const displayedOption = details.data ?? option

  return (
    <div className="flex items-center gap-1.5">
      <span>{option.scope}</span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`View ${option.scope.toLowerCase()} pricing scope`}
              onClick={(event) => {
                event.stopPropagation()
                setOpen(true)
              }}
            >
              <HugeiconsIcon icon={EyeIcon} strokeWidth={2} className="size-3.5" />
            </Button>
          }
        />
        <TooltipContent>View scope details</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader showCloseButton>
            <DialogTitle>{option.name} scope</DialogTitle>
            <DialogDescription>
              {displayedOption.scope === 'ALL'
                ? 'Available at every location of this customer.'
                : 'Available only at the selected locations below.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Base price</span>
                <span className="font-medium">{formatPrice(displayedOption.price, displayedOption.currency)}</span>
              </div>
            </div>

            {details.isFetching ? <p className="py-3 text-sm text-muted-foreground">Loading scope details...</p> : null}
            {details.isError ? <p className="py-3 text-sm text-destructive">Failed to load scope details.</p> : null}
            {!details.isFetching && !details.isError ? (
              displayedOption.locations.length ? (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {displayedOption.locations.map((location) => {
                    const hasOverride = location.priceOverride != null || Boolean(location.currencyOverride)
                    const currency = location.currencyOverride ?? displayedOption.currency
                    const price = location.priceOverride ?? displayedOption.price

                    return (
                      <div key={location.locationId} className="rounded-lg border p-3 text-sm">
                        <div className="font-medium">
                          {location.location?.id
                            ? <Link to={`/locations/${location.location.id}`} className="underline-offset-2 hover:underline">{locationName(location)}</Link>
                            : locationName(location)}
                        </div>
                        {hasOverride ? (
                          <div className="mt-1 text-muted-foreground">
                            Override: {formatPrice(price, currency)}
                          </div>
                        ) : displayedOption.scope === 'SPECIFIC' ? (
                          <div className="mt-1 text-muted-foreground">Uses the base price</div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : displayedOption.scope === 'ALL' ? (
                <p className="rounded-lg border p-3 text-sm text-muted-foreground">No location-specific price overrides.</p>
              ) : (
                <p className="rounded-lg border p-3 text-sm text-muted-foreground">No locations assigned.</p>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
