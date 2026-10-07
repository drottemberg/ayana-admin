import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectInput } from '@/components/ui/select-input'
import { getLocationCoachesRequest, updateClassSessionRequest } from '@/features/classes/api'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import type { ClassSession } from '@/types/class-type'

function toLocalInput(value: string) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

export function ClassSessionEditDrawer({
  session,
  locationId,
  open,
  onOpenChange,
}: {
  session: ClassSession | null
  locationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [capacity, setCapacity] = useState('')
  const [coachId, setCoachId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const { data: coaches = [], isLoading: isLoadingCoaches } = useQuery({
    queryKey: ['coaches', 'location', locationId],
    queryFn: () => getLocationCoachesRequest(locationId),
    enabled: Boolean(open && locationId),
  })

  useEffect(() => {
    if (!session || !open) return
    setStartTime(toLocalInput(session.startTime))
    setEndTime(toLocalInput(session.endTime))
    setCapacity(String(session.capacity))
    setCoachId(session.coachId ?? '')
  }, [open, session])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session) return

    const start = new Date(startTime)
    const end = new Date(endTime)
    const capacityValue = Number(capacity)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start ||
      !Number.isInteger(capacityValue) || capacityValue < session.bookedCount) {
      toast.error(`Check the session times and capacity. Capacity must be at least ${session.bookedCount}.`)
      return
    }

    setIsSaving(true)
    try {
      await updateClassSessionRequest(session.id, locationId, {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        capacity: capacityValue,
        coachId: coachId || null,
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
        <Field label="Starts"><Input required type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></Field>
        <Field label="Ends"><Input required type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></Field>
        <Field label="Capacity"><Input required type="number" min={session?.bookedCount ?? 0} step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></Field>
        <Field label="Coach">
          <SelectInput
            aria-label="Coach"
            items={[{ value: '', label: 'No coach' }, ...coaches.map((coach) => ({ value: coach.userId, label: coach.coachName }))]}
            value={coachId}
            onValueChange={(value) => setCoachId(String(value))}
            isLoading={isLoadingCoaches}
            loadingMessage="Loading coaches..."
            placeholder="Select a coach"
            emptyMessage="No coaches assigned to this location."
          />
        </Field>
        <p className="text-sm text-muted-foreground">The class type and existing bookings stay attached to this session.</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-5">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
        <Button type="submit" disabled={isSaving || !session}>{isSaving ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </form>
  </AppDrawer>
}
