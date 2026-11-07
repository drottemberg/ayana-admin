import type { MutableRefObject } from 'react'

export type ClassSessionDeleteScope = 'THIS' | 'FUTURE'

export function DeleteClassSessionConfirmation({
  scopeRef,
}: {
  scopeRef: MutableRefObject<ClassSessionDeleteScope>
}) {
  return (
    <div className="grid gap-4">
      <p>Active bookings will be cancelled, members notified, and eligible credits returned.</p>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Sessions to remove</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
          <input
            type="radio"
            name="class-session-delete-scope"
            value="THIS"
            defaultChecked
            onChange={() => { scopeRef.current = 'THIS' }}
          />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">This session only</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
          <input
            type="radio"
            name="class-session-delete-scope"
            value="FUTURE"
            onChange={() => { scopeRef.current = 'FUTURE' }}
          />
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">This and future matching sessions</span>
            <span className="text-xs text-muted-foreground">Same class, location, room, weekday and local start time. Past sessions stay unchanged.</span>
          </span>
        </label>
      </fieldset>
      <p className="text-xs text-muted-foreground">Every affected session remains in the database with status DELETED.</p>
    </div>
  )
}
