import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function statusLabel(status: string) {
  return status.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusTone(status: string) {
  if (['ACTIVE', 'SCHEDULED', 'CONFIRMED'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (['CANCELLED', 'LATE_CANCELLED', 'NO_SHOW'].includes(status)) return 'border-rose-200 bg-rose-50 text-rose-800'
  if (['ATTENDED', 'COMPLETED'].includes(status)) return 'border-slate-300 bg-slate-50 text-slate-800'
  if (['PAUSE_SCHEDULED', 'WAITLISTED', 'PENDING'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-border bg-muted text-muted-foreground'
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return <Badge variant="outline" className={cn('inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-semibold', statusTone(status))}>
    {label ?? statusLabel(status)}
  </Badge>
}
