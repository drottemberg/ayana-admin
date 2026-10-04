import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ComponentProps } from 'react'
import type { ReactNode } from 'react'

type BaseModalDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: (result?: boolean) => void
  title?: string
  content?: ReactNode
  type: 'alert' | 'confirm'
  okText?: string
  cancelText?: string
  okButtonProps?: ComponentProps<typeof Button>
  cancelButtonProps?: ComponentProps<typeof Button>
  showCloseButton?: boolean
}

export const BaseModalDialog = ({
  open,
  onOpenChange,
  onClose,
  title,
  content,
  type,
  okText,
  cancelText,
  okButtonProps,
  cancelButtonProps,
  showCloseButton = true,
}: BaseModalDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent>
        <DialogHeader showCloseButton={showCloseButton}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {content ? <DialogDescription>{content}</DialogDescription> : null}
        <DialogFooter>
          {type === 'confirm' ? (
            <Button variant="outline" onClick={() => onClose(false)} {...cancelButtonProps}>
              {cancelText ?? 'Cancel'}
            </Button>
          ) : null}
          <Button onClick={() => onClose(type === 'confirm' ? true : undefined)} {...okButtonProps}>
            {okText ?? (type === 'confirm' ? 'Confirm' : 'OK')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
