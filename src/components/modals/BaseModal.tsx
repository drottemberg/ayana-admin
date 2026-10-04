import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ComponentProps } from 'react'

type BaseModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: (result?: boolean) => void
  title?: string
  description?: React.ReactNode
  header?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  okText?: string
  cancelText?: string
  okButtonProps?: ComponentProps<typeof Button>
  cancelButtonProps?: ComponentProps<typeof Button>
  showCloseButton?: boolean
  showHeader?: boolean
  showBackButton?: boolean
  onBack?: () => void
  portalContainer?: React.ComponentProps<typeof DialogContent>['portalContainer']
  className?: string
  bodyClassName?: string
  headerClassName?: string
  footerClassName?: string
}

export const BaseModal = ({
  open,
  onOpenChange,
  onClose,
  title,
  description,
  header,
  children,
  footer,
  okText,
  cancelText,
  okButtonProps,
  cancelButtonProps,
  showCloseButton = true,
  showHeader = true,
  showBackButton,
  onBack,
  portalContainer,
  className,
  bodyClassName,
  headerClassName,
  footerClassName,
}: BaseModalProps) => {
  const hasFooter = !!footer || okText

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        portalContainer={portalContainer}
        className={cn('gap-0 p-6 max-sm:p-4 sm:max-w-[512px]', className)}
      >
        {showHeader
          ? (header ?? (
              <DialogHeader
                showCloseButton={showCloseButton}
                className={cn('-mx-6 -mt-6 max-sm:-mx-4 max-sm:-mt-4', headerClassName)}
              >
                <div className="relative flex min-h-8 items-center justify-center sm:justify-start">
                  {showBackButton ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1/2 left-0 -translate-y-1/2 sm:static sm:translate-y-0"
                      onClick={onBack}
                      aria-label="Go back"
                    >
                      <span aria-hidden="true">←</span>
                    </Button>
                  ) : null}
                  <div className="grid gap-1 px-10 text-center sm:px-0 sm:text-left">
                    <DialogTitle>{title}</DialogTitle>
                    {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
                  </div>
                </div>
              </DialogHeader>
            ))
          : null}
        {children ? <div className={cn('py-4', bodyClassName)}>{children}</div> : null}

        {hasFooter ? (
          <DialogFooter className={cn('-mx-6 -mb-6 max-sm:-mx-4 max-sm:-mb-4', footerClassName)}>
            {!footer ? (
              <>
                <Button variant="outline" className="h-9 px-4" onClick={() => onClose(false)} {...cancelButtonProps}>
                  {cancelText ?? 'Cancel'}
                </Button>
                <Button className="h-9 px-4" {...okButtonProps}>
                  {okText}
                </Button>
              </>
            ) : (
              footer
            )}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
