import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { SelectInput } from '@/components/ui/select-input'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { getProductManagementRequest, updateProductManagementRequest } from '@/features/products/api'
import { productLocationQueryKeys } from '@/features/products/location-products'
import { productsQueryKeys } from '@/features/products/query-keys'
import type {
  Product,
  ProductAttribute,
  ProductModifierGroup,
  ProductVariant,
  UpdateProductManagementPayload,
} from '@/types/product'

type ProductEditDrawerProps = {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  addSection?: 'variants' | 'options' | null
  focusSection?: 'variants' | 'options' | null
  addOptionGroupId?: string | null
}

function numberValue(event: ChangeEvent<HTMLInputElement>, fallback = 0) {
  const value = event.target.value
  if (!value.trim()) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}

export function ProductEditDrawer({
  product,
  open,
  onOpenChange,
  addSection,
  focusSection,
  addOptionGroupId,
}: ProductEditDrawerProps) {
  const queryClient = useQueryClient()
  const customerId = product?.customerId ?? product?.organizationId ?? product?.customer.id ?? ''
  const details = useQuery({
    queryKey: [...productsQueryKeys.detail(product?.id ?? ''), 'management'],
    queryFn: () => getProductManagementRequest(product!.id, customerId),
    enabled: open && Boolean(product?.id && customerId),
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [productTypeId, setProductTypeId] = useState('')
  const [vatRatePercent, setVatRatePercent] = useState('')
  const [isOnline, setIsOnline] = useState(false)
  const [isInStore, setIsInStore] = useState(true)
  const [isSellable, setIsSellable] = useState(true)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [modifierGroups, setModifierGroups] = useState<ProductModifierGroup[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const initializedKey = useRef('')
  const variantsSectionRef = useRef<HTMLElement>(null)
  const optionsSectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) {
      initializedKey.current = ''
      return
    }
    const data = details.data
    if (!data || details.isFetching) return
    const key = `${data.id}:${addSection ?? 'edit'}:${focusSection ?? ''}:${addOptionGroupId ?? ''}`
    if (initializedKey.current === key) return
    initializedKey.current = key
    setName(data.name)
    setDescription(data.description ?? '')
    setProductTypeId(data.productType?.id ?? '')
    setVatRatePercent(data.vatRate == null ? '' : String(Number(data.vatRate) * 100))
    setIsOnline(data.isOnline ?? false)
    setIsInStore(data.isInStore ?? true)
    setIsSellable(data.isSellable ?? true)
    setVariants([
      ...(data.variants ?? []).map((variant) => ({ ...variant, attributes: [...(variant.attributes ?? [])] })),
      ...(addSection === 'variants'
        ? [{ sku: '', price: 0, stock: -1, barcode: '', isActive: true, attributes: [] }]
        : []),
    ])
    setModifierGroups([
      ...(data.modifierGroups ?? []).map((group) => ({
        ...group,
        modifiers: [
          ...group.modifiers.map((modifier) => ({ ...modifier })),
          ...(group.id === addOptionGroupId
            ? [{ name: '', price: 0, isDefault: false, isActive: true, priceOverride: null, isAvailable: true }]
            : []),
        ],
      })),
      ...(addSection === 'options'
        ? [{ name: '', isRequired: false, minSelect: 0, maxSelect: 1, isActive: true, modifiers: [] }]
        : []),
    ])
  }, [addSection, details.data, details.isFetching, open])

  useEffect(() => {
    const targetSection = addSection ?? focusSection
    if (!open || !details.data || !targetSection) return
    const timeout = window.setTimeout(() => {
      ;(targetSection === 'variants' ? variantsSectionRef : optionsSectionRef).current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 100)
    return () => window.clearTimeout(timeout)
  }, [addSection, details.data, focusSection, open])

  const setVariant = (index: number, patch: Partial<ProductVariant>) => {
    setVariants((current) =>
      current.map((variant, variantIndex) => (variantIndex === index ? { ...variant, ...patch } : variant)),
    )
  }
  const setVariantAttribute = (variantIndex: number, attributeIndex: number, patch: Partial<ProductAttribute>) => {
    setVariants((current) =>
      current.map((variant, index) =>
        index !== variantIndex
          ? variant
          : {
              ...variant,
              attributes: (variant.attributes ?? []).map((attribute, valueIndex) =>
                valueIndex === attributeIndex ? { ...attribute, ...patch } : attribute,
              ),
            },
      ),
    )
  }
  const setGroup = (groupIndex: number, patch: Partial<ProductModifierGroup>) => {
    setModifierGroups((current) =>
      current.map((group, index) => (index === groupIndex ? { ...group, ...patch } : group)),
    )
  }
  const setModifier = (
    groupIndex: number,
    modifierIndex: number,
    patch: Partial<ProductModifierGroup['modifiers'][number]>,
  ) => {
    setModifierGroups((current) =>
      current.map((group, index) =>
        index !== groupIndex
          ? group
          : {
              ...group,
              modifiers: group.modifiers.map((modifier, optionIndex) =>
                optionIndex === modifierIndex ? { ...modifier, ...patch } : modifier,
              ),
            },
      ),
    )
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!product) return
    if (!name.trim()) {
      toast.error('Product name is required.')
      return
    }
    setIsSaving(true)
    const payload: UpdateProductManagementPayload = {
      name: name.trim(),
      description: description.trim() || null,
      productTypeId: productTypeId || undefined,
      vatRate: vatRatePercent.trim() ? Number(vatRatePercent) / 100 : null,
      isOnline,
      isInStore,
      isSellable,
      variants: variants.map((variant) => ({
        ...variant,
        sku: variant.sku?.trim() || null,
        barcode: variant.barcode?.trim() || null,
        attributes: (variant.attributes ?? []).filter((attribute) => attribute.name.trim() && attribute.value.trim()),
      })),
      modifierGroups: modifierGroups.map((group) => ({
        ...group,
        name: group.name.trim(),
        modifiers: group.modifiers.map((modifier) => ({ ...modifier, name: modifier.name.trim() })),
      })),
    }
    try {
      await updateProductManagementRequest(product, payload)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: productLocationQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ])
      toast.success('Product and associated catalog options saved.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save this product.')
    } finally {
      setIsSaving(false)
    }
  }

  const currency = details.data?.customer?.currency ?? ''
  const selectedProductType = details.data?.productTypes?.find((type) => type.id === productTypeId)
  const inheritedVatRate = selectedProductType?.vatRate == null ? null : Number(selectedProductType.vatRate) * 100

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit product"
      description={product?.name}
      contentClassName="sm:max-w-3xl"
    >
      <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {details.isLoading || details.isFetching ? <p className="text-sm text-muted-foreground">Loading product and its modules…</p> : null}
          {details.isError ? <p className="text-sm text-destructive">Could not load the product details.</p> : null}
          {details.data && !details.isFetching ? (
            <>
              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Product information</h3>
                <TextInput label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
                <label className="grid gap-1.5 text-sm font-medium">
                  Description
                  <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
                </label>
                <SelectInput
                  label="Category"
                  placeholder="Select category"
                  items={(details.data.productTypes ?? []).map((type) => ({ value: type.id, label: type.name }))}
                  value={productTypeId}
                  onValueChange={(value) => setProductTypeId(String(value))}
                  searchable
                />
                <label className="grid gap-1.5 text-sm font-medium">
                  VAT rate (%)
                  <input
                    aria-label="VAT rate (%)"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder={inheritedVatRate == null ? 'Set a VAT rate' : `${inheritedVatRate}% (category default)`}
                    value={vatRatePercent}
                    onChange={(event) => setVatRatePercent(event.target.value)}
                  />
                  <span className="text-xs font-normal text-muted-foreground">
                    Product variant prices include VAT. Leave empty to use the category rate{inheritedVatRate == null ? '.' : ` (${inheritedVatRate}%).`}
                  </span>
                </label>
                <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-lg border p-3">
                  <Toggle label="Available online" checked={isOnline} onChange={setIsOnline} />
                  <Toggle label="Available in store" checked={isInStore} onChange={setIsInStore} />
                  <Toggle label="Can be sold" checked={isSellable} onChange={setIsSellable} />
                </div>
              </section>

              <section ref={variantsSectionRef} className="scroll-mt-4 space-y-3 border-t pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Variants and prices</h3>
                    <p className="text-xs text-muted-foreground">
                      Base prices are shared by this customer. Locations can override them.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setVariants((current) => [
                        ...current,
                        { sku: '', price: 0, stock: -1, barcode: '', isActive: true, attributes: [] },
                      ])
                    }
                  >
                    Add variant
                  </Button>
                </div>
                {!variants.length ? (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No variants yet. Add a variant to set a price.
                  </p>
                ) : null}
                {variants.map((variant, index) => (
                  <div key={variant.id ?? `new-variant-${index}`} className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {variant.attributes?.map((attribute) => `${attribute.name}: ${attribute.value}`).join(' · ') ||
                          'Default variant'}
                      </span>
                      {variant.id ? (
                        <Toggle
                          label="Active"
                          checked={variant.isActive}
                          onChange={(checked) => setVariant(index, { isActive: checked })}
                        />
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setVariants((current) => current.filter((_, row) => row !== index))}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextInput
                        label="SKU"
                        value={variant.sku ?? ''}
                        onChange={(event) => setVariant(index, { sku: event.target.value })}
                      />
                      <TextInput
                        label={`Price${currency ? ` (${currency})` : ''}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={variant.price}
                        onChange={(event) => setVariant(index, { price: numberValue(event) })}
                        required
                      />
                      <TextInput
                        label="Stock (−1 = unlimited)"
                        type="number"
                        min="-1"
                        step="1"
                        value={variant.stock}
                        onChange={(event) => setVariant(index, { stock: numberValue(event, -1) })}
                      />
                      <TextInput
                        label="Barcode"
                        value={variant.barcode ?? ''}
                        onChange={(event) => setVariant(index, { barcode: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Variant attributes</span>
                        <Button
                          type="button"
                          variant="link"
                          size="xs"
                          onClick={() =>
                            setVariant(index, { attributes: [...(variant.attributes ?? []), { name: '', value: '' }] })
                          }
                        >
                          Add attribute
                        </Button>
                      </div>
                      {(variant.attributes ?? []).map((attribute, attributeIndex) => (
                        <div
                          key={`${index}-${attributeIndex}`}
                          className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
                        >
                          <TextInput
                            label="Attribute"
                            placeholder="Size"
                            value={attribute.name}
                            onChange={(event) =>
                              setVariantAttribute(index, attributeIndex, { name: event.target.value })
                            }
                          />
                          <TextInput
                            label="Value"
                            placeholder="12 oz"
                            value={attribute.value}
                            onChange={(event) =>
                              setVariantAttribute(index, attributeIndex, { value: event.target.value })
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Remove attribute"
                            onClick={() =>
                              setVariant(index, {
                                attributes: (variant.attributes ?? []).filter((_, row) => row !== attributeIndex),
                              })
                            }
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>

              <section ref={optionsSectionRef} className="scroll-mt-4 space-y-3 border-t pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Option groups and supplements</h3>
                    <p className="text-xs text-muted-foreground">
                      Group and option details are shared with any other products using them. Price and availability can
                      be overridden for this product.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setModifierGroups((current) => [
                        ...current,
                        { name: '', isRequired: false, minSelect: 0, maxSelect: 1, isActive: true, modifiers: [] },
                      ])
                    }
                  >
                    Add group
                  </Button>
                </div>
                {!modifierGroups.length ? (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No option groups are linked to this product.
                  </p>
                ) : null}
                {modifierGroups.map((group, groupIndex) => (
                  <div key={group.id ?? `new-group-${groupIndex}`} className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid flex-1 gap-3 sm:grid-cols-2">
                        <TextInput
                          label="Group name"
                          placeholder="Milk"
                          value={group.name}
                          onChange={(event) => setGroup(groupIndex, { name: event.target.value })}
                          required
                        />
                        <div className="flex items-end gap-4 pb-2">
                          <Toggle
                            label="Required"
                            checked={group.isRequired}
                            onChange={(checked) =>
                              setGroup(groupIndex, {
                                isRequired: checked,
                                minSelect: checked ? Math.max(1, group.minSelect) : group.minSelect,
                              })
                            }
                          />
                          <Toggle
                            label="Active"
                            checked={group.isActive}
                            onChange={(checked) => setGroup(groupIndex, { isActive: checked })}
                          />
                        </div>
                        <TextInput
                          label="Minimum selections"
                          type="number"
                          min="0"
                          step="1"
                          value={group.minSelect}
                          onChange={(event) => setGroup(groupIndex, { minSelect: numberValue(event) })}
                        />
                        <TextInput
                          label="Maximum selections"
                          type="number"
                          min="1"
                          step="1"
                          value={group.maxSelect}
                          onChange={(event) => setGroup(groupIndex, { maxSelect: numberValue(event, 1) })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setModifierGroups((current) => current.filter((_, row) => row !== groupIndex))}
                      >
                        Remove group
                      </Button>
                    </div>
                    <div className="space-y-3 border-t pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Options</span>
                        <Button
                          type="button"
                          variant="link"
                          size="xs"
                          onClick={() =>
                            setGroup(groupIndex, {
                              modifiers: [
                                ...group.modifiers,
                                {
                                  name: '',
                                  price: 0,
                                  isDefault: false,
                                  isActive: true,
                                  priceOverride: null,
                                  isAvailable: true,
                                },
                              ],
                            })
                          }
                        >
                          Add option
                        </Button>
                      </div>
                      {group.modifiers.map((modifier, modifierIndex) => (
                        <div
                          key={modifier.id ?? `new-option-${groupIndex}-${modifierIndex}`}
                          className="space-y-2 rounded-md bg-muted/40 p-3"
                        >
                          <div className="grid gap-3 sm:grid-cols-2">
                            <TextInput
                              label="Option"
                              placeholder="Oat milk"
                              value={modifier.name}
                              onChange={(event) => setModifier(groupIndex, modifierIndex, { name: event.target.value })}
                              required
                            />
                            <TextInput
                              label={`Shared price${currency ? ` (${currency})` : ''}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={modifier.price}
                              onChange={(event) =>
                                setModifier(groupIndex, modifierIndex, { price: numberValue(event) })
                              }
                            />
                            <TextInput
                              label={`Product price override${currency ? ` (${currency})` : ''}`}
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Use shared price"
                              value={modifier.priceOverride ?? ''}
                              onChange={(event) =>
                                setModifier(groupIndex, modifierIndex, {
                                  priceOverride: event.target.value.trim() ? numberValue(event) : null,
                                })
                              }
                            />
                            <div className="flex flex-wrap items-end gap-4 pb-2">
                              <Toggle
                                label="Available for this product"
                                checked={modifier.isAvailable}
                                onChange={(checked) => setModifier(groupIndex, modifierIndex, { isAvailable: checked })}
                              />
                              <Toggle
                                label="Default"
                                checked={modifier.isDefault}
                                onChange={(checked) => setModifier(groupIndex, modifierIndex, { isDefault: checked })}
                              />
                              <Toggle
                                label="Shared active"
                                checked={modifier.isActive}
                                onChange={(checked) => setModifier(groupIndex, modifierIndex, { isActive: checked })}
                              />
                            </div>
                          </div>
                          {!modifier.id ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setGroup(groupIndex, {
                                  modifiers: group.modifiers.filter((_, row) => row !== modifierIndex),
                                })
                              }
                            >
                              Remove new option
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t p-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving || details.isLoading || details.isError || !details.data}>
            {isSaving ? 'Saving…' : 'Save product'}
          </Button>
        </div>
      </form>
    </AppDrawer>
  )
}
