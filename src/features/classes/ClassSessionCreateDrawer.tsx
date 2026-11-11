import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectInput, SelectInputAsync } from '@/components/ui/select-input'
import { Checkbox } from '@/components/ui/checkbox'
import { getCustomersListRequest } from '@/features/customers/api'
import { getAllLocationsForCustomerRequest, getLocationRequest } from '@/features/locations/api'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import { createClassSessionRequest, getActiveClassTypeOptionsForLocationRequest, getClassPassScheduleAvailabilityRequest, getLocationCoachesRequest, type LocationCoach } from '@/features/classes/api'
import { getLocationRoomsRequest, type Room } from '@/features/rooms/api'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import { classSessionLocalInputToIso, toClassSessionLocalInput } from '@/features/classes/time-zone'
import { ClassSessionDateTimeField } from '@/features/classes/ClassSessionDateTimeField'
import type { ClassType } from '@/types/class-type'
import type { Customer } from '@/types/customer'
import type { Location } from '@/types/location'

const NO_COACH_VALUE = '__no_coach__'
const NO_ROOM_VALUE = '__no_room__'
const PENDING_ROOM_VALUE = '__pending_room__'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

function defaultStartTime(timeZone: string) {
  const start = new Date(Date.now() + 30 * 60 * 1000)
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0)
  return toClassSessionLocalInput(start.toISOString(), timeZone)
}

