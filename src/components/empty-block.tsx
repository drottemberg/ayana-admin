import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { type VariantProps } from 'class-variance-authority'

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

type EmptyBlockProps = {
  icon?: React.ReactNode
  title: string
  description?: string
  className?: string
  button?: {
    name: string
    onClick: () => void
  } & VariantProps<typeof buttonVariants>
}

function EmptyBlock({ className, icon, title, description, button }: EmptyBlockProps) {
  return (
    <Empty className={cn(className)}>
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        {button ? (
          <Button variant={button.variant ?? 'outline'} onClick={button.onClick}>
            {button.name}
          </Button>
        ) : null}
      </EmptyContent>
    </Empty>
  )
}

export { EmptyBlock }
