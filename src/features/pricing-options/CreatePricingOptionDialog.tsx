import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectInput } from '@/components/ui/select-input'
import { Textarea } from '@/components/ui/textarea'
import { getCustomersListRequest } from '@/features/customers/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { getAllLocationsForCustomerRequest } from '@/features/locations/api'
import { createPricingOptionRequest, getClassAccessTargetsRequest, getPricingOptionRequest, getPurchaseBenefitTargetsRequest, updatePricingOptionRequest } from '@/features/pricing-options/api'
import { pricingOptionsQueryKeys } from '@/features/pricing-options/query-keys'
import {
  BillingInterval,
  CreditRefreshInterval,
  PricingOptionScope,
  PricingOptionType,
  type CreatePricingOptionPayload,
  type ClassAccessScope,
  type PricingOption,
  type PurchaseBenefits,
  type PurchaseBenefitRule,
} from '@/types/pricing-option'

const types = [
  { value: PricingOptionType.DROP_IN, label: 'Drop-in' },
  { value: PricingOptionType.CLASS_PACK, label: 'Class pack' },
  { value: PricingOptionType.CAPPED_MEMBERSHIP, label: 'Capped membership' },
  { value: PricingOptionType.UNLIMITED_MEMBERSHIP, label: 'Unlimited membership' },
  { value: PricingOptionType.INTRO_OFFER, label: 'Intro offer' },
]

const intervals = [
  { value: BillingInterval.ONCE, label: 'One time' },
  { value: BillingInterval.WEEKLY, label: 'Weekly' },
  { value: BillingInterval.MONTHLY, label: 'Monthly' },
  { value: BillingInterval.QUARTERLY, label: 'Quarterly' },
  { value: BillingInterval.YEARLY, label: 'Yearly' },
]

const creditRefreshIntervals = [
  { value: CreditRefreshInterval.WEEKLY, label: 'Weekly' },
  { value: CreditRefreshInterval.MONTHLY, label: 'Monthly' },
  { value: CreditRefreshInterval.QUARTERLY, label: 'Quarterly' },
  { value: CreditRefreshInterval.YEARLY, label: 'Yearly' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  )
}

function PercentInput({ value, onValueChange, label, className }: {
  value: number | null | undefined
  onValueChange: (value: number | null) => void
  label: string
  className?: string
}) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  useEffect(() => setDraft(value == null ? '' : String(value)), [value])
  return <Input
    aria-label={label}
    className={className}
    type="number"
    min="0.01"
    max="99.99"
    step="0.01"
    placeholder="0.00"
    value={draft}
    onChange={(event) => {
      const next = event.target.value
      setDraft(next)
      onValueChange(next === '' ? null : Number(next))
    }}
  />
}

function normalizeBenefits(value: PricingOption['purchaseBenefits']): PurchaseBenefits {
  const result: PurchaseBenefits = {}
  for (const kind of ['products', 'pricingOptions'] as const) {
    const rule = value?.[kind] as (PurchaseBenefitRule & { targetIds?: string[] }) | undefined
    if (!rule) continue
    result[kind] = {
      scope: rule.scope,
      ...(rule.scope === 'ALL' ? { percent: rule.percent } : {}),
      ...(rule.scope === 'SPECIFIC' ? { referencePercent: rule.referencePercent ?? rule.percent ?? null } : {}),
      targets: rule.scope === 'SPECIFIC'
        ? rule.targets ?? (rule.targetIds ?? []).map((id) => ({ id, percent: rule.percent ?? 0 }))
        : [],
    }
  }
  return result
}

