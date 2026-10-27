import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'

import { DataTableAsync, type DataTableFilter, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AppDrawer } from '@/components/app/AppDrawer'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import { getCustomerFilterOptionsRequest, getCustomersListRequest } from '@/features/customers/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { getAllLocationsForCustomerRequest } from '@/features/locations/api'
import { getProductsRequest } from '@/features/products/api'
import { getPricingOptionsRequest } from '@/features/pricing-options/api'
import { deletePartnershipRequest, listPartnershipsRequest, setPartnershipStatusRequest, createPartnershipRequest, updatePartnershipRequest, type Partnership, type PartnershipInput } from '@/features/partnerships/api'
import { Modals } from '@/providers/modal'
import { queryClient } from '@/lib/query-client'
import type { Product } from '@/types/product'
import type { PricingOption } from '@/types/pricing-option'
import type { Location } from '@/types/location'
import type { Customer } from '@/types/customer'
import { SelectInputAsync } from '@/components/ui/select-input'

const EMPTY_FORM: PartnershipInput = {
  name: '', locationScope: 'ALL', isActive: true, locationIds: [], emailRules: [],
  productDiscounts: [{ productId: null, percent: 10 }],
  pricingOptionDiscounts: [{ pricingOptionId: null, percent: 10 }],
}

function allRowsState<T extends Record<string, unknown>>(): DataTableState<T> {
  return { pagination: { pageIndex: 0, pageSize: 500 }, sorting: [], search: '', filters: {} }
}

