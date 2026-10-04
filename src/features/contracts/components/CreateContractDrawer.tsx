import NiceModal from '@ebay/nice-modal-react'
import { useCallback, useRef } from 'react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { CreateContractForm } from '@/features/contracts/components/CreateContractForm'
import { Modals } from '@/providers/modal'
import { useDrawerController } from '@/providers/use-overlay-controller'
import type { Contract } from '@/types/contract'

export type CreateContractDrawerProps = {
  contract?: Contract
  customerId?: string
}

const CreateContractDrawer = NiceModal.create(({ contract, customerId }: CreateContractDrawerProps) => {
  const isFormDirtyRef = useRef(false)
  const isEditMode = !!contract?.id
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
      title={isEditMode ? 'Edit contract infos' : 'Create new contract'}
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      dismissible={!isFormDirtyRef.current}
    >
      <CreateContractForm
        onCancel={() => drawer.requestClose(false)}
        onSuccess={async () => {
          await drawer.forceClose()
        }}
        onDirtyChange={(dirty) => {
          isFormDirtyRef.current = dirty
        }}
        contract={contract}
        customerId={customerId}
      />
    </AppDrawer>
  )
})

export { CreateContractDrawer }
