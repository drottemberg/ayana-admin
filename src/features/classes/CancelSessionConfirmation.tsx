import type { RefObject } from 'react'

export function CancelSessionConfirmation({ messageRef }: { messageRef: RefObject<HTMLTextAreaElement | null> }) {
  return (
    <div className="grid gap-3">
      <p>All bookings will be cancelled. Members will be notified, and used contract credits will be returned.</p>
      <label className="grid gap-1.5 text-sm font-medium">
        Message to members (optional)
        <textarea
          ref={messageRef}
          maxLength={1000}
          className="min-h-24 rounded-md border border-input bg-background p-3 font-normal"
          placeholder="Add a short explanation for the cancellation…"
        />
        <span className="text-xs font-normal text-muted-foreground">This message will be included in the cancellation email.</span>
      </label>
    </div>
  )
}
