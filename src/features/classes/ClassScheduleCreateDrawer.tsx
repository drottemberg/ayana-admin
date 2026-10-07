import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectInput } from '@/components/ui/select-input'
import { createClassScheduleRequest, getLocationCoachesRequest } from '@/features/classes/api'
import { classSessionsQueryKeys, classTypesQueryKeys } from '@/features/classes/query-keys'
import type { ClassType } from '@/types/class-type'

const dayOptions = [
  { value: 'MON', label: 'Monday' }, { value: 'TUE', label: 'Tuesday' }, { value: 'WED', label: 'Wednesday' },
  { value: 'THU', label: 'Thursday' }, { value: 'FRI', label: 'Friday' }, { value: 'SAT', label: 'Saturday' }, { value: 'SUN', label: 'Sunday' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

export function ClassScheduleCreateDrawer({
  classType,
  open,
  onOpenChange,
}: {
  classType: ClassType | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [dayOfWeek, setDayOfWeek] = useState('MON')
  const [startTime, setStartTime] = useState('09:00')
  const [capacity, setCapacity] = useState('')
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState('')
  const [coachId, setCoachId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const locationId = classType?.locationId || classType?.organizationId || ''
  const { data: coaches = [], isLoading: isLoadingCoaches } = useQuery({
    queryKey: ['coaches', 'location', locationId],
    queryFn: () => getLocationCoachesRequest(locationId),
    enabled: Boolean(open && locationId),
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!classType) return
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const capacityValue = capacity.trim() ? Number(capacity) : undefined
    if (!Number.isInteger(startHour) || !Number.isInteger(startMinute) ||
      (capacityValue !== undefined && (!Number.isInteger(capacityValue) || capacityValue < 1))) {
      toast.error('Check the start time and capacity.')
      return
    }
    setIsSaving(true)
    try {
      await createClassScheduleRequest(classType.locationId || classType.organizationId, {
        classTypeId: classType.id,
        coachId: coachId || null,
        dayOfWeek: dayOfWeek as NonNullable<import('@/types/class-type').ClassSchedule['dayOfWeek']>,
        startHour,
        startMinute,
        capacity: capacityValue,
        validFrom: validFrom ? new Date(`${validFrom}T00:00:00.000Z`).toISOString() : undefined,
        validUntil: validUntil ? new Date(`${validUntil}T23:59:59.000Z`).toISOString() : undefined,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: classTypesQueryKeys.location(classType.locationId || classType.organizationId) }),
        queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
      ])
      toast.success('Weekly schedule created and upcoming sessions generated.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the schedule.')
    } finally {
      setIsSaving(false)
    }
  }

  return <AppDrawer open={open} onOpenChange={onOpenChange} title="Add class schedule" description={classType?.name} contentClassName="sm:max-w-lg">
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
        <Field label="Repeats every week on">
          <SelectInput aria-label="Day of week" items={dayOptions} value={dayOfWeek} onValueChange={(value) => setDayOfWeek(String(value))} />
        </Field>
        <Field label="Start time"><Input required type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></Field>
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
        <Field label={`Capacity (default ${classType?.maxCapacity ?? 0})`}><Input type="number" min="1" step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="Use class capacity" /></Field>
        <Field label="Valid from"><Input required type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} /></Field>
        <Field label="Valid until (optional)"><Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></Field>
        <p className="text-sm text-muted-foreground">Upcoming sessions are generated automatically from this weekly schedule.</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-5">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
        <Button type="submit" disabled={isSaving || !classType}>{isSaving ? 'Saving…' : 'Create schedule'}</Button>
      </div>
    </form>
  </AppDrawer>
}
