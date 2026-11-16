import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { getOrganizationBrandingPreviewRequest, type BrandingDraft, type BrandingKind } from '@/features/organizations/organization-branding-api'

type Props = {
  organizationId?: string
  logoAttachmentId?: string | null
  logoIconAttachmentId?: string | null
  draft: BrandingDraft
  onDraftChange: (kind: BrandingKind, value: File | null | undefined) => void
}

export function OrganizationBrandingFields({ organizationId, logoAttachmentId, logoIconAttachmentId, draft, onDraftChange }: Props) {
  const [savedPreviews, setSavedPreviews] = useState<Partial<Record<BrandingKind, string>>>({})
  const [filePreviews, setFilePreviews] = useState<Partial<Record<BrandingKind, string>>>({})

  useEffect(() => {
    let active = true
    const objectUrls: string[] = []
    const load = async (kind: BrandingKind, attachmentId?: string | null) => {
      if (!organizationId || !attachmentId) return
      try {
        const blob = await getOrganizationBrandingPreviewRequest(organizationId, kind)
        const url = URL.createObjectURL(blob)
        objectUrls.push(url)
        if (active) setSavedPreviews((current) => ({ ...current, [kind]: url }))
      } catch {
        if (active) setSavedPreviews((current) => ({ ...current, [kind]: undefined }))
      }
    }
    void load('logo', logoAttachmentId)
    void load('logo-icon', logoIconAttachmentId)
    return () => {
      active = false
      objectUrls.forEach(URL.revokeObjectURL)
    }
  }, [organizationId, logoAttachmentId, logoIconAttachmentId])

  useEffect(() => {
    const urls: string[] = []
    const next: Partial<Record<BrandingKind, string>> = {}
    for (const kind of ['logo', 'logo-icon'] as const) {
      const value = draft[kind]
      if (value instanceof File) {
        const url = URL.createObjectURL(value)
        urls.push(url)
        next[kind] = url
      }
    }
    setFilePreviews(next)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [draft])

  const field = (kind: BrandingKind, label: string, attachmentId?: string | null) => {
    const pendingRemoval = draft[kind] === null
    const preview = pendingRemoval ? undefined : filePreviews[kind] ?? savedPreviews[kind]
    return (
      <Field key={kind} className="min-w-0">
        <FieldLabel>{label}</FieldLabel>
        <div className="flex min-h-28 items-center gap-4 rounded-lg border p-3">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
            {preview ? <img src={preview} alt={label} className="size-full object-contain" /> : <span className="text-xs text-muted-foreground">No image</span>}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm font-medium hover:bg-accent">
              {preview ? 'Replace image' : 'Choose image'}
              <input
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  if (file) onDraftChange(kind, file)
                  event.currentTarget.value = ''
                }}
              />
            </label>
            {(attachmentId || draft[kind] instanceof File) && !pendingRemoval ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onDraftChange(kind, null)}>Remove</Button>
            ) : pendingRemoval ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onDraftChange(kind, undefined)}>Undo remove</Button>
            ) : null}
          </div>
        </div>
        {pendingRemoval ? <p className="text-xs text-muted-foreground">This image will be removed when you save.</p> : null}
      </Field>
    )
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Branding</h3>
        <p className="text-xs text-muted-foreground">Changes are saved when you submit the form.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('logo', 'Logo', logoAttachmentId)}
        {field('logo-icon', 'Logo icon', logoIconAttachmentId)}
      </div>
    </section>
  )
}
