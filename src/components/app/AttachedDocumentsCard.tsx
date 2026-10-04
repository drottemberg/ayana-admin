import { HugeiconsIcon } from '@hugeicons/react'
import Add01Icon from '@hugeicons/core-free-icons/Add01Icon'
import Copy01Icon from '@hugeicons/core-free-icons/Copy01Icon'
import File02Icon from '@hugeicons/core-free-icons/File02Icon'
import Link01Icon from '@hugeicons/core-free-icons/Link01Icon'
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'

import { BaseCard } from '@/components/app/BaseCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { FileUtils } from '@/utils'

export type AttachedDocument = {
  id: string
  name: string
  size: number
  url?: string | null
}

type AttachedDocumentsCardProps = {
  title?: string
  documents?: AttachedDocument[]
  isLoading?: boolean
  emptyMessage?: string
  secondaryAction?: 'copy' | 'delete'
  onAdd?: () => void
  onOpen?: (document: AttachedDocument) => void
  onCopy?: (document: AttachedDocument) => void
  onDelete?: (document: AttachedDocument) => void
}

export function AttachedDocumentsCard({
  title = 'Attached documents',
  documents = [],
  isLoading = false,
  emptyMessage = 'No documents yet',
  secondaryAction = 'copy',
  onAdd,
  onOpen,
  onCopy,
  onDelete,
}: AttachedDocumentsCardProps) {
  if (isLoading) return <AttachedDocumentsCardSkeleton />

  return (
    <BaseCard>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <HugeiconsIcon icon={File02Icon} strokeWidth={2} className="size-4" />
          {title}
        </div>
        {onAdd ? (
          <Button variant="outline" size="icon-sm" aria-label="Add document" onClick={onAdd}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-2">
        {documents.length ? (
          documents.map((document) => (
            <div key={document.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 text-sm">
              <div className="min-w-0">
                {document.url ? (
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block font-semibold break-words underline-offset-2 hover:underline"
                  >
                    {document.name}
                  </a>
                ) : (
                  <span className="block font-semibold break-words">{document.name}</span>
                )}
                <span className="mt-0.5 block text-muted-foreground">{FileUtils.displayFileSize(document.size)}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={`Open ${document.name}`}
                  onClick={() => onOpen?.(document)}
                >
                  <HugeiconsIcon icon={Link01Icon} strokeWidth={2} />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={`${secondaryAction === 'delete' ? 'Delete' : 'Copy'} ${document.name}`}
                  onClick={() => (secondaryAction === 'delete' ? onDelete?.(document) : onCopy?.(document))}
                >
                  <HugeiconsIcon
                    icon={secondaryAction === 'delete' ? Delete02Icon : Copy01Icon}
                    strokeWidth={2}
                    className={cn(secondaryAction === 'delete' && 'text-destructive')}
                  />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-3 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        )}
      </div>
    </BaseCard>
  )
}

function AttachedDocumentsCardSkeleton() {
  return (
    <BaseCard skeleton>
      <Skeleton className="h-5 w-48" />
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-4" />
      ))}
    </BaseCard>
  )
}
