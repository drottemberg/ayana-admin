import NiceModal from '@ebay/nice-modal-react'
import { useCallback, useRef } from 'react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { CreateStoreForm } from '@/features/stores/components/CreateStoreForm'
import { Modals } from '@/providers/modal'
import { useDrawerController } from '@/providers/use-overlay-controller'
import type { Store } from '@/types/customer'

export type CreateStoreDrawerProps = {
  store?: Store
  customerId?: string
}

const CreateStoreDrawer = NiceModal.create(({ store, customerId }: CreateStoreDrawerProps) => {
  const isFormDirtyRef = useRef(false)
  const isEditMode = !!store?.id
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
      title={isEditMode ? 'Edit store infos' : 'Create new store'}
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      dismissible={!isFormDirtyRef.current}
    >
      <CreateStoreForm
        store={store}
        customerId={customerId}
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

export { CreateStoreDrawer }