export default function PartnershipsPage() {
  const { session } = useConnect()
  const isAdmin = getAppMode() === 'admin'
  const activeOrg = session?.currentOrganization
  const fixedCustomerId = activeOrg?.isCustomer ? activeOrg.id : activeOrg?.parentId ?? activeOrg?.parent?.id ?? undefined
  const [editing, setEditing] = useState<Partnership | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const canCreate = Boolean(session?.permissions.partnerships?.create)
  const canEdit = Boolean(session?.permissions.partnerships?.edit)
  const canDelete = Boolean(session?.permissions.partnerships?.delete)

  const openCreate = () => { setEditing(null); setEditorOpen(true) }
  const openEdit = (partnership: Partnership) => { setEditing(partnership); setEditorOpen(true) }

  const loadRows = useCallback(async (state: DataTableState<Partnership>) => {
    const customerId = isAdmin ? state.filters.customerId?.[0] : fixedCustomerId
    const selectedStatuses = state.filters.status ?? []
    const status = selectedStatuses.length === 1 ? selectedStatuses[0] as 'ACTIVE' | 'DISABLED' | 'DELETED' : selectedStatuses.length > 1 ? 'ALL' : undefined
    const rows = await listPartnershipsRequest(customerId, state.search, status)
    const filtered = selectedStatuses.length ? rows.filter((row) => selectedStatuses.includes(row.status)) : rows
    const pageSize = state.pagination.pageSize
    const start = state.pagination.pageIndex * pageSize
    return { items: filtered.slice(start, start + pageSize), count: filtered.length, pageCount: Math.ceil(filtered.length / pageSize) }
  }, [fixedCustomerId, isAdmin])

  const toggleStatus = async (row: Partnership) => {
    try {
      await setPartnershipStatusRequest(row.customerId, row.id, !row.isActive)
      await queryClient.invalidateQueries({ queryKey: ['partnerships'] })
      toast.success(row.isActive ? 'Partnership disabled.' : 'Partnership enabled.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update partnership.') }
  }
  const remove = async (row: Partnership) => {
    const confirmed = await Modals.confirm({ operation: `delete partnership “${row.name}”`, okButtonProps: { variant: 'destructive' } })
    if (!confirmed) return
    try {
      await deletePartnershipRequest(row.customerId, row.id)
      await queryClient.invalidateQueries({ queryKey: ['partnerships'] })
      toast.success('Partnership deleted.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not delete partnership.') }
  }

  const columns = useMemo<ColumnDef<Partnership>[]>(() => [
    ...(isAdmin ? [{ accessorKey: 'customerId', header: 'Customer', cell: ({ row }: any) => row.original.customerName ?? row.original.customerId } as ColumnDef<Partnership>] : []),
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <span className="grid justify-items-start gap-1"><Badge variant="outline" className={row.original.status === 'ACTIVE' ? 'border-green-200 text-green-800' : row.original.status === 'DELETED' ? 'border-red-200 text-red-800' : 'text-muted-foreground'}>{row.original.status === 'DELETED' ? 'Deleted' : row.original.status === 'DISABLED' ? 'Disabled' : 'Active'}</Badge>{row.original.deletedAt ? <span className="text-xs text-muted-foreground">{new Date(row.original.deletedAt).toLocaleDateString()}</span> : null}</span> },
    { accessorKey: 'name', header: 'Partnership', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: 'locationScope', header: 'Locations', cell: ({ row }) => row.original.locationScope === 'ALL' ? 'All locations' : row.original.locations.map((item) => item.name).join(', ') },
    { accessorKey: 'emailSummary', header: 'Eligible emails', cell: ({ row }) => <span className="block max-w-xs truncate" title={row.original.emailRules.join(', ')}>{row.original.emailRules.join(', ')}</span> },
    { accessorKey: 'discountSummary', header: 'Discounts', cell: ({ row }) => `${row.original.productDiscounts.length} product · ${row.original.pricingOptionDiscounts.length} pricing option` },
  ], [isAdmin])

  const rowActions = (row: Partnership): DropdownActionItem[] => [
    ...(row.isDeleted ? [] : canEdit ? [{ label: 'Edit', onClick: () => openEdit(row) }, { label: row.isActive ? 'Disable' : 'Enable', onClick: () => void toggleStatus(row) }] : []),
    ...(row.isDeleted || !canDelete ? [] : [{ label: 'Delete', variant: 'destructive' as const, onClick: () => void remove(row) }]),
  ]

  const filters: DataTableFilter<Partnership>[] = [
    ...(isAdmin ? [{
      id: 'customerId', label: 'Customer', column: 'customerId' as const, selectionMode: 'single' as const,
      queryFn: getCustomerFilterOptionsRequest,
    }] : []),
    { id: 'status', label: 'Status', column: 'status' as const, options: ['ACTIVE', 'DISABLED', 'DELETED'], getValue: (row: Partnership) => row.status },
  ]

  return <>
    <PageHeader
      title="Partnerships"
      subtitle="Manage email eligibility, locations, and percentage discounts."
      primaryAction={canCreate && (isAdmin || fixedCustomerId) ? { children: 'Add partnership', onClick: openCreate } : undefined}
    />
    <section className="space-y-4 p-4 md:p-6">
      <DataTableAsync
        key={isAdmin ? 'admin-partnerships' : fixedCustomerId ?? 'customer-partnerships'}
        queryKey={['partnerships', isAdmin ? 'admin' : fixedCustomerId]}
        loadData={loadRows}
        refetchOnMount="always"
        tableKey="partnerships.root"
        columns={columns}
        searchPlaceholder="Search partnerships"
        searchColumns={['name', 'emailSummary']}
        filters={filters}
        getRowCommands={rowActions}
        loadingMessage="Loading partnerships..."
        emptyMessage="No partnerships found."
        errorMessage="Could not load partnerships."
      />
    </section>
    <PartnershipEditor
      customerId={fixedCustomerId ?? ''}
      isAdmin={isAdmin}
      partnership={editing}
      open={editorOpen}
      onOpenChange={setEditorOpen}
      onSaved={() => { setEditorOpen(false); void queryClient.invalidateQueries({ queryKey: ['partnerships'] }) }}
    />
  </>
}

