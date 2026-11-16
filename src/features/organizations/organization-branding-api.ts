import { apiClient } from '@/lib/api-client'

export type BrandingKind = 'logo' | 'logo-icon'
export type BrandingDraft = Partial<Record<BrandingKind, File | null>>

function brandingPath(organizationId: string, kind: BrandingKind) {
  return `/organizations/${encodeURIComponent(organizationId)}/branding/${kind}`
}

export async function uploadOrganizationBrandingRequest(organizationId: string, kind: BrandingKind, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiClient.post<{ attachmentId: string }>(brandingPath(organizationId, kind), form)
}

export async function removeOrganizationBrandingRequest(organizationId: string, kind: BrandingKind) {
  return apiClient.delete<{ ok: true }>(brandingPath(organizationId, kind))
}

export async function getOrganizationBrandingPreviewRequest(organizationId: string, kind: BrandingKind) {
  return apiClient.get<Blob>(`${brandingPath(organizationId, kind)}/content`, { responseType: 'blob' })
}

export async function saveOrganizationBrandingDraft(organizationId: string, draft: BrandingDraft) {
  for (const kind of ['logo', 'logo-icon'] as const) {
    const file = draft[kind]
    if (file instanceof File) await uploadOrganizationBrandingRequest(organizationId, kind, file)
    else if (file === null) await removeOrganizationBrandingRequest(organizationId, kind)
  }
}
