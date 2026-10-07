import { useEffect, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectInput } from '@/components/ui/select-input'
import { Textarea } from '@/components/ui/textarea'
import { updateClassTypeRequest, type UpdateClassTypePayload } from '@/features/classes/api'
import { classTypesQueryKeys } from '@/features/classes/query-keys'
import type { ClassType } from '@/types/class-type'

const classTypeOptions = [
  { value: 'GROUP', label: 'Group' },
  { value: 'SEMI_PRIVATE', label: 'Semi-private' },
  { value: 'PRIVATE', label: 'Private' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

export function ClassTypeEditDrawer({
  classType,
  open,
  onOpenChange,
}: {
  classType: ClassType | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ClassType['type']>('GROUP')
  const [duration, setDuration] = useState('')
  const [maxCapacity, setMaxCapacity] = useState('')
  const [creditCost, setCreditCost] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open || !classType) return
    setName(classType.name)
    setCategory(classType.category ?? '')
    setDescription(classType.description ?? '')
    setType(classType.type)
    setDuration(String(classType.duration))
    setMaxCapacity(String(classType.maxCapacity))
    setCreditCost(String(classType.creditCost))
  }, [open, classType])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!classType) return

    const payload: UpdateClassTypePayload = {
      name: name.trim(),
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      type,
      duration: Number(duration),
      maxCapacity: Number(maxCapacity),
      creditCost: Number(creditCost),
    }
    if (!payload.name || !Number.isInteger(payload.duration) || payload.duration < 1 ||
      !Number.isInteger(payload.maxCapacity) || payload.maxCapacity < 1 ||
      !Number.isFinite(payload.creditCost) || payload.creditCost < 0) {
      toast.error('Check the class name, duration, capacity, and credit cost.')
      return
    }

    setIsSaving(true)
    try {
      await updateClassTypeRequest(classType, payload)
      await queryClient.invalidateQueries({ queryKey: classTypesQueryKeys.all })
      toast.success('Class updated.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update class.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit class"
      description="Update this class type for its location."
      contentClassName="sm:max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
          <Field label="Name"><Input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Category"><Input placeholder="Yoga, Pilates, strength…" value={category} onChange={(event) => setCategory(event.target.value)} /></Field>
          <Field label="Description"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></Field>
          <Field label="Type">
            <SelectInput
              aria-label="Class type"
              items={classTypeOptions}
              value={type}
              onValueChange={(value) => setType(String(value) as ClassType['type'])}
            />
          </Field>
          <Field label="Duration (minutes)"><Input required type="number" min="1" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} /></Field>
          <Field label="Maximum capacity"><Input required type="number" min="1" step="1" value={maxCapacity} onChange={(event) => setMaxCapacity(event.target.value)} /></Field>
          <Field label="Credit cost"><Input required type="number" min="0" step="0.5" value={creditCost} onChange={(event) => setCreditCost(event.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button type="submit" disabled={isSaving || !classType}>{isSaving ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </form>
    </AppDrawer>
  )
}
