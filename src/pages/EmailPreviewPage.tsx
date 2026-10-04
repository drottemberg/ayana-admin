import { useMemo, useState } from 'react'
import { NewMediaRequestEmail, ResetPasswordEmail, UserInvitationEmail } from '@/emails/templates'

const previews = [
  {
    id: 'invitation',
    label: 'User invitation',
    element: (
      <UserInvitationEmail
        customerName="Acme Retail"
        inviteUrl="https://app.gaudier.com/create-password?token=invite-token"
        previewUrl="https://api.gaudier.com/emails/view/invite-token"
      />
    ),
  },
  {
    id: 'reset-password',
    label: 'Reset password',
    element: (
      <ResetPasswordEmail
        fullName="Camille Bernard"
        resetUrl="https://app.gaudier.com/create-password?token=reset-token"
        previewUrl="https://api.gaudier.com/emails/view/reset-token"
      />
    ),
  },
  {
    id: 'new-media',
    label: 'New media request',
    element: (
      <NewMediaRequestEmail
        fullName="Camille Bernard"
        mediaName="CARTIER_MEN_Spring_Summer_15s_9x16_VA.mp4"
        mediaSize="55,9Mo"
        deviceCount={43}
        dataCost="0,23$ / Mo"
        totalCost="18,23$"
        confirmUrl="https://app.gaudier.com/media/release-requests/request-id/confirm?token=confirm-token"
        previewUrl="https://api.gaudier.com/emails/view/media-request-token"
      />
    ),
  },
]

export default function EmailPreviewPage() {
  const [activeId, setActiveId] = useState(previews[0].id)
  const activePreview = useMemo(() => previews.find((preview) => preview.id === activeId) ?? previews[0], [activeId])

  return (
    <div className="min-h-svh bg-[#555]">
      <header className="sticky top-0 z-10 border-b border-white/15 bg-[#4f4f4f] px-4 py-3 text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-h1 font-bold text-white">{activePreview.label}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {previews.map((preview) => (
              <button
                key={preview.id}
                type="button"
                onClick={() => setActiveId(preview.id)}
                className="rounded-md border border-white/20 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10 data-[active=true]:bg-white data-[active=true]:text-[#333]"
                data-active={preview.id === activeId}
              >
                {preview.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="px-4 py-8">{activePreview.element}</div>
    </div>
  )
}
