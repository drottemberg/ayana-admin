import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectInput, SelectInputAsync } from '@/components/ui/select-input'
import { Checkbox } from '@/components/ui/checkbox'
import { getActiveClassTypeOptionsForLocationRequest, getClassSessionRequest, getLocationCoachesRequest, updateClassSessionRequest } from '@/features/classes/api'
import { getLocationRoomsRequest, type Room } from '@/features/rooms/api'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import type { ClassSession } from '@/types/class-type'
import type { ClassType } from '@/types/class-type'
import { classSessionLocalInputToIso, toClassSessionLocalInput } from '@/features/classes/time-zone'
import { ClassSessionDateTimeField } from '@/features/classes/ClassSessionDateTimeField'

const NO_COACH_VALUE = '__no_coach__'
const SCHEDULE_COACH_VALUE = '__schedule_coach__'
const NO_ROOM_VALUE = '__no_room__'
const SCHEDULE_ROOM_VALUE = '__schedule_room__'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

export function ClassSessionEditDrawer({
  session,
  locationId,
  timeZone,
  open,
  onOpenChange,
}: {
  session: ClassSession | null
  locationId: string
  timeZone: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [capacity, setCapacity] = useState('')
  const [createClassPassSchedule, setCreateClassPassSchedule] = useState(false)
  const [classPassSpots, setClassPassSpots] = useState('')
  const [classTypeId, setClassTypeId] = useState('')
  const [coachId, setCoachId] = useState('')
  const [coachName, setCoachName] = useState('')
  const [roomId, setRoomId] = useState(NO_ROOM_VALUE)
  const [isSaving, setIsSaving] = useState(false)
  const { data: sessionDetails, isLoading: isLoadingSessionDetails } = useQuery<ClassSession>({
    queryKey: ['class-sessions', 'detail', locationId, session?.id],
    queryFn: () => getClassSessionRequest(session!.id, locationId),
    enabled: Boolean(open && session?.id && locationId),
  })
  const classPassSchedules = sessionDetails?.classPassSchedules ?? session?.classPassSchedules ?? []
  const { data: coaches = [], isLoading: isLoadingCoaches } = useQuery({
    queryKey: ['coaches', 'location', locationId, session?.classTypeId],
    queryFn: () => getLocationCoachesRequest(locationId),
    enabled: Boolean(open && locationId),
  })
  const { data: rooms = [], isLoading: isLoadingRooms } = useQuery<Room[]>({
    queryKey: ['rooms', 'location', locationId],
    queryFn: () => getLocationRoomsRequest(locationId),
    enabled: Boolean(open && locationId),
  })

  useEffect(() => {
    if (!session || !open) return
    setStartTime(toClassSessionLocalInput(session.startTime, timeZone))
    setEndTime(toClassSessionLocalInput(session.endTime, timeZone))
    setCapacity(String(session.capacity))
    setCreateClassPassSchedule(false)
    setClassPassSpots(String(session.capacity))
    setClassTypeId(session.classTypeId)
    setCoachId(session.scheduleId && !session.coachOverride ? SCHEDULE_COACH_VALUE : session.coachId ?? NO_COACH_VALUE)
    setCoachName(session.coachCustomName ?? (session.coachOverride && !session.coachId ? session.coachName ?? '' : ''))
    setRoomId(session.scheduleId && !session.roomOverride ? SCHEDULE_ROOM_VALUE : session.roomId ?? NO_ROOM_VALUE)
  }, [open, session, timeZone])

  let startMoved = false
  if (session && startTime) {
    try {
      startMoved = new Date(classSessionLocalInputToIso(startTime, timeZone)).getTime() !== new Date(session.startTime).getTime()
    } catch {
      startMoved = false
    }
  }
  const hasMappedClassPassSchedule = classPassSchedules.length > 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session) return

    const capacityValue = Number(capacity)
    let startIso: string
    let endIso: string
    try {
      startIso = classSessionLocalInputToIso(startTime, timeZone)
      endIso = classSessionLocalInputToIso(endTime, timeZone)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Check the session times.')
      return
    }
    if (new Date(endIso) <= new Date(startIso) || !Number.isInteger(capacityValue) || capacityValue < session.bookedCount) {
      toast.error(`Check the session times and capacity. Capacity must be at least ${session.bookedCount}.`)
      return
    }

    setIsSaving(true)
    try {
      await updateClassSessionRequest(session.id, locationId, {
        classTypeId,
        startTime: startIso,
        endTime: endIso,
        capacity: capacityValue,
        coachId: coachId === SCHEDULE_COACH_VALUE || coachId === NO_COACH_VALUE ? null : coachId,
        coachName: coachName.trim() || null,
        useScheduleCoach: coachId === SCHEDULE_COACH_VALUE,
        roomId: roomId === SCHEDULE_ROOM_VALUE || roomId === NO_ROOM_VALUE ? null : roomId,
        useScheduleRoom: roomId === SCHEDULE_ROOM_VALUE,
        ...(startMoved && hasMappedClassPassSchedule ? {
          createClassPassSchedule,
          ...(createClassPassSchedule ? { classPassSpots: Number(classPassSpots || capacityValue) } : {}),
        } : {}),
      })
      await queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all })
      toast.success('Class session updated.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the class session.')
    } finally {
      setIsSaving(false)
    }
  }

  return <AppDrawer
    open={open}
    onOpenChange={onOpenChange}
    title="Edit class session"
    description={session?.className ?? session?.id}
    contentClassName="sm:max-w-lg"
  >
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
        <SelectInputAsync<ClassType>
          label="Class"
          placeholder="Search classes"
          required
          queryKey={['class-session-edit-classes', locationId]}
          queryFn={(search) => getActiveClassTypeOptionsForLocationRequest(locationId, search)}
          getOption={(item) => ({ value: item.id, label: item.name })}
          selectedItems={classTypeId ? [{ id: classTypeId, name: classTypeId === session?.classTypeId ? session?.className ?? classTypeId : classTypeId } as ClassType] : []}
          value={classTypeId}
          onValueChange={() => setClassTypeId('')}
          onSelectedItemsChange={(items) => setClassTypeId(items[0]?.id ?? '')}
          disabled={!locationId}
        />
        <ClassSessionDateTimeField label="Starts" value={startTime} onValueChange={setStartTime} />
        <ClassSessionDateTimeField label="Ends" value={endTime} onValueChange={setEndTime} />
        <Field label="Capacity"><Input required type="number" min={session?.bookedCount ?? 0} step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></Field>
        {startMoved && hasMappedClassPassSchedule ? <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm text-muted-foreground">The current ClassPass schedule will be cancelled because this session is moving.</p>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={createClassPassSchedule} onCheckedChange={(checked) => setCreateClassPassSchedule(checked === true)} />
            Create a new ClassPass schedule at the new time
          </label>
          {createClassPassSchedule ? <Field label="ClassPass spots"><Input required type="number" min="1" step="1" value={classPassSpots || capacity} onChange={(event) => setClassPassSpots(event.target.value)} /></Field> : null}
        </div> : null}
        <Field label="Room">
          <SelectInput
            aria-label="Room"
            items={[
              ...(session?.scheduleId ? [{ value: SCHEDULE_ROOM_VALUE, label: 'Use schedule room' }] : []),
              { value: NO_ROOM_VALUE, label: 'No room' },
              ...rooms.filter((room) => room.isEnabled || room.id === session?.roomId).map((room) => ({ value: room.id, label: `${room.name}${room.isDefault ? ' · Default' : room.isEnabled ? '' : ' · Disabled'}` })),
              ...(session?.roomId && !rooms.some((room) => room.id === session.roomId) ? [{ value: session.roomId, label: `Current room (${session.roomId})` }] : []),
            ]}
            value={roomId}
            onValueChange={(value) => setRoomId(String(value))}
            isLoading={isLoadingRooms}
            loadingMessage="Loading rooms..."
            placeholder="Select a room"
            emptyMessage="No enabled rooms at this location."
          />
        </Field>
        <Field label="Coach">
          <SelectInput
            aria-label="Coach"
            items={[
              ...(session?.scheduleId ? [{ value: SCHEDULE_COACH_VALUE, label: 'Use schedule coach' }] : []),
              { value: NO_COACH_VALUE, label: 'No coach' },
              ...coaches.map((coach) => ({ value: coach.userId, label: coach.coachName })),
            ]}
            value={coachId}
            onValueChange={(value) => setCoachId(String(value))}
            isLoading={isLoadingCoaches}
            loadingMessage="Loading coaches..."
            placeholder="Select a coach"
            emptyMessage="No qualified instructors assigned to this location."
          />
        </Field>
        <Field label="Coach name (optional)"><Input value={coachName} onChange={(event) => {
          setCoachName(event.target.value)
          if (event.target.value.trim() && coachId === SCHEDULE_COACH_VALUE) setCoachId(NO_COACH_VALUE)
        }} placeholder="Enter a name if the coach isn't in the system" /></Field>
        <p className="-mt-3 text-xs text-muted-foreground">A linked coach’s profile name takes priority.</p>
        <p className="text-sm text-muted-foreground">Existing bookings stay attached to this session when its class changes.</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-5">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
        <Button type="submit" disabled={isSaving || isLoadingSessionDetails || !session}>{isSaving ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </form>
  </AppDrawer>
}
