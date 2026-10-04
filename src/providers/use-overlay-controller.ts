import { useModal } from '@ebay/nice-modal-react'
import { useCallback, useRef } from 'react'

type OverlayControllerOptions = {
  removeDelay?: number
  canClose?: () => boolean | Promise<boolean>
  onRemove?: () => void
}

type CloseOptions = {
  force?: boolean
}

function useNiceModalController({ removeDelay = 100, canClose, onRemove }: OverlayControllerOptions = {}) {
  const modal = useModal()
  const closingRef = useRef(false)
  const closeCheckRef = useRef(false)

  const close = useCallback(
    async (result?: unknown, options?: CloseOptions) => {
      if (closingRef.current) return false
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }

      if (!options?.force) {
        if (closeCheckRef.current) return false

        closeCheckRef.current = true
        let allowed: boolean | undefined

        try {
          allowed = await canClose?.()
        } finally {
          closeCheckRef.current = false
        }

        if (allowed === false) return false
      }

      closingRef.current = true
      modal.resolve(result)
      void modal.hide()

      window.setTimeout(() => {
        modal.remove()
        onRemove?.()
      }, removeDelay)

      return true
    },
    [canClose, modal, onRemove, removeDelay],
  )

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) void close(false)
    },
    [close],
  )

  return {
    open: modal.visible,
    requestClose: close,
    forceClose: (result?: unknown) => close(result, { force: true }),
    onOpenChange,
    modal,
  }
}

export function useModalController(options?: OverlayControllerOptions) {
  return useNiceModalController(options)
}

export function useDrawerController(options?: OverlayControllerOptions) {
  return useNiceModalController(options)
}
