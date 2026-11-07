import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MultiselectInput, SelectInput } from '@/components/ui/select-input'
import { Textarea } from '@/components/ui/textarea'
import { createCoachProfileRequest, getCoachCandidatesRequest, getCustomerClassTypesRequest, removeCoachProfileImageRequest, updateCoachProfileRequest, uploadCoachProfileImageRequest } from '@/features/coaches/api'
import { classTypesQueryKeys } from '@/features/classes/query-keys'
import { CoachPhotoEditor } from '@/features/coaches/CoachPhotoEditor'
import { CoachLanguagesInput, normalizeCoachLanguages } from '@/features/coaches/CoachLanguagesInput'
import type { CoachProfile } from './types'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

export function CoachProfileDrawer({
  customerId,
  customerName,
  profile,
  initialUserId,
  initialUserName,
  open,
  onOpenChange,
}: {
  customerId: string
  customerName?: string | null
  profile?: CoachProfile | null
  initialUserId?: string
  initialUserName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState('')
  const [bio, setBio] = useState('')
  const [specialties, setSpecialties] = useState('')
  const [languages, setLanguages] = useState<string[]>([])
  const [classTypeIds, setClassTypeIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
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
  const selectedCandidate = candidates.find((candidate) => candidate.userId === userId)
  const specificLocationIds = profile?.locationScope === 'SPECIFIC'
    ? new Set(profile.locations.map((location) => location.id))
    : selectedCandidate?.locationScope === 'SPECIFIC'
      ? new Set(selectedCandidate.locationIds)
      : null
  const selectableClassTypes = profile?.locationScope === 'NONE' || (!profile && userId && loadingCandidates)
    ? []
    : classTypes.filter((classType) => classType.isActive && (!specificLocationIds || specificLocationIds.has(classType.locationId)))
  const selectableClassTypeIds = new Set(selectableClassTypes.map((classType) => classType.id))
  const selectedClassTypeIds = classTypeIds.filter((id) => selectableClassTypeIds.has(id))

  useEffect(() => {
    if (!open) return
    setUserId(profile?.userId ?? initialUserId ?? '')
    setBio(profile?.bio ?? '')
    setSpecialties(profile?.specialties.join(', ') ?? '')
    setLanguages(normalizeCoachLanguages(profile?.languages))
    setClassTypeIds(profile?.classTypes.map((classType) => classType.id) ?? [])
    setPhotoUrl(profile?.imageUrl ?? null)
  }, [open, profile, initialUserId])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile && !userId) {
      toast.error('Select an instructor first.')
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        bio: bio.trim() || undefined,
        specialties: specialties.split(',').map((value) => value.trim()).filter(Boolean),
        languages: normalizeCoachLanguages(languages),
        classTypeIds: selectedClassTypeIds,
      }
      if (profile) await updateCoachProfileRequest(customerId, profile.userId, payload)
      else await createCoachProfileRequest(customerId, { ...payload, userId })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['coaches'] }),
        queryClient.invalidateQueries({ queryKey: ['coach-candidates', customerId] }),
      ])
      toast.success(profile ? 'Coach profile updated.' : 'Coach profile created.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the coach profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const uploadPhoto = async (file: File): Promise<boolean> => {
    if (!profile) return false
    setIsUploadingPhoto(true)
    try {
      const updated = await uploadCoachProfileImageRequest(customerId, profile.userId, file)
      setPhotoUrl(updated.imageUrl ?? null)
      await queryClient.invalidateQueries({ queryKey: ['coaches'] })
      toast.success('Coach photo saved.')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the coach photo.')
      return false
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const removePhoto = async () => {
    if (!profile) return
    setIsUploadingPhoto(true)
    try {
      await removeCoachProfileImageRequest(customerId, profile.userId)
      setPhotoUrl(null)
      await queryClient.invalidateQueries({ queryKey: ['coaches'] })
      toast.success('Coach photo removed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the coach photo.')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  return <AppDrawer
    open={open}
    onOpenChange={onOpenChange}
    title={profile ? 'Edit coach' : 'Add coach'}
    contentClassName="sm:max-w-lg"
  >
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
        <Field label="Customer"><Input value={profile?.customerName || customerName || ''} readOnly /></Field>
        {profile ? <Field label="Coach"><Input value={profile.coachName || profile.email || ''} readOnly /></Field> : null}
        {profile ? <CoachPhotoEditor imageUrl={photoUrl} uploading={isUploadingPhoto} disabled={isSaving} onUpload={uploadPhoto} onRemove={removePhoto} /> : null}
        {!profile && !initialUserId && (
          <Field label="Instructor user">
            <SelectInput
              aria-label="Instructor user"
              items={candidates.map((candidate) => ({
                value: candidate.userId,
                label: `${[candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || candidate.email || 'Instructor'}${candidate.email && candidate.firstName ? ` · ${candidate.email}` : ''}`,
              }))}
              value={userId}
              onValueChange={(value) => {
                setUserId(String(value))
                setClassTypeIds([])
              }}
              isLoading={loadingCandidates}
              loadingMessage="Loading instructors..."
              placeholder="Select an instructor"
              emptyMessage="No instructors available."
            />
          </Field>
        )}
        {!profile && initialUserId && <Field label="Instructor user"><Input value={initialUserName || selectedCandidate?.email || 'Instructor'} readOnly /></Field>}
        <Field label="Class types">
          <MultiselectInput
            aria-label="Class types"
            items={selectableClassTypes.map((classType) => ({ value: classType.id, label: `${classType.name} · ${classType.locationName}` }))}
            value={selectedClassTypeIds}
            onValueChange={setClassTypeIds}
            isLoading={loadingClassTypes || (!profile && Boolean(userId) && loadingCandidates)}
            loadingMessage="Loading class types..."
            placeholder="Select class types"
            emptyMessage={specificLocationIds ? 'No class types exist at this instructor’s assigned locations.' : 'No class types exist for this customer.'}
          />
        </Field>
        <Field label="Teaching language"><CoachLanguagesInput value={languages} onValueChange={setLanguages} /></Field>
        <Field label="Specialties"><Input value={specialties} onChange={(event) => setSpecialties(event.target.value)} placeholder="Reformer, Mat, Barrel" /></Field>
        <Field label="Bio"><Textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={5} /></Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-5">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
        <Button type="submit" disabled={isSaving || (!profile && !userId) || loadingClassTypes || (!profile && loadingCandidates)}>{isSaving ? 'Saving…' : profile ? 'Save changes' : 'Create profile'}</Button>
      </div>
    </form>
  </AppDrawer>
}
