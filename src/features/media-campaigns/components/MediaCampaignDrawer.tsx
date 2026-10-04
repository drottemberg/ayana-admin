import NiceModal from '@ebay/nice-modal-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppDrawer } from '@/components/app/AppDrawer'
import { MediaCampaignForm } from '@/features/media-campaigns/components/MediaCampaignForm'
import { mediaCampaignQueryKeys } from '@/features/media-campaigns/query-keys'
import { Modals } from '@/providers/modal'
import { useDrawerController } from '@/providers/use-overlay-controller'
import type { MediaCampaign } from '@/types/media'

export type MediaCampaignDrawerProps = {
  campaign?: MediaCampaign
  customerId?: string
  mediaId?: string
}

export const MediaCampaignDrawer = NiceModal.create<MediaCampaignDrawerProps>(({ campaign, customerId, mediaId }) => {
  const isFormDirtyRef = useRef(false)
  const isEditMode = Boolean(campaign?.id)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const canClose = useCallback(() => {
    if (!isFormDirtyRef.current) return true

    return Modals.confirm({
      title: 'Discard changes?',
      content: 'You have unsaved changes. If you close this drawer, they will be lost.',
      okText: 'Discard',
      cancelText: 'Keep editing',
      okButtonProps: { variant: 'destructive' },
    })
  }, [])
  const drawer = useDrawerController({ canClose })

  return (
    <AppDrawer
      title={isEditMode ? 'Edit campaign' : 'New campaign'}
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      dismissible={!isFormDirtyRef.current}
    >
      <MediaCampaignForm
        mode={isEditMode ? 'edit' : 'create'}
        campaign={campaign}
        customerId={customerId}
        mediaId={mediaId}
        onSaved={async (savedCampaign) => {
          await queryClient.invalidateQueries({ queryKey: mediaCampaignQueryKeys.all })
          await queryClient.invalidateQueries({ queryKey: mediaCampaignQueryKeys.detail(savedCampaign.id) })
          await drawer.forceClose()
          if (!isEditMode) navigate(`/media-campaigns/${savedCampaign.id}`)
        }}
        onCancel={() => drawer.requestClose(false)}
        onDirtyChange={(dirty) => {
          isFormDirtyRef.current = dirty
        }}
      />
    </AppDrawer>
  )
})
