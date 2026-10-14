import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MultiselectInput, SelectInput } from '@/components/ui/select-input'
import { Textarea } from '@/components/ui/textarea'
import { createCoachProfileRequest, getCoachCandidatesRequest, getCustomerClassTypesRequest, updateCoachProfileRequest } from '@/features/coaches/api'
import { classTypesQueryKeys } from '@/features/classes/query-keys'
import type { CoachProfile } from './types'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

export function CoachProfileDrawer({
  customerId,
  profile,
  open,
  onOpenChange,
}: {
  customerId: string
  profile?: CoachProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState('')
  const [bio, setBio] = useState('')
  const [specialties, setSpecialties] = useState('')
  const [classTypeIds, setClassTypeIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ['coach-candidates', customerId],
    queryFn: () => getCoachCandidatesRequest(customerId),
    enabled: open && !profile,
  })
  const { data: classTypes = [], isLoading: loadingClassTypes } = useQuery({
    queryKey: classTypesQueryKeys.customer(customerId),
    queryFn: () => getCustomerClassTypesRequest(customerId),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setUserId(profile?.userId ?? '')
    setBio(profile?.bio ?? '')
    setSpecialties(profile?.specialties.join(', ') ?? '')
    setClassTypeIds(profile?.classTypes.map((classType) => classType.id) ?? [])
  }, [open, profile])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile && !userId) {
      toast.error('Select an instructor first.')
      return
    }
    if (!classTypeIds.length) {
      toast.error('Select at least one class type this instructor can teach.')
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        bio: bio.trim() || undefined,
        specialties: specialties.split(',').map((value) => value.trim()).filter(Boolean),
        classTypeIds,
      }
      if (profile) await updateCoachProfileRequest(customerId, profile.userId, payload)
      else await createCoachProfileRequest(customerId, { ...payload, userId })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['coaches'] }),
        queryClient.invalidateQueries({ queryKey: ['coach-candidates', customerId] }),
      ])
      toast.success(profile ? 'Instructor profile updated.' : 'Instructor profile created.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the instructor profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return <AppDrawer
    open={open}
    onOpenChange={onOpenChange}
    title={profile ? 'Edit instructor profile' : 'Add instructor profile'}
    description="Profiles belong to a customer. The instructor’s allowed locations are managed in their customer membership."
    contentClassName="sm:max-w-xl"
  >
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
        {profile ? (
          <div className="rounded-md border border-border p-3 text-sm">
            <div className="font-medium">{profile.coachName}</div>
            <div className="text-muted-foreground">{profile.email || profile.userId}</div>
            <Link to={`/users/${profile.userId}`} className="mt-1 inline-block underline underline-offset-2">Manage role and location access</Link>
          </div>
        ) : (
          <Field label="Customer instructor">
            <SelectInput
              aria-label="Customer instructor"
              items={candidates.map((candidate) => ({
                value: candidate.userId,
                label: `${[candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || candidate.userId}${candidate.email ? ` · ${candidate.email}` : ''}`,
              }))}
              value={userId}
              onValueChange={(value) => setUserId(String(value))}
              isLoading={loadingCandidates}
              loadingMessage="Loading instructors..."
              placeholder="Select an instructor"
              emptyMessage="No customer users with the INSTRUCTOR role need a profile."
            />
          </Field>
        )}
        <Field label="Class types they can teach">
          <MultiselectInput
            aria-label="Class types"
            items={classTypes.map((classType) => ({ value: classType.id, label: `${classType.name} · ${classType.locationName}` }))}
            value={classTypeIds}
            onValueChange={setClassTypeIds}
            isLoading={loadingClassTypes}
            loadingMessage="Loading class types..."
            placeholder="Select class types"
            emptyMessage="No class types exist for this customer."
          />
        </Field>
        <Field label="Specialties"><Input value={specialties} onChange={(event) => setSpecialties(event.target.value)} placeholder="Reformer, Mat, Barrel" /></Field>
        <Field label="Instructor bio"><Textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={5} /></Field>
        <p className="text-sm text-muted-foreground">One-off assignments are made on a class session. Recurring assignments use the class schedule and its validity dates. Instructor location scope comes from the user’s membership.</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-5">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
        <Button type="submit" disabled={isSaving || (!profile && !userId) || loadingClassTypes}>{isSaving ? 'Saving…' : profile ? 'Save changes' : 'Add instructor'}</Button>
      </div>
    </form>
  </AppDrawer>
}
