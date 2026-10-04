import NiceModal, { unregister } from '@ebay/nice-modal-react'

import { AlertModal, ConfirmModal } from '@/components/modals/ModalDialogs'
import { SelectTableDataModal } from '@/components/modals/SelectTableDataModal'
import { AddCommentDialog, AddInterventionDialog } from '@/features/devices/components/DeviceActivityModals'
import { IssueResolutionModal } from '@/features/issues/components/IssueResolutionModal'
import { MediaPreviewModal } from '@/features/media/components/MediaPreviewModal'
import { ModalId } from '@/providers/modal-ids'
import type { AlertModalDialogOptions, ConfirmModalDialogOptions, ModalPropsById } from '@/providers/modal-types'

let registryRegistered = false

export const generateConfirmMessage = (operation: string) => {
  return `You are about to ${operation.toLocaleLowerCase()}, would you like to continue?`
}

export const getConfirmContent = ({ content, operation }: Pick<ConfirmModalDialogOptions, 'content' | 'operation'>) => {
  if (content) {
    return content
  }

  if (operation) {
    return generateConfirmMessage(operation)
  }

  return undefined
}

const createModalInstanceId = (modalId: typeof ModalId.Alert | typeof ModalId.Confirm) => {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())

  return `${modalId}:${id}`
}

const unregisterModalInstance = (instanceId: string) => {
  unregister(instanceId)
}

export function registerModalRegistry() {
  if (registryRegistered) return

  NiceModal.register(ModalId.AddComment, AddCommentDialog)
  NiceModal.register(ModalId.AddIntervention, AddInterventionDialog)
  NiceModal.register(ModalId.IssueResolution, IssueResolutionModal)
  NiceModal.register(ModalId.MediaPreview, MediaPreviewModal)
  NiceModal.register(ModalId.SelectTableData, SelectTableDataModal)
  registryRegistered = true
}

export const Modals = {
  show<K extends keyof ModalPropsById>(modalId: K, props: ModalPropsById[K]) {
    registerModalRegistry()

    return NiceModal.show(modalId, props)
  },

  async confirm(options: ConfirmModalDialogOptions) {
    const instanceId = createModalInstanceId(ModalId.Confirm)
    const { title, content, operation, ...restOptions } = options

    NiceModal.register(instanceId, ConfirmModal)

    return NiceModal.show<boolean>(instanceId, {
      ...restOptions,
      instanceId,
      onRemove: unregisterModalInstance,
      title: title || 'Confirmation',
      content: getConfirmContent({ content, operation }),
    })
  },

  async alert(options: AlertModalDialogOptions) {
    const instanceId = createModalInstanceId(ModalId.Alert)

    NiceModal.register(instanceId, AlertModal)

    await NiceModal.show<void>(instanceId, {
      ...options,
      instanceId,
      onRemove: unregisterModalInstance,
    })
  },
}

export { ModalId }