export function CreatePricingOptionDialog({
  customerId,
  initialCustomerId,
  allowCustomerSelection = false,
  currency = 'EUR',
  option,
  open,
  onOpenChange,
}: {
  customerId?: string
  initialCustomerId?: string
  allowCustomerSelection?: boolean
  currency?: string
  option?: PricingOption
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId ?? initialCustomerId ?? '')
  const effectiveCustomerId = customerId ?? selectedCustomerId
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [vatRatePercent, setVatRatePercent] = useState('20')
  const [selectedCurrency, setSelectedCurrency] = useState(currency)
  const [type, setType] = useState<PricingOptionType>(PricingOptionType.UNLIMITED_MEMBERSHIP)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(BillingInterval.MONTHLY)
  const [scope, setScope] = useState<PricingOptionScope>(PricingOptionScope.ALL)
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
  const [overrides, setOverrides] = useState<Record<string, { enabled: boolean; price: string; currency: string }>>({})
  const [creditsTotal, setCreditsTotal] = useState('')
  const [creditsPerPeriod, setCreditsPerPeriod] = useState('')
  const [creditsRefreshInterval, setCreditsRefreshInterval] = useState<CreditRefreshInterval>(CreditRefreshInterval.MONTHLY)
  const [creditsRollover, setCreditsRollover] = useState(false)
  const [validityDays, setValidityDays] = useState('')
  const [minimumCommitmentMonths, setMinimumCommitmentMonths] = useState('')
  const [classAccessScope, setClassAccessScope] = useState<ClassAccessScope>('ALL')
  const [classTypeIds, setClassTypeIds] = useState<string[]>([])
  const [perksText, setPerksText] = useState('')
  const [purchaseBenefits, setPurchaseBenefits] = useState<PurchaseBenefits>({})
  const [isIntro, setIsIntro] = useState(false)
  const [isSellable, setIsSellable] = useState(true)
  const [isActive, setIsActive] = useState(true)

  const customers = useQuery({
    queryKey: [...customersQueryKeys.all, 'pricing-option-form-customers'],
    queryFn: () => getCustomersListRequest(undefined),
    enabled: open && allowCustomerSelection,
  })
  const selectedCustomer = customers.data?.find((customer) => customer.id === effectiveCustomerId)
  const formCurrency = selectedCustomer?.currency ?? currency

  const optionDetails = useQuery({
    queryKey: pricingOptionsQueryKeys.detail(effectiveCustomerId, option?.id ?? ''),
    queryFn: () => getPricingOptionRequest(effectiveCustomerId, option!.id),
    enabled: open && Boolean(effectiveCustomerId && option?.id),
  })

  const locations = useQuery({
    queryKey: ['locations', 'pricing-option-form', effectiveCustomerId],
    queryFn: () => getAllLocationsForCustomerRequest(effectiveCustomerId),
    enabled: open && Boolean(effectiveCustomerId),
  })
  const benefitTargets = useQuery({
    queryKey: ['pricing-option-benefit-targets', effectiveCustomerId],
    queryFn: () => getPurchaseBenefitTargetsRequest(effectiveCustomerId),
    enabled: open && Boolean(effectiveCustomerId),
  })
  const classAccessTargets = useQuery({
    queryKey: ['pricing-option-class-access-targets', effectiveCustomerId],
    queryFn: () => getClassAccessTargetsRequest(effectiveCustomerId),
    enabled: open && Boolean(effectiveCustomerId),
  })

  useEffect(() => {
    setSelectedCustomerId(customerId ?? initialCustomerId ?? '')
  }, [customerId, initialCustomerId])

  useEffect(() => {
    if (!open) return
    const source = optionDetails.data ?? option
    setName(source?.name ?? '')
    setDescription(source?.description ?? '')
    setPrice(source ? String(source.price) : '')
    setVatRatePercent(source ? String(Number(source.vatRate ?? 0.2) * 100) : '20')
    setSelectedCurrency(source?.currency ?? formCurrency)
    setType(source?.type ?? PricingOptionType.UNLIMITED_MEMBERSHIP)
    setBillingInterval(source?.billingInterval ?? BillingInterval.MONTHLY)
    setScope(source?.scope ?? PricingOptionScope.ALL)
    setSelectedLocationIds(source?.scope === PricingOptionScope.SPECIFIC ? source.locations.map((item) => item.locationId) : [])
    setOverrides(Object.fromEntries((source?.locations ?? []).map((item) => [item.locationId, {
      enabled: item.priceOverride != null || Boolean(item.currencyOverride),
      price: item.priceOverride == null ? String(source?.price ?? '') : String(item.priceOverride),
      currency: item.currencyOverride ?? source?.currency ?? formCurrency,
    }])))
    setCreditsTotal(source?.creditsTotal == null ? '' : String(source.creditsTotal))
    setCreditsPerPeriod(source?.creditsPerPeriod == null ? '' : String(source.creditsPerPeriod))
    setCreditsRefreshInterval(source?.creditsRefreshInterval ?? CreditRefreshInterval.MONTHLY)
    setCreditsRollover(source?.creditsRollover ?? false)
    setValidityDays(source?.validityDays == null ? '' : String(source.validityDays))
    setMinimumCommitmentMonths(source?.minimumCommitmentMonths == null ? '' : String(source.minimumCommitmentMonths))
    setClassAccessScope(source?.classAccessScope ?? 'ALL')
    setClassTypeIds(source?.classTypeIds ?? [])
    setPerksText((source?.perks ?? []).join('\n'))
    setPurchaseBenefits(normalizeBenefits(source?.purchaseBenefits))
    setIsIntro(source?.isIntro ?? false)
    setIsSellable(source?.isSellable ?? true)
    setIsActive(source?.isActive ?? true)
  }, [formCurrency, open, option?.id, optionDetails.data, effectiveCustomerId])

  const createPricingOption = useMutation({
    mutationFn: (payload: CreatePricingOptionPayload) => option
      ? updatePricingOptionRequest(effectiveCustomerId, option.id, payload)
      : createPricingOptionRequest(effectiveCustomerId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: pricingOptionsQueryKeys.all })
      toast.success(option ? 'Pricing option updated.' : 'Pricing option created.')
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to save pricing option.'),
  })

  const toggleLocation = (locationId: string) => {
    setSelectedLocationIds((current) =>
      current.includes(locationId) ? current.filter((id) => id !== locationId) : [...current, locationId],
    )
  }

  const updateBenefit = (kind: keyof PurchaseBenefits, value?: PurchaseBenefitRule) => {
    setPurchaseBenefits((current) => {
      const next = { ...current }
      if (value) next[kind] = value
      else delete next[kind]
      return next
    })
  }

  const getOverride = (locationId: string) =>
    overrides[locationId] ?? { enabled: false, price, currency: selectedCurrency }

  const setLocationOverride = (
    locationId: string,
    fields: Partial<{ enabled: boolean; price: string; currency: string }>,
  ) => {
    setOverrides((current) => ({
      ...current,
      [locationId]: { ...(current[locationId] ?? { enabled: false, price, currency: selectedCurrency }), ...fields },
    }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!effectiveCustomerId) {
      toast.error('Select a customer for this pricing option.')
      return
    }
    const numericPrice = Number(price)
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      toast.error('Enter a valid price.')
      return
    }
    const numericVatRate = Number(vatRatePercent)
    if (!Number.isFinite(numericVatRate) || numericVatRate < 0 || numericVatRate > 100) {
      toast.error('Enter a VAT rate between 0% and 100%.')
      return
    }
    if (type === PricingOptionType.CAPPED_MEMBERSHIP) {
      const numericCredits = Number(creditsPerPeriod)
      if (!Number.isFinite(numericCredits) || numericCredits <= 0) {
        toast.error('Enter the credit allowance granted at each refresh.')
        return
      }
    }
    const optionalIntegerFields = [
      { label: 'Validity days', value: validityDays },
      { label: 'Minimum commitment months', value: minimumCommitmentMonths },
    ]
    for (const field of optionalIntegerFields) {
      if (!field.value) continue
      const value = Number(field.value)
      if (!Number.isInteger(value) || value < 1) {
        toast.error(`${field.label} must be a positive whole number.`)
        return
      }
    }
    if (scope === PricingOptionScope.SPECIFIC && selectedLocationIds.length === 0) {
      toast.error('Select at least one location for a specific scope.')
      return
    }
    if (classAccessScope === 'SPECIFIC' && classTypeIds.length === 0) {
      toast.error('Select at least one class covered by this plan.')
      return
    }
    for (const [kind, benefit] of Object.entries(purchaseBenefits)) {
      const percentages = benefit?.scope === 'ALL' ? [benefit.percent] : benefit?.targets.map((target) => target.percent) ?? []
      if (benefit && (!percentages.length || percentages.some((percent) => percent == null || !Number.isFinite(percent) || percent <= 0 || percent >= 100))) {
        toast.error(`Enter a valid discount and select targets for ${kind}.`)
        return
      }
    }

    const locationAssignments = scope === PricingOptionScope.SPECIFIC
      ? selectedLocationIds
      : Object.entries(overrides).filter(([, override]) => override.enabled).map(([locationId]) => locationId)
    const invalidOverride = locationAssignments.find((locationId) => {
      const override = getOverride(locationId)
      return override.enabled && (
        !Number.isFinite(Number(override.price)) || Number(override.price) < 0 || override.currency.trim().length !== 3
      )
    })
    if (invalidOverride) {
      const label = locations.data?.find((item) => item.id === invalidOverride)?.name ?? 'the location'
      toast.error(`Enter a valid override price and currency for ${label}.`)
      return
    }
    const locationsPayload = locationAssignments.map((locationId) => {
      const override = getOverride(locationId)
      if (!override.enabled) return { locationId }
      return {
        locationId,
        priceOverride: Number(override.price),
        currencyOverride: override.currency.trim().toUpperCase(),
      }
    })

    createPricingOption.mutate({
      name: name.trim(),
      description: description.trim() || null,
      type,
      price: numericPrice,
      vatRate: numericVatRate / 100,
      currency: selectedCurrency.toUpperCase(),
      scope,
      locations: locationsPayload,
      billingInterval,
      creditsTotal: type === PricingOptionType.CLASS_PACK || type === PricingOptionType.DROP_IN || type === PricingOptionType.INTRO_OFFER
        ? (creditsTotal ? Number(creditsTotal) : null)
        : null,
      creditsPerPeriod: type === PricingOptionType.CAPPED_MEMBERSHIP
        ? Number(creditsPerPeriod)
        : null,
      creditsRefreshInterval,
      creditsRollover: type === PricingOptionType.CAPPED_MEMBERSHIP ? creditsRollover : false,
      validityDays: validityDays ? Number(validityDays) : null,
      minimumCommitmentMonths: minimumCommitmentMonths ? Number(minimumCommitmentMonths) : null,
      classAccessScope,
      classTypeIds: classAccessScope === 'SPECIFIC' ? classTypeIds : [],
      isIntro,
      isSellable,
      isActive,
      perks: perksText.split('\n').map((perk) => perk.trim()).filter(Boolean),
      purchaseBenefits,
    })
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={option ? 'Edit pricing option' : 'Create pricing option'}
      description="Set its price, billing schedule, and the locations where it applies."
      contentClassName="sm:max-w-xl"
    >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
          {allowCustomerSelection && !option ? (
            <Field label="Customer">
              <SelectInput
                aria-label="Customer"
                placeholder="Select customer"
                searchable
                items={(customers.data ?? []).map((customer) => ({ value: customer.id, label: customer.name }))}
                isLoading={customers.isLoading}
                emptyMessage={customers.isError ? 'Failed to load customers.' : 'No customers found.'}
                value={selectedCustomerId || undefined}
                onValueChange={(value) => {
                  setSelectedCustomerId(String(value))
                  setSelectedLocationIds([])
                  setOverrides({})
                }}
                loadingMessage="Loading customers..."
              />
            </Field>
          ) : null}
          <Field label="Name">
            <Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Essential" />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <SelectInput
                aria-label="Type"
                items={types}
                value={type}
                onValueChange={(value) => setType(String(value) as PricingOptionType)}
              />
            </Field>
            <Field label="Billing interval">
              <SelectInput
                aria-label="Billing interval"
                items={intervals}
                value={billingInterval}
                onValueChange={(value) => setBillingInterval(String(value) as BillingInterval)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price incl. VAT">
              <Input required type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} />
            </Field>
            <Field label="VAT rate (%)">
              <Input required type="number" min="0" max="100" step="0.01" value={vatRatePercent} onChange={(event) => setVatRatePercent(event.target.value)} />
            </Field>
            <Field label="Currency">
              <Input required minLength={3} maxLength={3} value={selectedCurrency} onChange={(event) => setSelectedCurrency(event.target.value)} />
            </Field>
          </div>

          {type === PricingOptionType.CLASS_PACK || type === PricingOptionType.DROP_IN || type === PricingOptionType.INTRO_OFFER ? (
            <Field label="Total credits">
              <Input type="number" min="0.01" step="0.01" value={creditsTotal} onChange={(event) => setCreditsTotal(event.target.value)} />
            </Field>
          ) : null}
          {type === PricingOptionType.CAPPED_MEMBERSHIP ? (
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Credits granted per refresh">
                  <Input type="number" min="0.01" step="0.01" value={creditsPerPeriod} onChange={(event) => setCreditsPerPeriod(event.target.value)} />
                </Field>
                <Field label="Credit refresh frequency">
                  <SelectInput
                    aria-label="Credit refresh frequency"
                    items={creditRefreshIntervals}
                    value={creditsRefreshInterval}
                    onValueChange={(value) => setCreditsRefreshInterval(String(value) as CreditRefreshInterval)}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-normal">
                <input type="checkbox" checked={creditsRollover} onChange={(event) => setCreditsRollover(event.target.checked)} />
                Carry unused credits over (balance capped at twice the refresh allowance)
              </label>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Validity (days)">
              <Input
                type="number"
                min="1"
                step="1"
                value={validityDays}
                onChange={(event) => setValidityDays(event.target.value)}
                placeholder="No expiry"
              />
            </Field>
            <Field label="Minimum commitment (months)">
              <Input
                type="number"
                min="1"
                step="1"
                value={minimumCommitmentMonths}
                onChange={(event) => setMinimumCommitmentMonths(event.target.value)}
                placeholder="No minimum"
              />
            </Field>
          </div>

          <Field label="Classes covered">
            <SelectInput aria-label="Classes covered" items={[{ value: 'ALL', label: 'All classes' }, { value: 'SPECIFIC', label: 'Selected classes' }]} value={classAccessScope} onValueChange={(value) => setClassAccessScope(String(value) as ClassAccessScope)} />
          </Field>
          {classAccessScope === 'SPECIFIC' && <div className="grid gap-2 rounded-lg border p-3">
            {(classAccessTargets.data ?? []).map((classType) => <label key={classType.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={classTypeIds.includes(classType.id)} onChange={(event) => setClassTypeIds((ids) => event.target.checked ? [...ids, classType.id] : ids.filter((id) => id !== classType.id))} />
              <span>{classType.name} · {locations.data?.find((location) => location.id === classType.organizationId)?.name}</span>
            </label>)}
          </div>}

          <Field label="Included benefits (one per line)">
            <Textarea
              value={perksText}
              onChange={(event) => setPerksText(event.target.value)}
              rows={3}
              placeholder={'One free drink\nLocker access'}
            />
          </Field>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="font-medium">Purchase discounts</div>
            <p className="text-sm text-muted-foreground">Available while the purchased contract is active. The best eligible discount is applied.</p>
            {(['products', 'pricingOptions'] as const).map((kind) => {
              const rule = purchaseBenefits[kind]
              const targets = (benefitTargets.data?.[kind] ?? []).filter((target) => kind !== 'pricingOptions' || target.id !== option?.id)
              return <div key={kind} className="space-y-2 rounded-md border p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={Boolean(rule)} onChange={(event) => updateBenefit(kind, event.target.checked ? { percent: null, scope: 'ALL', targets: [] } : undefined)} />
                  {kind === 'products' ? 'Discount on products' : 'Discount on other pricing options'}
                </label>
                {rule ? <>
                  <Field label="Applies to">
                    <SelectInput aria-label={`${kind} benefit scope`} items={[{ value: 'ALL', label: 'All' }, { value: 'SPECIFIC', label: 'Specific items' }]} value={rule.scope} onValueChange={(value) => updateBenefit(kind, String(value) === 'ALL' ? { scope: 'ALL', percent: rule.percent ?? rule.referencePercent ?? null, targets: [] } : { scope: 'SPECIFIC', referencePercent: rule.percent ?? null, targets: [] })} />
                  </Field>
                  {rule.scope === 'ALL' ? <Field label="Discount (%)">
                    <PercentInput label={`${kind} discount percentage`} value={rule.percent} onValueChange={(percent) => updateBenefit(kind, { ...rule, percent })} />
                  </Field> : null}
                  {rule.scope === 'SPECIFIC' ? <div className="flex flex-wrap items-end gap-2">
                    <Field label="Reference discount (%)">
                      <PercentInput label={`${kind} reference discount percentage`} className="w-32" value={rule.referencePercent} onValueChange={(referencePercent) => updateBenefit(kind, { ...rule, referencePercent })} />
                    </Field>
                    <Button type="button" variant="outline" disabled={rule.referencePercent == null || rule.referencePercent <= 0 || rule.referencePercent >= 100 || !rule.targets.length} onClick={() => updateBenefit(kind, { ...rule, targets: rule.targets.map((target) => ({ ...target, percent: rule.referencePercent ?? null })) })}>Apply to selected</Button>
                  </div> : null}
                  {rule.scope === 'SPECIFIC' ? <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                    {benefitTargets.isLoading ? <span className="text-sm text-muted-foreground">Loading items...</span> : null}
                    {targets.map((target) => {
                      const selected = rule.targets.find((item) => item.id === target.id)
                      return <div key={target.id} className="flex items-center gap-3 text-sm">
                        <label className="flex min-w-0 flex-1 items-center gap-2">
                          <input type="checkbox" checked={Boolean(selected)} onChange={(event) => updateBenefit(kind, { ...rule, targets: event.target.checked ? [...rule.targets, { id: target.id, percent: rule.referencePercent ?? null }] : rule.targets.filter((item) => item.id !== target.id) })} />
                          <span className="truncate">{target.name}</span>
                        </label>
                        {selected ? <PercentInput label={`${target.name} discount percentage`} className="w-24" value={selected.percent} onValueChange={(percent) => updateBenefit(kind, { ...rule, targets: rule.targets.map((item) => item.id === target.id ? { ...item, percent } : item) })} /> : null}
                        {selected ? <span>%</span> : null}
                      </div>
                    })}
                    {!targets.length && !benefitTargets.isLoading ? <span className="text-sm text-muted-foreground">No items available.</span> : null}
                  </div> : null}
                </> : null}
              </div>
            })}
          </div>

          <div className="grid gap-3 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-normal">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              Active in the catalog
            </label>
            <label className="flex items-center gap-2 text-sm font-normal">
              <input type="checkbox" checked={isSellable} onChange={(event) => setIsSellable(event.target.checked)} />
              Available for purchase
            </label>
            <label className="flex items-center gap-2 text-sm font-normal">
              <input type="checkbox" checked={isIntro} onChange={(event) => setIsIntro(event.target.checked)} />
              Introductory offer
            </label>
          </div>

          <Field label="Scope">
            <SelectInput
              aria-label="Scope"
              items={[
                { value: PricingOptionScope.ALL, label: 'All locations' },
                { value: PricingOptionScope.SPECIFIC, label: 'Specific locations' },
              ]}
              value={scope}
              onValueChange={(value) => setScope(String(value) as PricingOptionScope)}
            />
          </Field>

          {scope === PricingOptionScope.SPECIFIC || locations.data?.length ? (
            <div className="grid gap-2 rounded-lg border p-3">
              <div className="text-sm font-medium">
                {scope === PricingOptionScope.SPECIFIC ? 'Available at these locations' : 'Optional location price overrides'}
              </div>
              {locations.isLoading ? <p className="text-sm text-muted-foreground">Loading locations...</p> : null}
              {locations.isError ? <p className="text-sm text-destructive">Failed to load locations.</p> : null}
              {locations.data?.length === 0 ? <p className="text-sm text-muted-foreground">This customer has no locations.</p> : null}
              {locations.data?.map((location) => (
                <div key={location.id} className="rounded-md border-b py-2 last:border-b-0">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={scope === PricingOptionScope.SPECIFIC
                        ? selectedLocationIds.includes(location.id)
                        : getOverride(location.id).enabled}
                      onChange={() => scope === PricingOptionScope.SPECIFIC
                        ? toggleLocation(location.id)
                        : setLocationOverride(location.id, { enabled: !getOverride(location.id).enabled })}
                      className="size-4 rounded border-input accent-primary"
                    />
                    {scope === PricingOptionScope.SPECIFIC ? location.name : `Override at ${location.name}`}
                  </label>
                  {scope === PricingOptionScope.SPECIFIC && selectedLocationIds.includes(location.id) ? (
                    <label className="ml-6 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={getOverride(location.id).enabled}
                        onChange={() => setLocationOverride(location.id, { enabled: !getOverride(location.id).enabled })}
                        className="size-3.5 rounded border-input accent-primary"
                      />
                      Use a different price
                    </label>
                  ) : null}
                  {getOverride(location.id).enabled ? (
                    <div className="ml-6 mt-2 grid gap-2 sm:grid-cols-2">
                      <Input
                        aria-label={`Price override for ${location.name}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={getOverride(location.id).price}
                        onChange={(event) => setLocationOverride(location.id, { price: event.target.value })}
                      />
                      <Input
                        aria-label={`Currency override for ${location.name}`}
                        minLength={3}
                        maxLength={3}
                        value={getOverride(location.id).currency}
                        onChange={(event) => setLocationOverride(location.id, { currency: event.target.value })}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t px-5 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={createPricingOption.isPending}>{option ? 'Save changes' : 'Create pricing option'}</Button>
          </div>
        </form>
    </AppDrawer>
  )
}
