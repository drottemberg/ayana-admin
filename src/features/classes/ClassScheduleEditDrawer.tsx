import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { SelectInput } from '@/components/ui/select-input'
import { getLocationCoachesRequest, updateClassScheduleRequest } from '@/features/classes/api'
import { classSessionsQueryKeys, classTypesQueryKeys } from '@/features/classes/query-keys'
import type { ClassSchedule, ClassType } from '@/types/class-type'

const dayOptions = [
  { value: 'MON', label: 'Monday' }, { value: 'TUE', label: 'Tuesday' }, { value: 'WED', label: 'Wednesday' },
  { value: 'THU', label: 'Thursday' }, { value: 'FRI', label: 'Friday' }, { value: 'SAT', label: 'Saturday' }, { value: 'SUN', label: 'Sunday' },
]

function dateInput(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : ''
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

export function ClassScheduleEditDrawer({
  schedule,
  classType,
  locationId,
  open,
  onOpenChange,
}: {
  schedule: ClassSchedule | null
  classType: ClassType | null
  locationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [dayOfWeek, setDayOfWeek] = useState('MON')
  const [startTime, setStartTime] = useState('09:00')
  const [capacity, setCapacity] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [coachId, setCoachId] = useState('')
  const [autoGenerateSessions, setAutoGenerateSessions] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { data: coaches = [], isLoading: isLoadingCoaches } = useQuery({
    queryKey: ['coaches', 'location', locationId],
    queryFn: () => getLocationCoachesRequest(locationId),
    enabled: Boolean(open && locationId),
  })

  useEffect(() => {
    if (!schedule || !open) return
    setDayOfWeek(schedule.dayOfWeek ?? 'MON')
    setStartTime(`${String(schedule.startHour).padStart(2, '0')}:${String(schedule.startMinute).padStart(2, '0')}`)
    setCapacity(schedule.capacity == null ? '' : String(schedule.capacity))
    setValidFrom(dateInput(schedule.validFrom))
    setValidUntil(dateInput(schedule.validUntil))
    setCoachId(schedule.coachId ?? '')
    setAutoGenerateSessions(schedule.autoGenerateSessions !== false)
  }, [open, schedule])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!schedule) return
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const capacityValue = capacity.trim() ? Number(capacity) : null
    if (!Number.isInteger(startHour) || !Number.isInteger(startMinute) ||
      (capacityValue !== null && (!Number.isInteger(capacityValue) || capacityValue < 1))) {
      toast.error('Check the schedule time and capacity.')
      return
    }
    if (validUntil && validFrom && new Date(validUntil) < new Date(validFrom)) {
      toast.error('The end date must be on or after the start date.')
      return
    }

    setIsSaving(true)
    try {
      await updateClassScheduleRequest(locationId, schedule.id, {
        dayOfWeek: dayOfWeek as NonNullable<ClassSchedule['dayOfWeek']>,
        startHour,
        startMinute,
        capacity: capacityValue,
        validFrom: validFrom ? new Date(`${validFrom}T00:00:00.000Z`).toISOString() : null,
        validUntil: validUntil ? new Date(`${validUntil}T23:59:59.000Z`).toISOString() : null,
        coachId: coachId || null,
        autoGenerateSessions,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: classTypesQueryKeys.location(locationId) }),
        queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
      ])
      toast.success('Schedule updated. Sessions with existing bookings were preserved.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the schedule.')
    } finally {
      setIsSaving(false)
    }
  }

  return <AppDrawer open={open} onOpenChange={onOpenChange} title="Edit schedule" description={classType?.name} contentClassName="sm:max-w-lg">
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
        <Field label="Repeats every week on"><SelectInput aria-label="Day of week" items={dayOptions} value={dayOfWeek} onValueChange={(value) => setDayOfWeek(String(value))} /></Field>
        <Field label="Start time"><Input required type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></Field>
        <Field label={`Capacity (default ${classType?.maxCapacity ?? 0})`}><Input type="number" min="1" step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="Use class capacity" /></Field>
        <Field label="Default coach">
          <SelectInput
            aria-label="Default coach"
            items={[{ value: '', label: 'No coach' }, ...coaches.map((coach) => ({ value: coach.userId, label: coach.coachName }))]}
            value={coachId}
            onValueChange={(value) => setCoachId(String(value))}
            isLoading={isLoadingCoaches}
            loadingMessage="Loading coaches..."
            placeholder="Select a coach"
            emptyMessage="No coaches assigned to this location."
          />
        </Field>
        <Field label="Valid from"><Input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} /></Field>
        <Field label="Valid until"><Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></Field>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={autoGenerateSessions} onCheckedChange={(checked) => setAutoGenerateSessions(Boolean(checked))} className="mt-0.5" />
          <span><span className="font-medium">Generate sessions automatically</span><span className="mt-0.5 block text-muted-foreground">When disabled, no bookable sessions are created automatically. You can generate them manually from the schedule actions.</span></span>
        </label>
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-5">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
        <Button type="submit" disabled={isSaving || !schedule}>{isSaving ? 'Saving…' : 'Save schedule'}</Button>
      </div>
    </form>
  </AppDrawer>
}
