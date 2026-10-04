import NiceModal from '@ebay/nice-modal-react'
import { useCallback, useRef } from 'react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { CreateProductForm } from '@/features/products/components/CreateProductForm'
import { Modals } from '@/providers/modal'
import { useDrawerController } from '@/providers/use-overlay-controller'
import type { Product } from '@/types/product'

export type CreateProductDrawerProps = {
  product?: Product
  customerId?: string
}

const CreateProductDrawer = NiceModal.create(({ product, customerId }: CreateProductDrawerProps) => {
  const isFormDirtyRef = useRef(false)
  const isEditMode = !!product?.id
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
      title={isEditMode ? 'Edit product' : 'Add new product'}
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      dismissible={!isFormDirtyRef.current}
    >
      {({ containerRef }) => (
        <CreateProductForm
          product={product}
          customerId={customerId}
          onSaved={async () => {
            await drawer.forceClose()
          }}
          onCancel={() => drawer.requestClose(false)}
          onDirtyChange={(dirty) => {
            isFormDirtyRef.current = dirty
          }}
          comboboxContainer={containerRef}
        />
      )}
    </AppDrawer>
  )
})

export { CreateProductDrawer }