function PartnershipEditor({ customerId, isAdmin, partnership, open, onOpenChange, onSaved }: {
  customerId: string
  isAdmin: boolean
  partnership: Partnership | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<PartnershipInput>(EMPTY_FORM)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [emailText, setEmailText] = useState('')
  const [locations, setLocations] = useState<Location[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [pricingOptions, setPricingOptions] = useState<PricingOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [saving, setSaving] = useState(false)
  const effectiveCustomerId = isAdmin ? selectedCustomerId : customerId
  const isOpen = open && (isAdmin || Boolean(customerId))

  useEffect(() => {
    if (!isOpen) return
    const initialCustomerId = partnership?.customerId ?? customerId
    setSelectedCustomerId(initialCustomerId)
    setSelectedCustomer(partnership ? { id: partnership.customerId, name: partnership.customerName ?? partnership.customerId } as Customer : null)
    setForm(partnership ? {
      name: partnership.name,
      locationScope: partnership.locationScope,
      isActive: partnership.isActive,
      locationIds: partnership.locationIds,
      emailRules: partnership.emailRules,
      productDiscounts: partnership.productDiscounts.map((item) => ({ productId: item.productId ?? null, percent: item.percent })),
      pricingOptionDiscounts: partnership.pricingOptionDiscounts.map((item) => ({ pricingOptionId: item.pricingOptionId ?? null, percent: item.percent })),
    } : EMPTY_FORM)
    setEmailText((partnership?.emailRules ?? []).join('\n'))
  }, [customerId, isOpen, partnership])

  useEffect(() => {
    if (!isOpen || !effectiveCustomerId) {
      setLocations([])
      setProducts([])
      setPricingOptions([])
      setLoadingOptions(false)
      return
    }
    setLoadingOptions(true)
    const state = allRowsState<any>()
    void Promise.all([
      getAllLocationsForCustomerRequest(effectiveCustomerId),
      getProductsRequest(state, { customerId: effectiveCustomerId }).then((result) => result.items),
      getPricingOptionsRequest(state, { customerId: effectiveCustomerId }).then((result) => result.items),
    ]).then(([nextLocations, nextProducts, nextOptions]) => {
      setLocations(nextLocations)
      setProducts(nextProducts)
      setPricingOptions(nextOptions)
    }).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load partnership options.'))
      .finally(() => setLoadingOptions(false))
  }, [effectiveCustomerId, isOpen])

  const setField = <K extends keyof PartnershipInput>(key: K, value: PartnershipInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const toggleLocation = (id: string) => setField('locationIds', form.locationIds.includes(id) ? form.locationIds.filter((value) => value !== id) : [...form.locationIds, id])
  const addProductRule = () => setField('productDiscounts', [...form.productDiscounts, { productId: null, percent: 10 }])
  const addOptionRule = () => setField('pricingOptionDiscounts', [...form.pricingOptionDiscounts, { pricingOptionId: null, percent: 10 }])
  const updateProductRule = (index: number, patch: Partial<PartnershipInput['productDiscounts'][number]>) => setField('productDiscounts', form.productDiscounts.map((rule, i) => i === index ? { ...rule, ...patch } : rule))
  const updateOptionRule = (index: number, patch: Partial<PartnershipInput['pricingOptionDiscounts'][number]>) => setField('pricingOptionDiscounts', form.pricingOptionDiscounts.map((rule, i) => i === index ? { ...rule, ...patch } : rule))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const emailRules = emailText.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean)
    if (!effectiveCustomerId) { toast.error('Select a customer.'); return }
    if (!form.name.trim()) { toast.error('Enter a partnership name.'); return }
    if (!emailRules.length) { toast.error('Add at least one email or domain rule.'); return }
    if (form.locationScope === 'SPECIFIC' && !form.locationIds.length) { toast.error('Select at least one location.'); return }
    if ([...form.productDiscounts, ...form.pricingOptionDiscounts].some((item) => !Number.isFinite(Number(item.percent)) || item.percent <= 0 || item.percent >= 100)) { toast.error('Each discount must be greater than 0% and less than 100%.'); return }
    const input: PartnershipInput = { ...form, name: form.name.trim(), emailRules }
    setSaving(true)
    try {
      if (partnership) await updatePartnershipRequest(partnership.customerId, partnership.id, input)
      else await createPartnershipRequest(effectiveCustomerId, input)
      toast.success(partnership ? 'Partnership updated.' : 'Partnership created.')
      onSaved()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save partnership.') }
    finally { setSaving(false) }
  }

  return <AppDrawer
    open={isOpen}
    onOpenChange={onOpenChange}
    title={partnership ? 'Edit partnership' : 'Add partnership'}
    description="Manage eligibility, locations, and percentage discounts."
    contentClassName="sm:max-w-2xl"
  >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void submit(event)}>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {isAdmin ? <SelectInputAsync<Customer>
          label="Customer"
          placeholder="Select customer"
          queryKey={customersQueryKeys.all}
          queryFn={(search) => getCustomersListRequest(undefined, search)}
          getOption={(customer) => ({ value: customer.id, label: customer.name })}
          selectedItems={selectedCustomer ? [selectedCustomer] : []}
          value={selectedCustomerId}
          onValueChange={(value) => { setSelectedCustomerId(String(value)); setLocations([]); setProducts([]); setPricingOptions([]) }}
          onSelectedItemsChange={(items) => setSelectedCustomer(items[0] ?? null)}
          disabled={Boolean(partnership)}
        /> : null}
        <label className="grid gap-1.5 text-sm font-medium"><span>Name</span><Input required maxLength={120} value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="Company or partner name" /></label>
        <div className="grid gap-2">
          <span className="text-sm font-medium">Eligible email addresses or domains</span>
          <Textarea rows={4} value={emailText} onChange={(event) => setEmailText(event.target.value)} placeholder={'@amazon.fr\n@amazon.com\njane@amazon.fr'} />
          <p className="text-xs text-muted-foreground">Use one rule per line. A value starting with @ matches a complete email domain.</p>
        </div>
        <div className="grid gap-3 rounded-lg border p-4">
          <div className="grid gap-1"><strong className="text-sm">Location scope</strong><p className="text-xs text-muted-foreground">The partnership is only available at the selected customer locations.</p></div>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.locationScope} onChange={(event) => setField('locationScope', event.target.value as PartnershipInput['locationScope'])}>
            <option value="ALL">All locations</option><option value="SPECIFIC">Selected locations</option>
          </select>
          {form.locationScope === 'SPECIFIC' ? <div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">{locations.map((location) => <label key={location.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.locationIds.includes(location.id)} onChange={() => toggleLocation(location.id)} />{location.name}</label>)}</div> : null}
        </div>
        <DiscountRules title="Product discounts" allLabel="All products" rules={form.productDiscounts} options={products.map((item) => ({ id: item.id, name: item.name }))} targetKey="productId" onAdd={addProductRule} onChange={updateProductRule} onRemove={(index) => setField('productDiscounts', form.productDiscounts.filter((_, i) => i !== index))} loading={loadingOptions} />
        <DiscountRules title="Pricing option discounts" allLabel="All pricing options" rules={form.pricingOptionDiscounts} options={pricingOptions.map((item) => ({ id: item.id, name: item.name }))} targetKey="pricingOptionId" onAdd={addOptionRule} onChange={updateOptionRule} onRemove={(index) => setField('pricingOptionDiscounts', form.pricingOptionDiscounts.filter((_, i) => i !== index))} loading={loadingOptions} />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={saving}>{partnership ? 'Save changes' : 'Create partnership'}</Button>
        </div>
      </form>
  </AppDrawer>
}

function DiscountRules({ title, allLabel, rules, options, targetKey, onAdd, onChange, onRemove, loading }: {
  title: string
  allLabel: string
  rules: Array<{ productId?: string | null; pricingOptionId?: string | null; percent: number }>
  options: Array<{ id: string; name: string }>
  targetKey: 'productId' | 'pricingOptionId'
  onAdd: () => void
  onChange: (index: number, patch: { productId?: string | null; pricingOptionId?: string | null; percent?: number }) => void
  onRemove: (index: number) => void
  loading: boolean
}) {
  return <div className="grid gap-3 rounded-lg border p-4">
    <div className="flex items-center justify-between gap-3"><div><strong className="text-sm">{title}</strong><p className="mt-1 text-xs text-muted-foreground">Percentages do not stack; the highest matching discount applies.</p></div><Button type="button" size="sm" variant="outline" onClick={onAdd}>Add rule</Button></div>
    {rules.map((rule, index) => <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto]" key={`${index}-${rule[targetKey] ?? 'all'}`}>
      <select className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={rule[targetKey] ?? '*'} disabled={loading} onChange={(event) => onChange(index, { [targetKey]: event.target.value === '*' ? null : event.target.value })}>
        <option value="*">{allLabel}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
      <label className="relative"><Input type="number" min="0.01" max="99.99" step="0.01" value={rule.percent} onChange={(event) => onChange(index, { percent: Number(event.target.value) })} /><span className="pointer-events-none absolute right-3 top-2 text-sm text-muted-foreground">%</span></label>
      <Button type="button" variant="ghost" onClick={() => onRemove(index)} aria-label={`Remove ${title.toLowerCase()} rule`}>Remove</Button>
    </div>)}
    {!rules.length ? <p className="text-xs text-muted-foreground">No discount rules for this category.</p> : null}
  </div>
}
