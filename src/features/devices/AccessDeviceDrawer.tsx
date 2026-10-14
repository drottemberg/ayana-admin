import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectInputAsync } from '@/components/ui/select-input'
import { getCustomersListRequest } from '@/features/customers/api'
import { getAllLocationsForCustomerRequest } from '@/features/locations/api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { createAccessDeviceRequest, updateAccessDeviceRequest, type AccessDevice, type CreatedAccessDevice } from '@/features/devices/access-device-api'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import { ALL_LOCATIONS_SCOPE, readSelectedLocationScope } from '@/features/organizations/storage'
import type { Customer } from '@/types/customer'
import type { Location } from '@/types/location'

type DeviceType = 'GENERIC' | 'AC600' | 'STRIPE_TERMINAL'
type DevicePurpose = 'ACCESS' | 'CHECK_IN' | 'PAYMENT'
type DeviceOrganization = { id: string; name: string; type: 'CUSTOMER' | 'LOCATION' }

function generateSecret() {
  return globalThis.crypto?.randomUUID?.().replaceAll('-', '') ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function AccessDeviceDrawer({
  open,
  onOpenChange,
  fixedCustomer,
  fixedOrganization,
  device,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fixedCustomer?: Customer
  fixedOrganization?: DeviceOrganization
  device?: AccessDevice
}) {
  const queryClient = useQueryClient()
  const { session } = useConnect()
  const isAdmin = getAppMode() === 'admin'
  const sessionCustomer = !isAdmin && session?.currentOrganization?.id
    ? { id: session.currentOrganization.id, name: session.currentOrganization.name } as Customer
    : undefined
  const initialCustomer = fixedCustomer ?? sessionCustomer
  const [customer, setCustomer] = useState<Customer | undefined>(initialCustomer)
  const [location, setLocation] = useState<Location>()
  const [useLocation, setUseLocation] = useState(fixedOrganization?.type === 'LOCATION')
  const [type, setType] = useState<DeviceType>('GENERIC')
  const [purpose, setPurpose] = useState<DevicePurpose>('ACCESS')
  const [deviceId, setDeviceId] = useState('')
  const [secret, setSecret] = useState('')
  const [label, setLabel] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [created, setCreated] = useState<CreatedAccessDevice>()
  const [isSaving, setIsSaving] = useState(false)
  const isEditMode = Boolean(device)

  const customerId = fixedOrganization?.type === 'CUSTOMER'
    ? fixedOrganization.id
    : fixedOrganization?.type === 'LOCATION'
      ? undefined
      : customer?.id
  const assignedOrganizationId = fixedOrganization?.id ?? (useLocation ? location?.id : customerId)
  const isStripeTerminal = type === 'STRIPE_TERMINAL'
  const organizationDescription = useMemo(() => {
    if (fixedOrganization) return `${fixedOrganization.name} (${fixedOrganization.type.toLowerCase()})`
    if (useLocation) return location?.name ?? 'Select a location'
    return customer?.name ? `${customer.name} (customer)` : 'Select a customer first'
  }, [customer?.name, fixedOrganization, location?.name, useLocation])

  useEffect(() => {
    if (!open) return
    const preferredLocationId = !isAdmin && initialCustomer?.id
      ? readSelectedLocationScope(initialCustomer.id)
      : null
    setCustomer(initialCustomer)
    setLocation(undefined)
    setUseLocation(fixedOrganization?.type === 'LOCATION' || Boolean(preferredLocationId && preferredLocationId !== ALL_LOCATIONS_SCOPE))
    setType((device?.type as DeviceType) ?? 'GENERIC')
    setPurpose((device?.purpose as DevicePurpose) ?? 'ACCESS')
    setDeviceId(device?.deviceId ?? '')
    setSecret(isEditMode ? '' : generateSecret())
    setLabel(device?.label ?? '')
    setIsActive(device?.isActive ?? true)
    setCreated(undefined)
    if (!fixedOrganization && preferredLocationId && preferredLocationId !== ALL_LOCATIONS_SCOPE && initialCustomer?.id) {
      void getAllLocationsForCustomerRequest(initialCustomer.id).then((locations) => {
        setLocation(locations.find((item) => item.id === preferredLocationId))
      })
    }
  }, [open, fixedOrganization?.id, fixedOrganization?.type, initialCustomer?.id, isAdmin, device?.id])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!assignedOrganizationId || !deviceId.trim() || (!isEditMode && !secret.trim())) {
      toast.error('Choose where the device belongs and enter its device ID and secret.')
      return
    }
    if (isStripeTerminal && fixedOrganization?.type !== 'LOCATION' && !useLocation) {
      toast.error('Assign the Stripe reader to a location.')
      return
    }
    setIsSaving(true)
    try {
      if (device) {
        await updateAccessDeviceRequest(device.id, {
          deviceId: deviceId.trim(),
          ...(secret.trim() ? { secret: secret.trim() } : {}),
          type,
          purpose,
          label: label.trim() || null,
          isActive,
        })
        toast.success('Device updated.')
        onOpenChange(false)
      } else {
        const createdDevice = await createAccessDeviceRequest({
          deviceId: deviceId.trim(),
          secret: secret.trim(),
          type,
          organizationId: assignedOrganizationId,
          purpose,
          label: label.trim() || undefined,
          isActive,
        })
        setCreated(createdDevice)
        toast.success('Device added.')
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: devicesQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['device-detail-batch'] }),
      ])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the device.')
    } finally {
      setIsSaving(false)
    }
  }

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied.`)
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}.`)
    }
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={created ? 'Device added' : isEditMode ? 'Edit device' : 'Add device'}
      description={created ? 'Save these credentials to configure the device.' : isEditMode ? 'Update the device details.' : 'Register a device and assign it to a customer or location.'}
      contentClassName="sm:max-w-xl"
    >
      {({ containerRef }) => created ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <p className="text-sm text-muted-foreground">The secret is only shown here. Copy it before closing this drawer.</p>
            <div className="space-y-3 rounded-lg border p-4">
              <Credential label="Device ID" value={created.deviceId} onCopy={() => void copy(created.deviceId, 'Device ID')} />
              <Credential label="Secret" value={created.secret} onCopy={() => void copy(created.secret, 'Secret')} />
            </div>
          </div>
          <div className="flex justify-end border-t border-border p-5">
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {!fixedOrganization && isAdmin && !fixedCustomer ? (
              <SelectInputAsync<Customer>
                label="Customer"
                placeholder="Search customers"
                queryKey={['access-device-customers']}
                queryFn={(search) => getCustomersListRequest(undefined, search)}
                getOption={(item) => ({ value: item.id, label: item.name })}
                selectedItems={customer ? [customer] : []}
                value={customer?.id ?? ''}
                onValueChange={() => {
                  setCustomer(undefined)
                  setLocation(undefined)
                }}
                onSelectedItemsChange={(items) => {
                  setCustomer(items[0])
                  setLocation(undefined)
                }}
                container={containerRef}
              />
            ) : null}

            {!fixedOrganization ? (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useLocation}
                    disabled={!customerId}
                    onChange={(event) => {
                      setUseLocation(event.target.checked)
                      setLocation(undefined)
                    }}
                  />
                  Assign this device to a location
                </label>
                {useLocation ? (
                  <SelectInputAsync<Location>
                    label="Location"
                    placeholder={customerId ? 'Search locations' : 'Select a customer first'}
                    queryKey={['access-device-locations', customerId]}
                    queryFn={async (search) => {
                      if (!customerId) return []
                      const locations = await getAllLocationsForCustomerRequest(customerId)
                      const query = search.trim().toLocaleLowerCase()
                      return locations.filter((item) => !query || item.name.toLocaleLowerCase().includes(query))
                    }}
                    getOption={(item) => ({ value: item.id, label: item.name })}
                    selectedItems={location ? [location] : []}
                    value={location?.id ?? ''}
                    onValueChange={() => setLocation(undefined)}
                    onSelectedItemsChange={(items) => setLocation(items[0])}
                    disabled={!customerId}
                    container={containerRef}
                  />
                ) : customerId ? (
                  <p className="text-sm text-muted-foreground">This device will be registered directly under {customer?.name ?? 'the customer'}.</p>
                ) : null}
              </>
            ) : (
              <div className="grid gap-1.5 text-sm">
                <span className="font-medium">Assigned to</span>
                <span className="rounded-md border bg-muted/30 px-3 py-2">{organizationDescription}</span>
              </div>
            )}

            <label className="grid gap-1.5 text-sm font-medium">
              <span>Device type</span>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={type}
                onChange={(event) => {
                  const nextType = event.target.value as DeviceType
                  setType(nextType)
                  if (nextType === 'STRIPE_TERMINAL') {
                    if (!fixedOrganization) setUseLocation(true)
                  }
                }}
              >
                <option value="GENERIC">Generic</option>
                <option value="AC600">AC600</option>
                <option value="STRIPE_TERMINAL">Stripe Terminal</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-sm font-medium">
              <span>Device ID</span>
              <Input
                required
                placeholder={isStripeTerminal ? 'Stripe reader ID (tmr_…)' : 'e.g. pi-studio-1'}
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
              />
            </label>

            <label className="grid gap-1.5 text-sm font-medium">
              <span>Purpose</span>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value as DevicePurpose)}
              >
                <option value="ACCESS">Access</option>
                <option value="CHECK_IN">Check-in</option>
                <option value="PAYMENT">Payment</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-sm font-medium">
              <span>{isEditMode ? 'New device secret (optional)' : 'Device secret'}</span>
              <div className="flex gap-2">
                <Input required={!isEditMode} placeholder={isEditMode ? 'Leave empty to keep the current secret' : undefined} value={secret} onChange={(event) => setSecret(event.target.value)} />
                <Button type="button" variant="outline" onClick={() => setSecret(generateSecret())}>Generate</Button>
              </div>
            </label>

            <label className="grid gap-1.5 text-sm font-medium">
              <span>Name (optional)</span>
              <Input placeholder="Front desk terminal" value={label} onChange={(event) => setLabel(event.target.value)} />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              Active
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-border p-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving || !assignedOrganizationId || !deviceId.trim() || (!isEditMode && !secret.trim())}>
              {isSaving ? 'Saving…' : isEditMode ? 'Save changes' : 'Add device'}
            </Button>
          </div>
        </form>
      )}
    </AppDrawer>
  )
}

function Credential({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      <span className="flex gap-2">
        <Input readOnly value={value} className="font-mono" />
        <Button type="button" variant="outline" onClick={onCopy}>Copy</Button>
      </span>
    </label>
  )
}
