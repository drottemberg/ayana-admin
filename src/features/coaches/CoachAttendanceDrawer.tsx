import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { SelectInput } from '@/components/ui/select-input'
import { getCoachSessionAttendanceRequest, saveCoachSessionAttendanceRequest } from '@/features/coaches/api'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import type { ClassSession } from '@/types/class-type'

type AttendanceValue = 'unmarked' | 'present' | 'no-show'

export function CoachAttendanceDrawer({
  session,
  open,
  onOpenChange,
}: {
  session: ClassSession
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Record<string, AttendanceValue>>({})
  const [isSaving, setIsSaving] = useState(false)
  const attendance = useQuery({
    queryKey: ['coaches', 'attendance', session.id],
    queryFn: () => getCoachSessionAttendanceRequest(session.id),
    enabled: open,
  })

  useEffect(() => {
    if (!open || !attendance.data) return
    setValues(Object.fromEntries(attendance.data.bookings.map((booking) => [
      booking.bookingId,
      booking.status === 'ATTENDED' ? 'present' : booking.status === 'NO_SHOW' ? 'no-show' : 'unmarked',
    ])))
  }, [open, attendance.data])

  const markedCount = useMemo(() => Object.values(values).filter((value) => value !== 'unmarked').length, [values])

  const save = async () => {
    const records = Object.entries(values)
      .filter(([, value]) => value !== 'unmarked')
      .map(([bookingId, value]) => ({ bookingId, present: value === 'present' }))
    if (!records.length) {
      toast.error('Mark at least one attendee before saving.')
      return
    }
    setIsSaving(true)
    try {
      await saveCoachSessionAttendanceRequest(session.id, records)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['coaches', 'attendance', session.id] }),
        queryClient.invalidateQueries({ queryKey: [...classSessionsQueryKeys.detail(session.id), 'bookings'] }),
        queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
      ])
      toast.success('Attendance saved.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save attendance.')
    } finally {
      setIsSaving(false)
    }
  }

  return <AppDrawer
    open={open}
    onOpenChange={onOpenChange}
    title="Take attendance"
    description="Mark each confirmed booking as present or absent. Unmarked bookings are left unchanged."
    contentClassName="sm:max-w-2xl"
  >
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-3">
        {attendance.isLoading ? <p className="text-sm text-muted-foreground">Loading attendees…</p> : null}
        {attendance.isError ? <p role="alert" className="text-sm text-destructive">Could not load the attendance list.</p> : null}
        {attendance.data?.bookings.length === 0 ? <p className="text-sm text-muted-foreground">There are no confirmed bookings for this session.</p> : null}
        {attendance.data?.bookings.map((booking) => {
          const name = [booking.firstName, booking.lastName].filter(Boolean).join(' ') || booking.email || 'Member'
          return <div key={booking.bookingId} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="truncate font-medium">{name}</div>
              {booking.email ? <div className="truncate text-sm text-muted-foreground">{booking.email}</div> : null}
              {booking.phone ? <div className="truncate text-sm text-muted-foreground">{booking.phone}</div> : null}
            </div>
            <SelectInput
              aria-label={`Attendance for ${name}`}
              items={[
                { value: 'unmarked', label: 'Not marked' },
                { value: 'present', label: 'Present' },
                { value: 'no-show', label: 'Absent / no-show' },
              ]}
              value={values[booking.bookingId] ?? 'unmarked'}
              onValueChange={(value) => setValues((current) => ({ ...current, [booking.bookingId]: String(value) as AttendanceValue }))}
            />
          </div>
        })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border p-5">
        <span className="text-sm text-muted-foreground">{markedCount} marked</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button type="button" onClick={() => void save()} disabled={isSaving || attendance.isLoading || attendance.isError || markedCount === 0}>
            {isSaving ? 'Saving…' : 'Save attendance'}
          </Button>
        </div>
      </div>
    </div>
  </AppDrawer>
}
