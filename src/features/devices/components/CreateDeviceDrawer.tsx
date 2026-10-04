import NiceModal from '@ebay/nice-modal-react'
import { useCallback, useRef } from 'react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { CreateDeviceForm } from '@/features/devices/components/CreateDeviceForm'
import { Modals } from '@/providers/modal'
import { useDrawerController } from '@/providers/use-overlay-controller'
import type { Device } from '@/types/device'

export type CreateDeviceDrawerProps = {
  isSet?: boolean
  device?: Device
  parentId?: string
  customerId?: string
}

const CreateDeviceDrawer = NiceModal.create(({ isSet = false, device, parentId }: CreateDeviceDrawerProps) => {
  const isFormDirtyRef = useRef(false)
  const isEditMode = !!device?.id
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
      title={isEditMode ? 'Edit device infos' : isSet ? 'Create new device set' : 'Create new device'}
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      dismissible={!isFormDirtyRef.current}
    >
      {({ containerRef }) => (
        <CreateDeviceForm
          onCancel={() => drawer.requestClose(false)}
          onSaved={async () => {
            await drawer.forceClose()
          }}
          onDirtyChange={(dirty) => {
            isFormDirtyRef.current = dirty
          }}
          isSet={isSet}
          device={device}
          parentId={parentId}
          comboboxContainer={containerRef}
        />
      )}
    </AppDrawer>
  )
})

export { CreateDeviceDrawer }
