import NiceModal from '@ebay/nice-modal-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { MediaForm } from '@/features/media/components/MediaForm'
import { mediaQueryKeys } from '@/features/media/query-keys'
import { Modals } from '@/providers/modal'
import { useDrawerController } from '@/providers/use-overlay-controller'
import type { Media } from '@/types/media'

export type MediaDrawerProps = {
  media?: Media
  customerId?: string
}

function useDirtyDrawer() {
  const isFormDirtyRef = useRef(false)
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

  return { drawer, isFormDirtyRef }
}

export const CreateMediaDrawer = NiceModal.create<MediaDrawerProps>(({ customerId }) => {
  const { drawer, isFormDirtyRef } = useDirtyDrawer()
  const queryClient = useQueryClient()

  return (
    <AppDrawer
      title="New media"
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      dismissible={!isFormDirtyRef.current}
    >
      <MediaForm
        mode="create"
        customerId={customerId}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: mediaQueryKeys.all })
          await drawer.forceClose()
        }}
        onCancel={() => drawer.requestClose(false)}
        onDirtyChange={(dirty) => {
          isFormDirtyRef.current = dirty
        }}
      />
    </AppDrawer>
  )
})

export const EditMediaDrawer = NiceModal.create<MediaDrawerProps>(({ media }) => {
  const { drawer, isFormDirtyRef } = useDirtyDrawer()

  return (
    <AppDrawer
      title="Edit media"
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      dismissible={!isFormDirtyRef.current}
    >
      <MediaForm
        media={media}
        mode="edit"
        onSaved={async () => {
          await drawer.forceClose()
        }}
        onCancel={() => drawer.requestClose(false)}
        onDirtyChange={(dirty) => {
          isFormDirtyRef.current = dirty
        }}
      />
    </AppDrawer>
  )
})