export function ClassSessionCreateDrawer({
  open,
  onOpenChange,
  fixedClassType,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fixedClassType?: ClassType | null
}) {
  const queryClient = useQueryClient()
  const { session } = useConnect()
  const isAdminContext = getAppMode() === 'admin'
  const initialCustomer = useMemo(() => !isAdminContext && session?.currentOrganization
    ? session.currentOrganization as Customer
    : undefined, [isAdminContext, session?.currentOrganization])
  const fixedLocationId = fixedClassType?.locationId || fixedClassType?.organizationId || ''
  const { data: fixedLocation } = useQuery({
    queryKey: ['locations', 'detail', fixedLocationId],
    queryFn: () => getLocationRequest(fixedLocationId),
    enabled: Boolean(open && fixedClassType && fixedLocationId),
  })
  const [customer, setCustomer] = useState<Customer>()
  const [location, setLocation] = useState<Location>()
  const [classType, setClassType] = useState<ClassType>()
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [capacity, setCapacity] = useState('')
  const [createClassPassSchedule, setCreateClassPassSchedule] = useState(false)
  const [classPassSpots, setClassPassSpots] = useState('')
  const [coachId, setCoachId] = useState(NO_COACH_VALUE)
  const [coachName, setCoachName] = useState('')
  const [roomId, setRoomId] = useState(PENDING_ROOM_VALUE)
  const [isSaving, setIsSaving] = useState(false)

  const customerId = customer?.id ?? ''
  const locationId = location?.id ?? ''
  const timeZone = location?.timezone || 'Europe/Paris'
  const { data: coaches = [], isLoading: isLoadingCoaches } = useQuery<LocationCoach[]>({
    queryKey: ['coaches', 'location', locationId, 'create-session'],
    queryFn: () => getLocationCoachesRequest(locationId),
    enabled: Boolean(open && locationId),
  })
  const { data: hasClassPassIntegration = false } = useQuery({
    queryKey: ['classpass-session-availability', locationId, classType?.id],
    queryFn: () => getClassPassScheduleAvailabilityRequest(locationId, classType!.id),
    enabled: Boolean(open && locationId && classType?.id),
  })
  const { data: rooms = [], isLoading: isLoadingRooms } = useQuery<Room[]>({
    queryKey: ['rooms', 'location', locationId],
    queryFn: () => getLocationRoomsRequest(locationId),
    enabled: Boolean(open && locationId),
  })

  useEffect(() => {
    if (open && locationId) setRoomId(PENDING_ROOM_VALUE)
  }, [open, locationId])

  useEffect(() => {
    if (!open || !locationId || roomId !== PENDING_ROOM_VALUE || isLoadingRooms) return
    setRoomId(rooms.find((room) => room.isDefault && room.isEnabled)?.id ?? NO_ROOM_VALUE)
  }, [open, locationId, roomId, rooms, isLoadingRooms])

  useEffect(() => {
    if (!open) return
    setCustomer(fixedClassType
      ? { id: fixedClassType.customerId, name: fixedClassType.customerName } as Customer
      : initialCustomer)
    setLocation(undefined)
    setClassType(fixedClassType ?? undefined)
    setStartTime('')
    setEndTime('')
    setCapacity(fixedClassType ? String(fixedClassType.maxCapacity) : '')
    setCreateClassPassSchedule(false)
    setClassPassSpots('')
    setCoachId(NO_COACH_VALUE)
    setCoachName('')
    setRoomId(PENDING_ROOM_VALUE)
  }, [open, initialCustomer, fixedClassType])

  useEffect(() => {
    if (!open || !fixedClassType || !fixedLocation) return
    setLocation(fixedLocation)
    setSessionStart(defaultStartTime(fixedLocation.timezone || 'Europe/Paris'), fixedClassType, fixedLocation)
  }, [open, fixedClassType, fixedLocation])

  function setSessionStart(value: string, selectedClass = classType, selectedLocation = location) {
    setStartTime(value)
    if (!value || !selectedClass || !selectedLocation) {
      setEndTime('')
      return
    }
    try {
      const startIso = classSessionLocalInputToIso(value, selectedLocation.timezone)
      setEndTime(toClassSessionLocalInput(new Date(Date.parse(startIso) + selectedClass.duration * 60_000).toISOString(), selectedLocation.timezone))
    } catch {
      setEndTime('')
    }
  }

  function selectLocation(value?: Location) {
    setLocation(value)
    setClassType(undefined)
    setCapacity('')
    setCoachId(NO_COACH_VALUE)
    setCoachName('')
    if (!value) {
      setStartTime('')
      setEndTime('')
      return
    }
    setSessionStart(defaultStartTime(value.timezone || 'Europe/Paris'), undefined, value)
  }

  function selectClassType(value?: ClassType) {
    setClassType(value)
    setCapacity(value ? String(value.maxCapacity) : '')
    if (value && location && startTime) setSessionStart(startTime, value, location)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const capacityValue = Number(capacity)
    if (!locationId || !classType || !startTime || !endTime || !Number.isInteger(capacityValue) || capacityValue < 1) {
      toast.error('Select a location and class, then check the session times and capacity.')
      return
    }

    let startIso: string
    let endIso: string
    try {
      startIso = classSessionLocalInputToIso(startTime, timeZone)
      endIso = classSessionLocalInputToIso(endTime, timeZone)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Check the session times.')
      return
    }
    if (new Date(endIso) <= new Date(startIso)) {
      toast.error('The end time must be after the start time.')
      return
    }

    setIsSaving(true)
    try {
      await createClassSessionRequest(locationId, {
        classTypeId: classType.id,
        coachId: coachId === NO_COACH_VALUE ? null : coachId,
        coachName: coachName.trim() || null,
        roomId: roomId === PENDING_ROOM_VALUE || roomId === NO_ROOM_VALUE ? null : roomId,
        startTime: startIso,
        endTime: endIso,
        capacity: capacityValue,
        createClassPassSchedule,
        ...(createClassPassSchedule ? { classPassSpots: Number(classPassSpots || capacityValue) } : {}),
      })
      await queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all })
      toast.success('Class session created.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the class session.')
    } finally {
      setIsSaving(false)
    }
  }

  return <AppDrawer open={open} onOpenChange={onOpenChange} title="Add session" description="Create a one-time class session." contentClassName="sm:max-w-lg">
    {({ containerRef }) => (
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
          {fixedClassType ? (
            <>
              <Field label="Location"><Input readOnly value={fixedClassType.locationName} /></Field>
              <Field label="Class"><Input readOnly value={fixedClassType.name} /></Field>
            </>
          ) : isAdminContext ? (
            <SelectInputAsync<Customer>
              label="Customer"
              placeholder="Search customers"
              required
              queryKey={['class-session-create-customers']}
              queryFn={(search) => getCustomersListRequest(undefined, search)}
              getOption={(item) => ({ value: item.id, label: item.name })}
              selectedItems={customer ? [customer] : []}
              value={customerId}
              onValueChange={() => { setCustomer(undefined); selectLocation(undefined); setClassType(undefined) }}
              onSelectedItemsChange={(items) => { setCustomer(items[0]); selectLocation(undefined); setClassType(undefined) }}
              container={containerRef}
            />
          ) : (
            <Field label="Customer"><Input readOnly value={customer?.name ?? initialCustomer?.name ?? ''} /></Field>
          )}

          {!fixedClassType ? <SelectInputAsync<Location>
            label="Location"
            placeholder={customerId ? 'Search locations' : 'Select a customer first'}
            required
            queryKey={['class-session-create-locations', customerId]}
            queryFn={async (search) => {
              if (!customerId) return []
              const locations = await getAllLocationsForCustomerRequest(customerId)
              const query = search.trim().toLocaleLowerCase()
              return locations.filter((item) => !query || item.name.toLocaleLowerCase().includes(query))
            }}
            getOption={(item) => ({ value: item.id, label: item.name })}
            selectedItems={location ? [location] : []}
            value={locationId}
            onValueChange={() => selectLocation(undefined)}
            onSelectedItemsChange={(items) => selectLocation(items[0])}
            disabled={!customerId}
            container={containerRef}
          /> : null}

          {!fixedClassType ? <SelectInputAsync<ClassType>
            label="Class"
            placeholder={locationId ? 'Search classes' : 'Select a location first'}
            required
            queryKey={['class-session-create-classes', locationId]}
            queryFn={(search) => locationId ? getActiveClassTypeOptionsForLocationRequest(locationId, search) : Promise.resolve([])}
            getOption={(item) => ({ value: item.id, label: item.name })}
            selectedItems={classType ? [classType] : []}
            value={classType?.id ?? ''}
            onValueChange={() => selectClassType(undefined)}
            onSelectedItemsChange={(items) => selectClassType(items[0])}
            disabled={!locationId}
            container={containerRef}
          /> : null}

          <ClassSessionDateTimeField label="Starts" value={startTime} onValueChange={setSessionStart} />
          <ClassSessionDateTimeField label="Ends" value={endTime} onValueChange={setEndTime} />
          <Field label="Capacity"><Input required type="number" min="1" step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></Field>
          {hasClassPassIntegration ? <div className="space-y-3 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={createClassPassSchedule} onCheckedChange={(checked) => setCreateClassPassSchedule(checked === true)} />
              Create this session on ClassPass
            </label>
            {createClassPassSchedule ? <Field label="ClassPass spots"><Input required type="number" min="1" step="1" value={classPassSpots || capacity} onChange={(event) => setClassPassSpots(event.target.value)} /></Field> : null}
          </div> : null}
          <Field label="Room">
            <SelectInput
              aria-label="Room"
              items={[{ value: NO_ROOM_VALUE, label: 'No room' }, ...rooms.filter((room) => room.isEnabled).map((room) => ({ value: room.id, label: `${room.name}${room.isDefault ? ' · Default' : ''}` }))]}
              value={roomId === PENDING_ROOM_VALUE ? '' : roomId}
              onValueChange={(value) => setRoomId(String(value))}
              isLoading={isLoadingRooms}
              loadingMessage="Loading rooms..."
              placeholder="Select a room"
              emptyMessage="No enabled rooms at this location."
              disabled={!locationId}
            />
          </Field>
          <Field label="Coach">
            <SelectInput
              aria-label="Coach"
              items={[{ value: NO_COACH_VALUE, label: 'No coach' }, ...coaches.map((coach) => ({ value: coach.userId, label: coach.coachName }))]}
              value={coachId}
              onValueChange={(value) => setCoachId(String(value))}
              isLoading={isLoadingCoaches}
              loadingMessage="Loading coaches..."
              placeholder="Select a coach"
              emptyMessage="No qualified instructors assigned to this location."
              disabled={!locationId}
            />
          </Field>
          <Field label="Coach name (optional)"><Input value={coachName} onChange={(event) => setCoachName(event.target.value)} placeholder="Enter a name if the coach isn't in the system" /></Field>
          <p className="-mt-3 text-xs text-muted-foreground">A linked coach’s profile name takes priority.</p>
          {location ? <p className="text-sm text-muted-foreground">Times use the {timeZone} time zone.</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button type="submit" disabled={isSaving || !locationId || !classType}>{isSaving ? 'Saving…' : 'Create session'}</Button>
        </div>
      </form>
    )}
  </AppDrawer>
}
