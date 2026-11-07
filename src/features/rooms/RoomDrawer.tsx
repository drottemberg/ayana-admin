import { useEffect, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createRoomRequest, updateRoomRequest, type Room } from './api'

export function RoomDrawer({
  locationId,
  room,
  open,
  onOpenChange,
}: {
  locationId: string
  room?: Room | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) setName(room?.name ?? '')
  }, [open, room?.id, room?.name])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)
    try {
      if (room) await updateRoomRequest(locationId, room.id, { name: name.trim() })
      else await createRoomRequest(locationId, name.trim())
      await queryClient.invalidateQueries({ queryKey: ['rooms', 'location', locationId] })
      toast.success(room ? 'Room updated.' : 'Room added.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the room.')
    } finally {
      setIsSaving(false)
    }
  }

  return <AppDrawer open={open} onOpenChange={onOpenChange} title={room ? 'Edit room' : 'Add room'} description="Manage a room at this location." contentClassName="sm:max-w-lg">
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <label className="grid gap-1.5 text-sm font-medium">
          <span>Room name</span>
          <Input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Reformer studio" />
        </label>
        {room?.isDefault ? <p className="text-sm text-muted-foreground">This is the default room created for the location.</p> : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-5">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
        <Button type="submit" disabled={isSaving || !name.trim()}>{isSaving ? 'Saving…' : room ? 'Save room' : 'Add room'}</Button>
      </div>
    </form>
  </AppDrawer>
}
