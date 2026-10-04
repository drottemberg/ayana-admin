import NiceModal from '@ebay/nice-modal-react'

import { BaseModalDialog } from '@/components/modals/BaseModalDialog'
import type { AlertModalDialogOptions, ConfirmModalDialogOptions } from '@/providers/modal-types'
import { useModalController } from '@/providers/use-overlay-controller'

type NiceDialogProps = {
  instanceId?: string
  onRemove?: (instanceId: string) => void
}

const AlertModal = NiceModal.create(
  ({ instanceId, onRemove, ...options }: AlertModalDialogOptions & NiceDialogProps) => {
    const modal = useModalController({
      onRemove: () => {
        if (instanceId) onRemove?.(instanceId)
      },
    })

    const close = async () => {
      await options.onOk?.()
      await modal.forceClose()
    }

    return (
      <BaseModalDialog
        open={modal.open}
        onOpenChange={(open) => {
          if (!open) void close()
        }}
        onClose={close}
        title={options.title}
        content={options.content}
        type="alert"
        okText={options.okText}
        okButtonProps={options.okButtonProps}
        showCloseButton
      />
    )
  },
)

const ConfirmModal = NiceModal.create(
  ({ instanceId, onRemove, ...options }: ConfirmModalDialogOptions & NiceDialogProps) => {
    const modal = useModalController({
      onRemove: () => {
        if (instanceId) onRemove?.(instanceId)
      },
    })

    const close = async (result?: boolean) => {
      const confirmed = Boolean(result)

      if (confirmed) {
        await options.onOk?.()
      } else {
        await options.onCancel?.()
      }

      await modal.forceClose(confirmed)
    }

    return (
      <BaseModalDialog
        open={modal.open}
        onOpenChange={(open) => {
          if (!open) void close(false)
        }}
        onClose={close}
        title={options.title}
        content={options.content}
        type="confirm"
        okText={options.okText}
        cancelText={options.cancelText}
        okButtonProps={options.okButtonProps}
        cancelButtonProps={options.cancelButtonProps}
        showCloseButton
      />
    )
  },
)

export { AlertModal, ConfirmModal }
