import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { SelectInputAsync } from '@/components/ui/select-input'
import { bookingsQueryKeys } from '@/features/bookings/query-keys'
import { createManualBookingRequest, searchManualBookingRecipientsRequest } from '@/features/bookings/api'
import { getCustomersListRequest } from '@/features/customers/api'
import { getAllLocationsForCustomerRequest } from '@/features/locations/api'
import { searchUpcomingBookableSessionsRequest } from '@/features/classes/api'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import type { ClassSession } from '@/types/class-type'
import type { Customer } from '@/types/customer'
import type { Location } from '@/types/location'
import type { ManualBookingRecipient } from '@/types/booking'

function sessionLabel(session: ClassSession) {
  const startsAt = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: session.timezone || 'Europe/Paris',
  }).format(new Date(session.startTime))
  const capacity = session.bookedCount >= session.capacity ? ' · Full, waitlist' : ` · ${session.capacity - session.bookedCount} spots left`
  return `${session.className ?? 'Class'} · ${startsAt}${capacity}`
}

function userLabel(user: ManualBookingRecipient) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  const contact = [user.phone, user.email].filter(Boolean).join(' · ')
  return name ? `${name}${contact ? ` · ${contact}` : ''}` : contact || user.id
}

export function CreateManualBookingDrawer({
  open,
  onOpenChange,
  initialSession,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSession?: ClassSession | null
}) {
  const queryClient = useQueryClient()
  const { session } = useConnect()
  const isAdminContext = getAppMode() === 'admin'
  const currentCustomer = session?.currentOrganization
  const currentCustomerId = currentCustomer?.id ?? ''
  const [customerId, setCustomerId] = useState('')
  const [customer, setCustomer] = useState<Customer>()
  const [locationId, setLocationId] = useState('')
  const [location, setLocation] = useState<Location>()
  const [sessionId, setSessionId] = useState('')
  const [classSession, setClassSession] = useState<ClassSession>()
  const [userId, setUserId] = useState('')
  const [recipient, setRecipient] = useState<ManualBookingRecipient>()

  useEffect(() => {
    if (!open) return
    const fixedCustomer = !isAdminContext && currentCustomer
      ? { id: currentCustomer.id, name: currentCustomer.name } as Customer
      : undefined
    const sessionCustomer = initialSession?.customerId
      ? { id: initialSession.customerId, name: initialSession.customerName ?? initialSession.customerId } as Customer
      : undefined
    const initialLocation = initialSession
      ? { id: initialSession.organizationId, name: initialSession.locationName ?? initialSession.organizationId } as Location
      : undefined
    setCustomerId(fixedCustomer?.id ?? sessionCustomer?.id ?? '')
    setCustomer(fixedCustomer ?? sessionCustomer)
    setLocationId(initialLocation?.id ?? '')
    setLocation(initialLocation)
    setSessionId(initialSession?.id ?? '')
    setClassSession(initialSession ?? undefined)
    setUserId('')
    setRecipient(undefined)
  }, [open, isAdminContext, currentCustomerId, currentCustomer?.name, initialSession])

  const create = useMutation({
    mutationFn: () => createManualBookingRequest({ customerId, locationId, userId, sessionId }),
    onSuccess: async (booking) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
      ])
      if (booking.status === 'WAITLISTED') {
        toast.success('Client added to the waitlist. A confirmation is being sent to their linked channels.')
      } else {
        const delivery = recipient?.email ? `${recipient.email} and linked channels` : 'their linked channels'
        toast.success(`Booking confirmed. Confirmation is being sent to ${delivery}.`)
      }
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not create the booking.'),
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!customerId || !locationId || !sessionId || !userId) {
      toast.error('Select a customer, location, class session, and client.')
      return
    }
    create.mutate()
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create manual booking"
      description="Create a booking for a client. Confirmed bookings use available credits and send confirmation by email when available, plus linked messaging channels."
      contentClassName="sm:max-w-xl"
    >
      {({ containerRef }) => (
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {isAdminContext && initialSession ? (
              <div className="grid gap-1.5 text-sm font-medium">
                <span>Customer</span>
                <div className="rounded-md border bg-muted/30 px-3 py-2 font-normal">{initialSession.customerName ?? customer?.name ?? 'Current customer'}</div>
              </div>
            ) : isAdminContext ? (
              <SelectInputAsync<Customer>
                label="Customer"
                placeholder="Search customers"
                queryKey={['manual-booking-customers']}
                queryFn={(search) => getCustomersListRequest(undefined, search)}
                getOption={(item) => ({ value: item.id, label: item.name })}
                selectedItems={customer ? [customer] : []}
                value={customerId}
                onValueChange={(value) => {
                  setCustomerId(String(value))
                  setLocationId('')
                  setLocation(undefined)
                  setSessionId('')
                  setClassSession(undefined)
                  setUserId('')
                  setRecipient(undefined)
                }}
                onSelectedItemsChange={(items) => setCustomer(items[0])}
                container={containerRef}
              />
            ) : (
              <div className="grid gap-1.5 text-sm font-medium">
                <span>Customer</span>
                <div className="rounded-md border bg-muted/30 px-3 py-2 font-normal">{currentCustomer?.name ?? 'Current customer'}</div>
              </div>
            )}

            {initialSession ? (
              <>
                <div className="grid gap-1.5 text-sm font-medium">
                  <span>Location</span>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 font-normal">{initialSession.locationName ?? location?.name ?? initialSession.organizationId}</div>
                </div>
                <div className="grid gap-1.5 text-sm font-medium">
                  <span>Class session</span>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 font-normal">{sessionLabel(initialSession)}</div>
                </div>
              </>
            ) : (
              <>
                <SelectInputAsync<Location>
                  label="Location"
                  placeholder={customerId ? 'Search locations' : 'Select a customer first'}
                  queryKey={['manual-booking-locations', customerId]}
                  queryFn={async (search) => {
                    if (!customerId) return []
                    const locations = await getAllLocationsForCustomerRequest(customerId)
                    const query = search.trim().toLocaleLowerCase()
                    return locations.filter((item) => !query || item.name.toLocaleLowerCase().includes(query))
                  }}
                  getOption={(item) => ({ value: item.id, label: item.name })}
                  selectedItems={location ? [location] : []}
                  value={locationId}
                  onValueChange={(value) => {
                    setLocationId(String(value))
                    setSessionId('')
                    setClassSession(undefined)
                    setUserId('')
                    setRecipient(undefined)
                  }}
                  onSelectedItemsChange={(items) => setLocation(items[0])}
                  disabled={!customerId}
                  container={containerRef}
                />

                <SelectInputAsync<ClassSession>
                  label="Class session"
                  placeholder={locationId ? 'Search upcoming sessions' : 'Select a location first'}
                  queryKey={['manual-booking-sessions', locationId]}
                  queryFn={(search) => locationId ? searchUpcomingBookableSessionsRequest(locationId, search) : Promise.resolve([])}
                  getOption={(item) => ({ value: item.id, label: sessionLabel(item) })}
                  selectedItems={classSession ? [classSession] : []}
                  value={sessionId}
                  onValueChange={(value) => setSessionId(String(value))}
                  onSelectedItemsChange={(items) => setClassSession(items[0])}
                  disabled={!locationId}
                  container={containerRef}
                />
              </>
            )}

            <SelectInputAsync<ManualBookingRecipient>
              label="Client"
              placeholder={locationId ? 'Search by name, phone or email' : 'Select a location first'}
              queryKey={['manual-booking-clients', customerId, locationId]}
              queryFn={(search) => customerId && locationId
                ? searchManualBookingRecipientsRequest(customerId, locationId, search)
                : Promise.resolve([])}
              getOption={(item) => ({ value: String(item.id), label: userLabel(item) })}
              selectedItems={recipient ? [recipient] : []}
              value={userId}
              onValueChange={(value) => setUserId(String(value))}
              onSelectedItemsChange={(items) => setRecipient(items[0])}
              disabled={!locationId}
              emptyMessage="No clients linked to this customer were found."
              container={containerRef}
            />

            <p className="text-sm text-muted-foreground">
              Booking rules still apply: the session must be available and the client must have enough credits. If it is full, the client will be waitlisted and no confirmation email will be sent.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t p-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || !customerId || !locationId || !sessionId || !userId}>
              {create.isPending ? 'Creating…' : 'Create booking'}
            </Button>
          </div>
        </form>
      )}
    </AppDrawer>
  )
}
