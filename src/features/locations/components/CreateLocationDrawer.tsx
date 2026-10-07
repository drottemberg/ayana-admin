import NiceModal from '@ebay/nice-modal-react'
import { useCallback, useRef } from 'react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { CreateLocationForm } from '@/features/locations/components/CreateLocationForm'
import { Modals } from '@/providers/modal'
import { useDrawerController } from '@/providers/use-overlay-controller'
import type { Location } from '@/types/location'

export type CreateLocationDrawerProps = {
  customerId?: string
  location?: Location
}

const CreateLocationDrawer = NiceModal.create(({ customerId, location }: CreateLocationDrawerProps) => {
  const isFormDirtyRef = useRef(false)
  const isEditMode = Boolean(location?.id)
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
      title={isEditMode ? 'Edit location' : 'Add location'}
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      dismissible={!isFormDirtyRef.current}
    >
      <CreateLocationForm
        customerId={customerId}
        location={location}
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

export { CreateLocationDrawer }
