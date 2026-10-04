import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GroupPayload } from '@/types/group'

type GroupDrawerBaseProps<TGroup extends { id: string; name: string }> = {
  open: boolean
  group?: TGroup
  entityLabel: string
  queryKey: readonly unknown[]
  detailQueryKey: (groupId: string) => readonly unknown[]
  onOpenChange: (open: boolean) => void
  onCancel: () => void
  onSaved: () => Promise<void>
  onDirtyChange: (dirty: boolean) => void
  createGroup: (payload: GroupPayload) => Promise<TGroup>
  renameGroup: (groupId: string, payload: GroupPayload) => Promise<TGroup>
  dismissible?: boolean
}

export function GroupDrawerBase<TGroup extends { id: string; name: string }>({
  open,
  group,
  entityLabel,
  queryKey,
  detailQueryKey,
  onOpenChange,
  onCancel,
  onSaved,
  onDirtyChange,
  createGroup,
  renameGroup,
  dismissible,
}: GroupDrawerBaseProps<TGroup>) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(group?.name ?? '')
  const isEdit = Boolean(group)
  const trimmedName = name.trim()
  const initialName = group?.name ?? ''
  const canSubmit = Boolean(trimmedName) && (!isEdit || trimmedName !== initialName.trim())

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { name: trimmedName }
      return group ? renameGroup(group.id, payload) : createGroup(payload)
    },
    onSuccess: async (savedGroup) => {
      await queryClient.invalidateQueries({ queryKey })
      await queryClient.invalidateQueries({ queryKey: detailQueryKey(savedGroup.id) })
      toast.success(isEdit ? `${entityLabel} renamed.` : `${entityLabel} created.`)
      onDirtyChange(false)
      await onSaved()
    },
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    mutation.mutate()
  }

  const handleNameChange = (value: string) => {
    setName(value)
    onDirtyChange(value.trim() !== initialName.trim())
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Rename ${entityLabel}` : `Create ${entityLabel}`}
      contentClassName="max-w-md"
      dismissible={dismissible}
    >
      <form className="grid gap-5 p-5 pt-0" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="group-name">Name</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="Group name"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || mutation.isPending}>
            {isEdit ? 'Save' : 'Create Group'}
          </Button>
        </div>
      </form>
    </AppDrawer>
  )
}
