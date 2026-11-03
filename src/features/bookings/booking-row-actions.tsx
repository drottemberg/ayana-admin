import { createRef } from 'react'
import { toast } from 'sonner'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { Modals } from '@/providers/modal'
import { BookingCancellationConfirmation } from './BookingCancellationConfirmation'
import { cancelBookingForManagementRequest, cancelClassPassBookingForManagementRequest, createManualBookingRequest, getBookingCancellationQuoteRequest, updateBookingAttendanceRequest } from './api'

export async function cancelBookingWithChoice(bookingId: string, locationId: string, invalidate: () => Promise<unknown>) {
  try {
    const quote = await getBookingCancellationQuoteRequest(bookingId, locationId)
    const applyPenaltyRef = createRef<HTMLInputElement>()
    let applyPenalty = false
    const confirmed = await Modals.confirm({
      title: 'Cancel this booking?',
      content: <BookingCancellationConfirmation quote={quote} applyPenaltyRef={applyPenaltyRef} />,
      okText: 'Cancel booking',
      cancelText: 'Keep booking',
      okButtonProps: { variant: 'destructive' },
      onOk: () => { applyPenalty = Boolean(applyPenaltyRef.current?.checked) },
    })
    if (!confirmed) return
    await cancelBookingForManagementRequest(bookingId, locationId, applyPenalty)
    await invalidate()
    toast.success('Booking cancelled. The client has been notified and the credit balance was updated.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not cancel this booking.')
  }
}

export async function rebookClientForSession(input: {
  customerId: string
  locationId: string
  sessionId: string
  userId: string
  clientName: string
  invalidate: () => Promise<unknown>
}) {
  const confirmed = await Modals.confirm({
    title: 'Re-add this client to the class?',
    content: `${input.clientName} will be booked again. A credit is used if a place is available; otherwise they are added to the waitlist. Confirmation is sent to linked channels and by email when available.`,
    okText: 'Re-add booking',
    cancelText: 'Cancel',
  })
  if (!confirmed) return
  try {
    const booking = await createManualBookingRequest({
      customerId: input.customerId,
      locationId: input.locationId,
      sessionId: input.sessionId,
      userId: input.userId,
    })
    await input.invalidate()
    toast.success(booking.status === 'WAITLISTED' ? 'Client added to the waitlist.' : 'Booking confirmed and the client was notified.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not re-add this booking.')
  }
}

export async function updateBookingAttendance(bookingId: string, locationId: string, attended: boolean | null, invalidate: () => Promise<unknown>) {
  try {
    await updateBookingAttendanceRequest(bookingId, locationId, attended)
    await invalidate()
    toast.success(attended === true ? 'Booking marked present.' : attended === false ? 'Booking marked absent.' : 'Attendance cleared.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not update attendance.')
  }
}

export async function cancelClassPassBookingWithConfirmation(bookingId: string, locationId: string, invalidate: () => Promise<unknown>) {
  const confirmed = await Modals.confirm({
    title: 'Cancel ClassPass reservation?',
    content: 'This will cancel the reservation on ClassPass and mark it cancelled in Ayana. Use this to correct a booking imported by mistake.',
    okText: 'Cancel reservation',
    cancelText: 'Keep booking',
    okButtonProps: { variant: 'destructive' },
  })
  if (!confirmed) return
  try {
    await cancelClassPassBookingForManagementRequest(bookingId, locationId)
    await invalidate()
    toast.success('ClassPass reservation cancelled.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not cancel the ClassPass reservation.')
  }
}

export function getBookingRowActions(input: {
  status: string
  canEdit: boolean
  canCreate: boolean
  isPast: boolean
  source?: string
  onCancel: () => void
  onRebook: () => void
  onSetAttendance: (attended: boolean | null) => void
  onCancelClassPass: () => void
}): DropdownActionItem[] {
  const commands: DropdownActionItem[] = []
  if (input.canEdit && ['CONFIRMED', 'WAITLISTED'].includes(input.status)) {
    commands.push({ label: 'Cancel booking…', variant: 'destructive', onClick: input.onCancel })
  }
  if (input.canCreate && ['CANCELLED', 'LATE_CANCELLED'].includes(input.status)) {
    commands.push({ label: 'Re-add client', onClick: input.onRebook })
  }
  if (input.canEdit && input.isPast && !['CANCELLED', 'LATE_CANCELLED', 'WAITLISTED'].includes(input.status)) {
    commands.push(
      { label: 'Mark attended', onClick: () => input.onSetAttendance(true) },
      { label: 'Mark absent', onClick: () => input.onSetAttendance(false) },
      { label: 'Clear attendance', onClick: () => input.onSetAttendance(null) },
    )
    if (input.source === 'CLASSPASS') {
      commands.push({ label: 'Cancel ClassPass reservation…', variant: 'destructive', onClick: input.onCancelClassPass })
    }
  }
  return commands
}
