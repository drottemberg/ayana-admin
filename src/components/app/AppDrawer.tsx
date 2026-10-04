import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type AppDrawerRef = {
  open: () => void
  close: () => void
  toggle: () => void
}

type AppDrawerChildrenContext = {
  containerRef: React.RefObject<HTMLDivElement | null>
}

type AppDrawerProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  header?: React.ReactNode
  showHeader?: boolean
  showBackButton?: boolean
  onBack?: () => void
  children: React.ReactNode | ((context: AppDrawerChildrenContext) => React.ReactNode)
  open?: boolean
  dismissible?: boolean
  onOpenChange?: (open: boolean) => void
  direction?: 'left' | 'right'
  contentClassName?: string
  headerClassName?: string
}

export const AppDrawer = forwardRef<AppDrawerRef, AppDrawerProps>(function AppDrawer(
  {
    title,
    description,
    header,
    showHeader = true,
    showBackButton,
    onBack,
    children,
    open,
    dismissible,
    onOpenChange,
    direction = 'right',
    contentClassName,
    headerClassName,
  },
  ref,
) {
  const [internalOpen, setInternalOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isMobile = useIsMobile()
  const isControlled = open !== undefined
  const isOpen = open ?? internalOpen

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen)
      }

      onOpenChange?.(nextOpen)
    },
    [isControlled, onOpenChange],
  )

  useImperativeHandle(
    ref,
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen(!isOpen),
    }),
    [isOpen, setOpen],
  )

  return (
    <Drawer direction={isMobile ? 'bottom' : direction} open={isOpen} onOpenChange={setOpen} dismissible={dismissible}>
      <DrawerContent ref={containerRef} className={cn('w-full', contentClassName)}>
        {showHeader
          ? (header ?? (
              <DrawerHeader className={cn('p-5', headerClassName)}>
                <div className="relative flex min-h-8 items-center justify-center md:justify-start">
                  {showBackButton ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1/2 left-0 -translate-y-1/2 md:static md:translate-y-0"
                      onClick={onBack}
                      aria-label="Go back"
                    >
                      <span aria-hidden="true">←</span>
                    </Button>
                  ) : null}
                  {title ? <DrawerTitle className="px-10 text-center md:px-0 md:text-left">{title}</DrawerTitle> : null}
                </div>
                <DrawerDescription className={description ? undefined : 'sr-only'}>
                  {description ?? (typeof title === 'string' ? `Drawer for ${title}` : 'Drawer')}
                </DrawerDescription>
              </DrawerHeader>
            ))
          : null}
        {typeof children === 'function' ? children({ containerRef }) : children}
      </DrawerContent>
    </Drawer>
  )
})
