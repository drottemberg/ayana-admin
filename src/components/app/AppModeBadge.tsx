import { getAppMode, getAppModeLabel } from '@/features/app/app-mode'
import { cn } from '@/lib/utils'

type AppModeBadgeProps = {
  className?: string
}

export function AppModeBadge({ className }: AppModeBadgeProps) {
  const mode = getAppMode()

  if (mode === 'customer') return null

  return (
    <span
      className={cn(
        'shrink-0 text-[10px] font-normal leading-none tracking-normal text-muted-foreground/70',
        className,
      )}
    >
      {getAppModeLabel(mode)}
    </span>
  )
}
