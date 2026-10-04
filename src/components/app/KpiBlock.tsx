import type { ReactNode } from 'react'
import ArrowDownBigIcon from '@hugeicons/core-free-icons/ArrowDownBigIcon'
import ArrowUpBigIcon from '@hugeicons/core-free-icons/ArrowUpBigIcon'
import ApproximatelyEqualIcon from '@hugeicons/core-free-icons/ApproximatelyEqualIcon'
import { HugeiconsIcon } from '@hugeicons/react'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { NO_VALUE_STR } from '@/constants'
import { cn } from '@/lib/utils'
import type { KpiDirection } from '@/types/kpi'

const numberFormatter = new Intl.NumberFormat('fr-FR')

type KpiTab = {
  value: string
  label: ReactNode
}

export function KpiBlock({
  title,
  action,
  children,
  className,
}: {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-md border bg-background p-4', className)}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="grid gap-1">{children}</div>
    </div>
  )
}

export function KpiRow({
  label,
  value,
  direction,
  className,
}: {
  label: ReactNode
  value?: number | string | null
  direction?: KpiDirection
  className?: string
}) {
  const hasValue = value !== undefined && value !== null && value !== ''

  return (
    <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1 text-sm', className)}>
      <span className="min-w-0 text-foreground">{label}</span>
      <span className="flex min-w-20 items-center justify-end gap-2 text-right">
        {hasValue ? (
          <>
            <span className="text-base font-semibold tabular-nums">
              {typeof value === 'number' ? numberFormatter.format(value) : value}
            </span>
            {direction ? <KpiTrendIcon direction={direction} /> : null}
          </>
        ) : (
          <span className="text-muted-foreground">{NO_VALUE_STR}</span>
        )}
      </span>
    </div>
  )
}

export function KpiTrendIcon({ direction, className }: { direction: KpiDirection; className?: string }) {
  const trendIcon = {
    up: ArrowUpBigIcon,
    down: ArrowDownBigIcon,
    equal: ApproximatelyEqualIcon,
  }[direction]

  return (
    <HugeiconsIcon
      icon={trendIcon}
      strokeWidth={2}
      className={cn(
        'size-4',
        direction === 'up' && 'text-emerald-500',
        direction === 'down' && 'text-red-500',
        direction === 'equal' && 'text-muted-foreground',
        className,
      )}
    />
  )
}

export function KpiTabs({
  value,
  tabs,
  onValueChange,
}: {
  value: string
  tabs: KpiTab[]
  onValueChange: (value: string) => void
}) {
  return (
    <ToggleGroup
      multiple={false}
      value={[value]}
      onValueChange={(nextValue) => {
        const selected = nextValue[0]
        if (selected) onValueChange(selected)
      }}
      size="sm"
      spacing={2}
    >
      {tabs.map((tab) => (
        <ToggleGroupItem
          key={tab.value}
          value={tab.value}
          className="h-7 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground data-pressed:border-foreground data-pressed:shadow-sm"
        >
          {tab.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

