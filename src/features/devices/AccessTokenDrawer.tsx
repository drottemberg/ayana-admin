import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { createAccessTokenRequest, updateAccessTokenRequest, type AccessScheduleSlot, type AccessToken, type CreatedAccessToken } from './access-api'
import { getAllLocationsForCustomerRequest } from '@/features/locations/api'
import { getCustomerRequest } from '@/features/customers/api'
import type { User } from '@/types/user'

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const newSlot = (): AccessScheduleSlot => ({ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' })

export function AccessTokenDrawer({ open, onOpenChange, user, currentCustomerId, access }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User
  currentCustomerId?: string
  access?: AccessToken | null
}) {
  const queryClient = useQueryClient()
  const customerIds = useMemo(() => {
    const ids = currentCustomerId
      ? [currentCustomerId]
      : [user.customerId, ...(user.customerMemberships ?? []).map((membership) => membership.customerId)].filter((value): value is string => Boolean(value))
    return [...new Set(ids)]
  }, [currentCustomerId, user.customerId, user.customerMemberships])
  const { data: customers = [], isPending } = useQuery({
    queryKey: ['access-organizations', customerIds],
    enabled: open && customerIds.length > 0,
    queryFn: async () => (await Promise.all(customerIds.map(async (customerId) => {
      const [customer, locations] = await Promise.all([
        getCustomerRequest(customerId), getAllLocationsForCustomerRequest(customerId),
      ])
      return { id: customerId, name: customer.name, locations: locations.map((location) => ({ id: location.id, name: location.name })) }
    }))),
  })
  const [organizationId, setOrganizationId] = useState('')
  const [locationScope, setLocationScope] = useState<'ALL' | 'SPECIFIC'>('ALL')
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [purpose, setPurpose] = useState<'ACCESS' | 'CHECK_IN'>('ACCESS')
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [schedule, setSchedule] = useState<AccessScheduleSlot[]>([newSlot()])
  const [created, setCreated] = useState<CreatedAccessToken | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setOrganizationId(access?.organizationId ?? '')
    setLocationScope(access?.locationScope ?? 'ALL')
    setLocationIds(access?.locationIds ?? [])
    setPurpose(access?.purpose ?? 'ACCESS')
    setCode(access?.token ?? '')
    setLabel(access?.label ?? '')
    setMaxUses(access?.maxUses == null ? '' : String(access.maxUses))
    setExpiresAt(access?.expiresAt ?? '')
    setScheduleEnabled(Boolean(access?.schedule?.length))
    setSchedule(access?.schedule?.length ? access.schedule : [newSlot()])
    setCreated(null)
  }, [open, user.id, access?.id])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const selectedOrganizationId = organizationId || (customers.length === 1 ? customers[0].id : '')
    if (!access && !selectedOrganizationId) { toast.error('Select a customer.'); return }
    if (locationScope === 'SPECIFIC' && !locationIds.length) { toast.error('Select at least one location.'); return }
    if (scheduleEnabled && schedule.some((slot) => slot.endTime <= slot.startTime)) {
      toast.error('Each schedule slot must end after it starts.'); return
    }
    const accessSchedule = scheduleEnabled ? schedule : null
    setSaving(true)
    try {
      if (access) {
        await updateAccessTokenRequest(access.id, {
          token: code.trim(), label: label.trim() || null,
          maxUses: maxUses ? Number(maxUses) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          schedule: accessSchedule,
          locationScope, locationIds: locationScope === 'SPECIFIC' ? locationIds : [],
        }, selectedOrganizationId)
        toast.success('Access updated.')
        onOpenChange(false)
      } else {
        const token = await createAccessTokenRequest({
          userId: String(user.id), organizationId: selectedOrganizationId, purpose,
          locationScope, locationIds: locationScope === 'SPECIFIC' ? locationIds : [],
          ...(code.trim() ? { token: code.trim() } : {}),
          ...(label.trim() ? { label: label.trim() } : {}),
          ...(maxUses ? { maxUses: Number(maxUses) } : {}),
          ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
          schedule: accessSchedule,
        }, selectedOrganizationId)
        setCreated(token)
        toast.success('Access created.')
      }
      await queryClient.invalidateQueries({ queryKey: ['access-tokens'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create access.')
    } finally { setSaving(false) }
  }

  return <AppDrawer open={open} onOpenChange={onOpenChange} title={created ? 'Access created' : access ? 'Edit access' : 'Create access'}
    description={created ? 'You can edit the code or generate its QR code from the access list.' : `${access ? 'Edit' : 'Create'} an access code for ${user.firstName} ${user.lastName}.`}>
    {created ? <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
      <p className="text-sm text-muted-foreground">You can edit this code or generate its QR code later from the access list.</p>
      <code className="block break-all rounded-md border bg-muted p-3 text-sm">{created.token}</code>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => void navigator.clipboard.writeText(created.token).then(() => toast.success('Code copied.'))}>Copy code</Button>
        <Button onClick={() => onOpenChange(false)}>Done</Button>
      </div>
    </div> : <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void submit(event)}>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
      <label className="grid gap-1.5 text-sm font-medium">Customer
        <select className="h-10 rounded-md border border-input bg-background px-3" value={organizationId || (customers.length === 1 ? customers[0].id : '')}
          onChange={(event) => { setOrganizationId(event.target.value); setLocationIds([]) }} disabled={isPending || Boolean(access)} required>
          <option value="">Select customer</option>
          {access && !customers.some((customer) => customer.id === access.organizationId)
            ? <option value={access.organizationId}>{access.organizationName || 'Customer'}</option> : null}
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
      </label>
      <fieldset className="space-y-2 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Locations</legend>
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="access-location-scope" checked={locationScope === 'ALL'}
          onChange={() => { setLocationScope('ALL'); setLocationIds([]) }} />All locations</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" name="access-location-scope" checked={locationScope === 'SPECIFIC'}
          onChange={() => setLocationScope('SPECIFIC')} />Specific locations</label>
        {locationScope === 'SPECIFIC' ? <div className="grid max-h-44 gap-2 overflow-y-auto rounded-md bg-muted/40 p-2">
          {(customers.find((item) => item.id === (organizationId || customers[0]?.id))?.locations ?? []).map((location) =>
            <label key={location.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={locationIds.includes(location.id)}
              onChange={(event) => setLocationIds((current) => event.target.checked ? [...current, location.id] : current.filter((id) => id !== location.id))} />{location.name}</label>)}
        </div> : null}
      </fieldset>
      <label className="grid gap-1.5 text-sm font-medium">Purpose
        <select className="h-10 rounded-md border border-input bg-background px-3" value={purpose} disabled={Boolean(access)} onChange={(event) => setPurpose(event.target.value as 'ACCESS' | 'CHECK_IN')}>
          <option value="ACCESS">Access</option><option value="CHECK_IN">Check-in</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">Access code {access ? '' : '(leave blank to generate)'}
        <Input value={code} onChange={(event) => setCode(event.target.value)} minLength={4} maxLength={64}
          pattern="[A-Za-z0-9_-]{4,64}" required={Boolean(access)} autoComplete="off" />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">Label (optional)<Input value={label} onChange={(event) => setLabel(event.target.value)} /></label>
      <label className="grid gap-1.5 text-sm font-medium">Maximum uses (optional)<Input type="number" min="1" step="1" value={maxUses} onChange={(event) => setMaxUses(event.target.value)} /></label>
      <DateTimePicker label="Expires at (date and time, optional)" value={expiresAt} onValueChange={setExpiresAt} defaultTime="23:59" clearable />
      <fieldset className="space-y-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Access schedule</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={scheduleEnabled} onChange={(event) => setScheduleEnabled(event.target.checked)} />
          Restrict access to weekly time slots
        </label>
        {scheduleEnabled ? <>
          <p className="text-xs text-muted-foreground">Times use the scanning location’s timezone. Add a slot for each day and time range.</p>
          {schedule.map((slot, index) => <div key={index} className="grid grid-cols-[1fr_6.5rem_6.5rem_auto] items-end gap-2 max-sm:grid-cols-2">
            <label className="grid gap-1 text-xs">Day
              <select className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={slot.dayOfWeek}
                onChange={(event) => setSchedule((current) => current.map((item, i) => i === index ? { ...item, dayOfWeek: Number(event.target.value) } : item))}>
                {weekdays.map((day, dayOfWeek) => <option key={day} value={dayOfWeek}>{day}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs">From
              <Input type="time" required value={slot.startTime} onChange={(event) => setSchedule((current) => current.map((item, i) => i === index ? { ...item, startTime: event.target.value } : item))} />
            </label>
            <label className="grid gap-1 text-xs">To
              <Input type="time" required value={slot.endTime} onChange={(event) => setSchedule((current) => current.map((item, i) => i === index ? { ...item, endTime: event.target.value } : item))} />
            </label>
            <Button type="button" variant="outline" disabled={schedule.length === 1} onClick={() => setSchedule((current) => current.filter((_, i) => i !== index))}>Remove</Button>
          </div>)}
          <Button type="button" variant="outline" disabled={schedule.length >= 50} onClick={() => setSchedule((current) => [...current, newSlot()])}>Add time slot</Button>
        </> : <p className="text-xs text-muted-foreground">The code can be used at any time until it expires or is disabled.</p>}
      </fieldset>
      </div>
      <div className="flex justify-end gap-2 border-t p-5"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button type="submit" disabled={saving || (!access && !customers.length)}>{saving ? 'Saving…' : access ? 'Save access' : 'Create access'}</Button></div>
    </form>}
  </AppDrawer>
}
