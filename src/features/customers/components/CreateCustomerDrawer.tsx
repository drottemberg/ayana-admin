import NiceModal from '@ebay/nice-modal-react'
import { useCallback, useRef } from 'react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { CreateCustomerForm } from '@/features/customers/components/CreateCustomerForm'
import { Modals } from '@/providers/modal'
import { useDrawerController } from '@/providers/use-overlay-controller'
import type { Customer } from '@/types/customer'

export type CreateCustomerDrawerProps = {
  customer?: Customer
}

const CreateCustomerDrawer = NiceModal.create(({ customer }: CreateCustomerDrawerProps) => {
  const isFormDirtyRef = useRef(false)
  const isEditMode = !!customer?.id
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
      title={isEditMode ? 'Edit customer' : 'Create new customer'}
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      dismissible={!isFormDirtyRef.current}
    >
      <CreateCustomerForm
        customer={customer}
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

export { CreateCustomerDrawer }
