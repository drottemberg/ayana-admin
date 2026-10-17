import { createRef } from 'react'
import { toast } from 'sonner'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { Modals } from '@/providers/modal'
import { BookingCancellationConfirmation } from './BookingCancellationConfirmation'
import { cancelBookingForManagementRequest, createManualBookingRequest, getBookingCancellationQuoteRequest } from './api'

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

export function getBookingRowActions(input: {
  status: string
  canEdit: boolean
  canCreate: boolean
  onCancel: () => void
  onRebook: () => void
}): DropdownActionItem[] {
  const commands: DropdownActionItem[] = []
  if (input.canEdit && ['CONFIRMED', 'WAITLISTED'].includes(input.status)) {
    commands.push({ label: 'Cancel booking…', variant: 'destructive', onClick: input.onCancel })
  }
  if (input.canCreate && ['CANCELLED', 'LATE_CANCELLED'].includes(input.status)) {
    commands.push({ label: 'Re-add client', onClick: input.onRebook })
  }
  return commands
}
