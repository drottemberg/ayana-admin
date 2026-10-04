import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type BaseCardProps = React.ComponentProps<typeof Card> & {
  skeleton?: boolean
}

export function BaseCard({ children, className, skeleton, ...props }: BaseCardProps) {
  return (
    <Card
      size="sm"
      className={cn('flex min-w-0 flex-col rounded-lg bg-muted p-3', className, skeleton ? 'bg-white' : '')}
      {...props}
    >
      {children}
    </Card>
  )
}
