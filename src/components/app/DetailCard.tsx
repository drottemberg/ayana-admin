import type { ReactNode } from 'react'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'

import { BaseCard } from '@/components/app/BaseCard'
import { cn } from '@/lib/utils'

type DetailCardProps = Omit<React.ComponentProps<typeof BaseCard>, 'title'> & {
  icon?: IconSvgElement
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  headerClassName?: string
  titleClassName?: string
}

export function DetailCard({
  icon,
  title,
  subtitle,
  actions,
  children,
  className,
  headerClassName,
  titleClassName,
  ...props
}: DetailCardProps) {
  return (
    <BaseCard className={cn('gap-3', className)} {...props}>
      <div className={cn('flex items-center justify-between gap-3', headerClassName)}>
        <div className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm', titleClassName)}>
          {icon ? <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5 shrink-0" /> : null}
          <span className="font-semibold text-foreground">{title}</span>
          {subtitle ? <span className="text-muted-foreground">{subtitle}</span> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </BaseCard>
  )
}
