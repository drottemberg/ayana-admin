import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import Alert01Icon from '@hugeicons/core-free-icons/Alert01Icon'
import { Button } from './ui/button'

type FormErrorProps = {
  message?: string | null
  className?: string
  button?: {
    name: string
    onClick: () => void
  }
}

function FormError({ message, className, button }: FormErrorProps) {
  if (!message) return null

  return (
    <div
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border border-destructive bg-red-100 p-3 text-sm',
        className,
      )}
    >
      <HugeiconsIcon icon={Alert01Icon} size={20} strokeWidth={2} className="shrink-0 text-destructive" />
      <p className="min-w-0 flex-1 text-sm break-words">{message}</p>
      {button && (
        <Button variant="link_underline" onClick={button.onClick}>
          {button.name}
        </Button>
      )}
    </div>
  )
}

export { FormError }
