import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectInput, SelectInputAsync } from '@/components/ui/select-input'
import { Textarea } from '@/components/ui/textarea'
import { getCustomersListRequest } from '@/features/customers/api'
import { getAllLocationsForCustomerRequest } from '@/features/locations/api'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import { createClassTypeRequest, type CreateClassTypePayload } from '@/features/classes/api'
import { classTypesQueryKeys } from '@/features/classes/query-keys'
import type { Customer } from '@/types/customer'
import type { Location } from '@/types/location'
import type { ClassType } from '@/types/class-type'

const classTypeOptions = [
  { value: 'GROUP', label: 'Group' },
  { value: 'SEMI_PRIVATE', label: 'Semi-private' },
  { value: 'PRIVATE', label: 'Private' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

export function CreateClassTypeDrawer({
  open,
  onOpenChange,
  fixedCustomer,
  fixedLocation,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fixedCustomer?: Customer
  fixedLocation?: Pick<Location, 'id' | 'name' | 'parentId'>
}) {
  const queryClient = useQueryClient()
  const { session } = useConnect()
  const sessionCustomer = useMemo(() => getAppMode() === 'customer' && session?.currentOrganization?.id
    ? { id: session.currentOrganization.id, name: session.currentOrganization.name ?? '' } as Customer
    : undefined, [session?.currentOrganization?.id, session?.currentOrganization?.name])
  const initialCustomer = fixedCustomer ?? sessionCustomer
  const [customer, setCustomer] = useState<Customer | undefined>(initialCustomer)
  const [location, setLocation] = useState<Location>()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [conditions, setConditions] = useState('')
  const [type, setType] = useState<ClassType['type']>('GROUP')
  const [duration, setDuration] = useState('50')
  const [maxCapacity, setMaxCapacity] = useState('8')
  const [minimumParticipants, setMinimumParticipants] = useState('')
  const [creditCost, setCreditCost] = useState('1')
  const [isSaving, setIsSaving] = useState(false)

  const customerId = fixedCustomer?.id ?? fixedLocation?.parentId ?? customer?.id
  const isCustomerFixed = Boolean(fixedCustomer || fixedLocation || sessionCustomer)

  useEffect(() => {
    if (!open) return
    setCustomer(initialCustomer)
    setLocation(undefined)
    setName('')
    setCategory('')
    setDescription('')
    setConditions('')
    setType('GROUP')
    setDuration('50')
    setMaxCapacity('8')
    setMinimumParticipants('')
    setCreditCost('1')
  }, [open, initialCustomer])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const locationId = fixedLocation?.id ?? location?.id
    const durationValue = Number(duration)
    const capacityValue = Number(maxCapacity)
    const minimumValue = minimumParticipants.trim() ? Number(minimumParticipants) : null
    const creditValue = Number(creditCost)

    if (!name.trim() || !locationId || !Number.isInteger(durationValue) || durationValue < 1 ||
      !Number.isInteger(capacityValue) || capacityValue < 1 ||
      (minimumValue !== null && (!Number.isInteger(minimumValue) || minimumValue < 1 || minimumValue > capacityValue)) ||
      !Number.isFinite(creditValue) || creditValue < 0) {
      toast.error('Check the class name, location, duration, capacity, minimum participants, and credit cost.')
      return
    }

    const payload: CreateClassTypePayload = {
      name: name.trim(),
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      conditions: conditions.trim() || null,
      type,
      duration: durationValue,
      maxCapacity: capacityValue,
      minimumParticipants: minimumValue,
      creditCost: creditValue,
    }

    setIsSaving(true)
    try {
      await createClassTypeRequest(locationId, payload)
      await queryClient.invalidateQueries({ queryKey: classTypesQueryKeys.all })
      toast.success('Class created.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create class.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} title="Create class" description="Create a class type for one studio location." contentClassName="sm:max-w-lg">
      {({ containerRef }) => (
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
            {!isCustomerFixed && (
              <SelectInputAsync<Customer>
                label="Customer"
                placeholder="Search customers"
                required
                queryKey={['class-type-create-customers']}
                queryFn={(search) => getCustomersListRequest(undefined, search)}
                getOption={(item) => ({ value: item.id, label: item.name })}
                selectedItems={customer ? [customer] : []}
                value={customer?.id ?? ''}
                onValueChange={() => { setCustomer(undefined); setLocation(undefined) }}
                onSelectedItemsChange={(items) => { setCustomer(items[0]); setLocation(undefined) }}
                container={containerRef}
              />
            )}
            {fixedLocation ? (
              <Field label="Location"><Input readOnly value={fixedLocation.name} /></Field>
            ) : customerId ? (
              <SelectInputAsync<Location>
                label="Location"
                placeholder="Search locations"
                required
                queryKey={['class-type-create-locations', customerId]}
                queryFn={async (search) => {
                  const query = search.trim().toLocaleLowerCase()
                  const locations = await getAllLocationsForCustomerRequest(customerId)
                  return locations.filter((item) => !query || item.name.toLocaleLowerCase().includes(query))
                }}
                getOption={(item) => ({ value: item.id, label: item.name })}
                selectedItems={location ? [location] : []}
                value={location?.id ?? ''}
                onValueChange={() => setLocation(undefined)}
                onSelectedItemsChange={(items) => setLocation(items[0])}
                container={containerRef}
              />
            ) : (
              <Field label="Location"><Input readOnly placeholder="Select a customer first" /></Field>
            )}
            <Field label="Name"><Input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="Category"><Input placeholder="Yoga, Pilates, strength…" value={category} onChange={(event) => setCategory(event.target.value)} /></Field>
            <Field label="Description"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></Field>
            <Field label="Conditions and requirements"><Textarea placeholder="For example: Grip socks are mandatory. Please bring a towel." value={conditions} onChange={(event) => setConditions(event.target.value)} rows={4} /></Field>
            <Field label="Type">
              <SelectInput aria-label="Class type" items={classTypeOptions} value={type} onValueChange={(value) => setType(String(value) as ClassType['type'])} />
            </Field>
            <Field label="Duration (minutes)"><Input required type="number" min="1" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></Field>
            <Field label="Maximum capacity"><Input required type="number" min="1" step="1" value={maxCapacity} onChange={(event) => setMaxCapacity(event.target.value)} /></Field>
            <Field label="Minimum participants to hold class"><Input type="number" min="1" step="1" max={maxCapacity || undefined} value={minimumParticipants} onChange={(event) => setMinimumParticipants(event.target.value)} /><span className="text-xs text-muted-foreground">Leave empty if there is no minimum. The class may be cancelled if fewer members book.</span></Field>
            <Field label="Credit cost"><Input required type="number" min="0" step="0.5" value={creditCost} onChange={(event) => setCreditCost(event.target.value)} /></Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-border p-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Creating…' : 'Create class'}</Button>
          </div>
        </form>
      )}
    </AppDrawer>
  )
}
