import { useEffect, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { updateMyCoachProfileRequest } from '@/features/coaches/api'
import { coachesQueryKeys } from '@/features/coaches/query-keys'
import type { CoachProfile } from '@/features/coaches/types'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

export function MyCoachProfileDrawer({
  customerId,
  profile,
  open,
  onOpenChange,
}: {
  customerId: string
  profile: CoachProfile
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [bio, setBio] = useState('')
  const [specialties, setSpecialties] = useState('')
  const [languages, setLanguages] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setBio(profile.bio ?? '')
    setSpecialties(profile.specialties.join(', '))
    setLanguages(profile.languages.join(', '))
  }, [open, profile])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await updateMyCoachProfileRequest(customerId, {
        bio: bio.trim() || null,
        specialties: specialties.split(',').map((value) => value.trim()).filter(Boolean),
        languages: languages.split(',').map((value) => value.trim()).filter(Boolean),
      })
      await queryClient.invalidateQueries({ queryKey: coachesQueryKeys.all })
      toast.success('Your coach profile was updated.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update your profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return <AppDrawer open={open} onOpenChange={onOpenChange} title="Edit my coach profile" contentClassName="sm:max-w-lg">
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
        <p className="text-sm text-muted-foreground">You can update your introduction, specialties and the languages you teach. Class qualifications are managed by your studio.</p>
        <Field label="Languages taught"><Input value={languages} onChange={(event) => setLanguages(event.target.value)} placeholder="French, English" /></Field>
        <Field label="Specialties"><Input value={specialties} onChange={(event) => setSpecialties(event.target.value)} placeholder="Reformer, Mat, Barrel" /></Field>
        <Field label="Bio"><Textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={6} /></Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-5">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
        <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </form>
  </AppDrawer>
}
