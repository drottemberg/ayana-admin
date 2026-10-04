import { BaseCard } from '@/components/app/BaseCard'

import { HugeiconsIcon } from '@hugeicons/react'
import InformationCircleIcon from '@hugeicons/core-free-icons/InformationCircleIcon'
import { Skeleton } from '../ui/skeleton'
import { cn } from '@/lib/utils'

type InfoCardProps = React.ComponentProps<typeof BaseCard> & {
  title: string
  className?: string
  headerAction?: React.ReactNode
  footerAction?: React.ReactNode
  rows: {
    label: string
    value: string | React.ReactNode
    actionNode?: React.ReactNode
  }[]
  isLoading?: boolean
  isSpaceBeetween?: boolean
}

export function InfoCard({
  title,
  headerAction,
  footerAction,
  isLoading = false,
  rows,
  isSpaceBeetween = false,
  className,
}: InfoCardProps) {
  if (isLoading) return <InfoCardSkeleton length={rows.length} />

  return (
    <BaseCard className={cn(className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-h4 flex items-center gap-2 font-semibold">
          <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-5" />
          {title}
        </div>
        {headerAction}
      </div>

      <div className="grid gap-3 text-sm">
        {rows.map(({ label, value, actionNode }) => (
          <div
            key={label}
            className={cn('flex items-center gap-3 sm:grid-cols-[180px_1fr]', isSpaceBeetween ? 'justify-between' : '')}
          >
            <dt className="font-semibold whitespace-nowrap">{label}:</dt>
            {actionNode ? (
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 max-sm:flex-col max-sm:items-end">
                <dd className="text-foreground">{value}</dd>
                <div>{actionNode}</div>
              </div>
            ) : (
              <dd className="text-foreground">{value}</dd>
            )}
          </div>
        ))}
      </div>

      {footerAction ? <div className="flex justify-end pt-1">{footerAction}</div> : null}
    </BaseCard>
  )
}

export function InfoCardSkeleton({ length = 6 }: { length?: number }) {
  return (
    <BaseCard skeleton>
      <Skeleton className="h-5 w-32" />
      {Array.from({ length }).map((_, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[180px_1fr]">
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
        </div>
      ))}
      <div className="mt-auto flex justify-end gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-28" />
      </div>
    </BaseCard>
  )
}
