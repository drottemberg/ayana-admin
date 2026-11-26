import { useState, type FormEvent } from 'react'
import NiceModal from '@ebay/nice-modal-react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getClassBookingsRequest, emailConfirmedSessionParticipantsRequest } from './api'
import { useModalController } from '@/providers/use-overlay-controller'

export const EmailSessionParticipantsDialog = NiceModal.create<{ sessionId: string; locationId: string; sessionName: string }>(({ sessionId, locationId, sessionName }) => {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const modal = useModalController({ canClose: () => !sending })
  const bookings = useQuery({ queryKey: ['session-email-recipients', sessionId, locationId], queryFn: () => getClassBookingsRequest(locationId, sessionId), enabled: modal.open })
  const count = bookings.data?.filter((booking) => booking.status === 'CONFIRMED').length ?? 0
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!subject.trim() || !message.trim() || !count) return
    setSending(true)
    try {
      const result = await emailConfirmedSessionParticipantsRequest(locationId, sessionId, subject.trim(), message.trim())
      toast.success(`Email sent to ${result.sent} participant${result.sent === 1 ? '' : 's'}.${result.failed ? ` ${result.failed} failed.` : ''}`)
      await modal.forceClose(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the email.')
    } finally { setSending(false) }
  }
  return <Dialog open={modal.open} onOpenChange={modal.onOpenChange}>
    <DialogContent>
      <DialogHeader showCloseButton><DialogTitle>Email confirmed participants</DialogTitle>
        <DialogDescription>{sessionName} · {bookings.isLoading ? 'Loading recipients…' : `${count} confirmed booking${count === 1 ? '' : 's'}`}. Each recipient receives a separate email with the session name, date, time and location above your message.</DialogDescription>
      </DialogHeader>
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <label className="grid gap-1.5 text-sm font-medium">Subject<input required maxLength={200} className="h-9 rounded-md border border-input bg-background px-3 font-normal" value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
        <label className="grid gap-1.5 text-sm font-medium">Message<textarea required maxLength={10000} rows={7} className="rounded-md border border-input bg-background p-3 font-normal" value={message} onChange={(event) => setMessage(event.target.value)} /></label>
        {bookings.isError ? <p className="text-sm text-destructive">Could not load participants.</p> : null}
        <DialogFooter><Button type="button" variant="outline" disabled={sending} onClick={() => void modal.forceClose(true)}>Cancel</Button><Button type="submit" loading={sending} disabled={!count || bookings.isLoading || bookings.isError}>Send email</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
})
