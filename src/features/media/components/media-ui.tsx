import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { DateUtils, FileUtils } from '@/utils'
import { NO_VALUE_STR } from '@/constants'

export function MediaThumbnail({
  src,
  alt,
  className,
  showPlay = false,
}: {
  src?: string | null
  alt: string
  className?: string
  showPlay?: boolean
}) {
  return (
    <div
      className={cn('relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-md bg-muted', className)}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs text-muted-foreground">IMG</span>
      )}
      {showPlay ? (
        <span className="absolute grid size-5 place-items-center rounded-full bg-black/55 text-white">
          <span className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-current" />
        </span>
      ) : null}
    </div>
  )
}

export function MediaTags({ tags }: { tags?: string[] }) {
  if (!tags?.length) return <span className="text-muted-foreground">{NO_VALUE_STR}</span>

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="bg-muted text-xs text-foreground">
          {tag}
        </Badge>
      ))}
    </div>
  )
}

export function formatDuration(seconds?: number) {
  if (!seconds && seconds !== 0) return NO_VALUE_STR

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function formatResolution(width?: number, height?: number) {
  return width && height ? `${width}x${height}` : NO_VALUE_STR
}

export function formatSizeMb(sizeMb?: number) {
  return typeof sizeMb === 'number'
    ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(sizeMb)} Mo`
    : NO_VALUE_STR
}

export function formatSizeBytes(sizeBytes?: number) {
  return typeof sizeBytes === 'number' ? FileUtils.displayFileSize(sizeBytes / 1024) : NO_VALUE_STR
}

export function formatDateTime(value?: string) {
  return value ? DateUtils.formatDateTime(value, NO_VALUE_STR) : NO_VALUE_STR
}
