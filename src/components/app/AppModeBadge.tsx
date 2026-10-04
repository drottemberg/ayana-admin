import { getAppMode, getAppModeLabel } from '@/features/app/app-mode'
import { cn } from '@/lib/utils'

type AppModeBadgeProps = {
  className?: string
}

export function AppModeBadge({ className }: AppModeBadgeProps) {
  const mode = getAppMode()

  return (
    <span
      className={cn(
        'shrink-0 self-start pt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70',
        className,
      )}
    >
      {getAppModeLabel(mode)}
    </span>
  )
}
