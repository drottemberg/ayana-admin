import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  productLocationQueryKeys,
  getProductLocationSettingsForProductRequest,
  setProductLocationAvailabilityRequest,
  setProductVariantLocationConfigRequest,
  type ProductLocationSettings,
} from '@/features/products/location-products'
import { productsQueryKeys } from '@/features/products/query-keys'

type VariantForm = { isAvailable: boolean; priceOverride: string; stockOverride: string }

export function ProductLocationSettingsDrawer({
  product,
  locationId,
  customerId,
  currency = 'EUR',
  open,
  onOpenChange,
}: {
  product: ProductLocationSettings | null
  locationId: string
  customerId?: string
  currency?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: [...productLocationQueryKeys.location(locationId), 'product', product?.id],
    queryFn: () => getProductLocationSettingsForProductRequest(locationId, product!.id, customerId),
    enabled: open && Boolean(locationId && product?.id),
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const settings = settingsQuery.isFetching || settingsQuery.isError ? null : settingsQuery.data ?? null
  const [isAvailable, setIsAvailable] = useState(true)
  const [variants, setVariants] = useState<Record<string, VariantForm>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open || !settings) return
    setIsAvailable(settings.isAvailable)
    setVariants(
      Object.fromEntries(
        settings.variants.map((variant) => [
          variant.id,
          {
            isAvailable: variant.isAvailable,
            priceOverride: variant.isPriceOverridden ? String(variant.price) : '',
            stockOverride: variant.isStockOverridden ? String(variant.stock) : '',
          },
        ]),
      ),
    )
  }, [open, settings])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!settings) return
    for (const value of Object.values(variants)) {
      if (
        value.priceOverride !== '' &&
        (!Number.isFinite(Number(value.priceOverride)) || Number(value.priceOverride) < 0)
      ) {
        toast.error('Variant price must be zero or greater.')
        return
      }
      if (
        value.stockOverride !== '' &&
        (!Number.isInteger(Number(value.stockOverride)) || Number(value.stockOverride) < -1)
      ) {
        toast.error('Stock must be -1 (unlimited) or a non-negative integer.')
        return
      }
    }

    setIsSaving(true)
    try {
      await setProductLocationAvailabilityRequest(locationId, settings.id, isAvailable, customerId)
      await Promise.all(
        settings.variants.map((variant) => {
          const value = variants[variant.id]
          return setProductVariantLocationConfigRequest(
            locationId,
            variant.id,
            {
              isAvailable: value.isAvailable,
              priceOverride: value.priceOverride === '' ? null : Number(value.priceOverride),
              stockOverride: value.stockOverride === '' ? null : Number(value.stockOverride),
            },
            customerId,
          )
        }),
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productLocationQueryKeys.location(locationId) }),
        queryClient.invalidateQueries({ queryKey: productsQueryKeys.all }),
      ])
      toast.success('Location product settings saved.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save location product settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Location product settings"
      description={settings?.name ?? product?.name}
      contentClassName="sm:max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-3">
          {settingsQuery.isFetching ? <p className="text-sm text-muted-foreground">Loading current location settings...</p> : null}
          {settingsQuery.isError ? <p className="text-sm text-destructive">Could not load current location settings.</p> : null}
          {settings ? <>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isAvailable} onChange={(event) => setIsAvailable(event.target.checked)} />
            Product available at this location
          </label>
          {settings.variants.map((variant) => {
            const value = variants[variant.id]
            if (!value) return null
            return (
              <section
                key={variant.id}
                className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[minmax(0,1fr)_1fr_1fr]"
              >
                <div className="md:col-span-3">
                  <h3 className="font-medium">Variant {variant.name} ({variant.id})</h3>
                  <p className="text-xs text-muted-foreground">
                    Customer defaults:{' '}
                    {new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(variant.basePrice)} ·
                    stock {variant.baseStock === -1 ? 'unlimited' : variant.baseStock}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium md:col-span-3">
                  <input
                    type="checkbox"
                    checked={value.isAvailable}
                    onChange={(event) =>
                      setVariants((current) => ({
                        ...current,
                        [variant.id]: { ...current[variant.id], isAvailable: event.target.checked },
                      }))
                    }
                  />
                  Variant available
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  <span>Price override</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={`Inherit ${variant.basePrice.toFixed(2)}`}
                    value={value.priceOverride}
                    onChange={(event) =>
                      setVariants((current) => ({
                        ...current,
                        [variant.id]: { ...current[variant.id], priceOverride: event.target.value },
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  <span>Stock override</span>
                  <Input
                    type="number"
                    min="-1"
                    step="1"
                    placeholder={`Inherit ${variant.baseStock === -1 ? 'unlimited' : variant.baseStock}`}
                    value={value.stockOverride}
                    onChange={(event) =>
                      setVariants((current) => ({
                        ...current,
                        [variant.id]: { ...current[variant.id], stockOverride: event.target.value },
                      }))
                    }
                  />
                </label>
              </section>
            )
          })}
          {!settings.variants.length ? (
            <p className="text-sm text-muted-foreground">This product has no active variants.</p>
          ) : null}
          </> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving || settingsQuery.isFetching || settingsQuery.isError || !settings}>
            {isSaving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </form>
    </AppDrawer>
  )
}
