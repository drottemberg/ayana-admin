import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function DeltaBadge({ value, className }: { value?: number, className?: string }) {
    if (value == null) return null

    const isUp = value > 0

    return (
        <Badge
            variant="outline"
            className={cn(
                'border-current bg-background h-8 text-md',
                isUp ? 'text-[var(--color-success-600,#00a66a)] bg-[var(--color-success-50)]' : 'text-[var(--color-destructive)] bg-[var(--color-error-50)]',
                className
            )}
        >
            {`'${value > 0 ? '+' : ''}${value}%`}
        </Badge>
    )
}
