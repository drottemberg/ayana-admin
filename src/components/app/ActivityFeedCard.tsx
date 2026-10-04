import { HugeiconsIcon } from '@hugeicons/react'
import Notification02Icon from '@hugeicons/core-free-icons/Notification02Icon'
import Settings01Icon from '@hugeicons/core-free-icons/Settings01Icon'

import { BaseCard } from '@/components/app/BaseCard'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownActionsMenu, type DropdownActionItem } from '@/components/ui/dropdown-menu'
import { useMemo, useState } from 'react'
import { DateUtils } from '@/utils'

export type FeedType = 'intervention' | 'comment'

export type ActivityFeedItem = {
  id: string
  message: string
  createdAt: string
  type?: FeedType
}

type ActivityFeedCardProps = {
  items?: ActivityFeedItem[]
  isLoading?: boolean
  onAddComment?: () => void
  onAddIntervention?: () => void
  onSettings?: () => void
}

export function ActivityFeedCard({
  items = [],
  isLoading = false,
  onAddComment,
  onAddIntervention,
  onSettings,
}: ActivityFeedCardProps) {
  const [type, setType] = useState<FeedType | 'all'>('all')

  const interventions = items.filter((item) => item.type === 'intervention')
  const interventionCount = interventions.length
  const comments = items.filter((item) => item.type === 'comment')
  const commentCount = comments.length
  const listItems = type == 'comment' ? comments : type == 'intervention' ? interventions : items

  const actions: DropdownActionItem[] = useMemo(() => {
    const list = []

    if (onAddComment) {
      list.push({
        label: 'Comment',
        onClick: onAddComment,
      })
    }

    if (onAddIntervention) {
      list.push({
        label: 'Intervention',
        onClick: onAddIntervention,
      })
    }

    return list
  }, [onAddComment, onAddIntervention])

  if (isLoading) return <ActivityFeedCardSkeleton />

  return (
    <BaseCard>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <HugeiconsIcon icon={Notification02Icon} strokeWidth={2} className="size-4" />
          Activity feed
        </div>
        {onSettings ? (
          <Button variant="ghost" size="icon-sm" aria-label="Activity settings" onClick={onSettings}>
            <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox />
            Subscribe to updates
          </label>
          <label className="flex items-center gap-2">
            <Checkbox />
            Disable notification
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownActionsMenu
            items={actions}
            align="end"
            triggerRender={<Button variant="outline" size="sm" />}
            showChevron
          >
            Add
          </DropdownActionsMenu>
        </div>
      </div>

      {items.length ? (
        <>
          <Tabs defaultValue="all" className="mt-2" value={type}>
            <TabsList variant="line" aria-label="Activity feed filters">
              <TabsTrigger value="all" className="pb-2" onClick={() => setType('all')}>
                All
              </TabsTrigger>
              <TabsTrigger value="intervention" className="pb-2" onClick={() => setType('intervention')}>
                Intervention ({interventionCount})
              </TabsTrigger>
              <TabsTrigger value="comment" className="pb-2" onClick={() => setType('comment')}>
                Comments ({commentCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid text-sm">
            {listItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 border-b py-2 last:border-b-0">
                <span className="min-w-0 truncate">{item.message}</span>
                <span className="text-right text-xs font-medium text-foreground">
                  {DateUtils.formatDateTime(item.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="py-3 text-center text-sm text-muted-foreground">No activity yet</div>
      )}
    </BaseCard>
  )
}

function ActivityFeedCardSkeleton() {
  return (
    <BaseCard skeleton>
      <Skeleton className="h-5 w-36" />
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-4" />
      ))}
    </BaseCard>
  )
}
