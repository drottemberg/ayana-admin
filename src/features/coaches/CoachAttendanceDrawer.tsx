import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon'
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon'
import MoreHorizontalIcon from '@hugeicons/core-free-icons/MoreHorizontalIcon'
import { HugeiconsIcon } from '@hugeicons/react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { DropdownActionsMenu } from '@/components/ui/dropdown-menu'
import { getCoachSessionAttendanceRequest, saveCoachSessionAttendanceRequest } from '@/features/coaches/api'
import { bookingsQueryKeys } from '@/features/bookings/query-keys'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import type { ClassSession } from '@/types/class-type'
import { cn } from '@/lib/utils'

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
  const [savingBookingId, setSavingBookingId] = useState<string | null>(null)
  const attendance = useQuery({
    queryKey: ['coaches', 'attendance', session.id],
    queryFn: () => getCoachSessionAttendanceRequest(session.id),
    enabled: open,
  })

  const invalidateAttendance = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['coaches', 'attendance', session.id] }),
    queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: [...classSessionsQueryKeys.detail(session.id), 'bookings'] }),
    queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
  ])

  const setAttendance = async (bookingId: string, present: boolean | null) => {
    setSavingBookingId(bookingId)
    try {
      await saveCoachSessionAttendanceRequest(session.id, [{ bookingId, present }])
      await invalidateAttendance()
      toast.success(present === true ? 'Booking marked present.' : present === false ? 'Booking marked absent.' : 'Attendance cleared.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update attendance.')
    } finally {
      setSavingBookingId(null)
    }
  }

  return <AppDrawer
    open={open}
    onOpenChange={onOpenChange}
    title="Take attendance"
    description="Mark each booking present or absent. Use the row menu to clear an attendance mark. Changes save immediately."
    contentClassName="sm:max-w-2xl"
  >
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-3">
        {attendance.isLoading ? <p className="text-sm text-muted-foreground">Loading attendees…</p> : null}
        {attendance.isError ? <p role="alert" className="text-sm text-destructive">Could not load the attendance list.</p> : null}
        {attendance.data && !attendance.data.attendanceAvailable ? <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">Roster is available now. Attendance opens 90 minutes before class.</p> : null}
        {attendance.data?.bookings.length === 0 ? <p className="text-sm text-muted-foreground">There are no confirmed bookings for this session.</p> : null}
        {attendance.data?.bookings.map((booking) => {
          const name = [booking.firstName, booking.lastName].filter(Boolean).join(' ') || 'Member'
          const attended = booking.status === 'ATTENDED' ? true : booking.status === 'NO_SHOW' ? false : null
          const isSaving = savingBookingId === booking.bookingId
          return <div key={booking.bookingId} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="truncate font-medium">{name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {booking.visitInsight ? <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{booking.visitInsight === 'FIRST_VISIT' ? 'First visit' : booking.visitInsight === 'REGULAR' ? 'Regular' : 'Returning'}</span> : null}
                <Link
                  className="text-xs underline underline-offset-2"
                  to={`/class-sessions/${encodeURIComponent(session.id)}?locationId=${encodeURIComponent(session.organizationId)}&memberUserId=${encodeURIComponent(booking.userId)}#module-bookings`}
                >View profile</Link>
              </div>
              {booking.preferences && Object.keys(booking.preferences).length ? <div className="mt-1 text-sm text-muted-foreground">{Object.entries(booking.preferences).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : JSON.stringify(value)}`).join(' · ')}</div> : null}
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={cn(
                  'size-8 rounded-full p-0',
                  attended === true && 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white',
                )}
                aria-label={`Mark ${name} present`}
                aria-pressed={attended === true}
                title="Mark present"
                disabled={isSaving || !attendance.data?.attendanceAvailable}
                onClick={() => void setAttendance(booking.bookingId, true)}
              >
                <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={cn(
                  'size-8 rounded-full p-0',
                  attended === false && 'border-red-600 text-red-600 hover:bg-red-50 hover:text-red-700',
                )}
                aria-label={`Mark ${name} absent`}
                aria-pressed={attended === false}
                title="Mark absent"
                disabled={isSaving || !attendance.data?.attendanceAvailable}
                onClick={() => void setAttendance(booking.bookingId, false)}
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
              </Button>
              <DropdownActionsMenu
                items={[{ label: 'Clear attendance', disabled: attended === null || isSaving || !attendance.data?.attendanceAvailable, onClick: () => void setAttendance(booking.bookingId, null) }]}
                align="end"
                triggerRender={<Button type="button" variant="ghost" size="icon-sm" aria-label={`More attendance actions for ${name}`} disabled={isSaving} />}
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} size={16} strokeWidth={1} />
              </DropdownActionsMenu>
            </div>
          </div>
        })}
      </div>
      <div className="flex justify-end border-t border-border p-5">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
      </div>
    </div>
  </AppDrawer>
}
