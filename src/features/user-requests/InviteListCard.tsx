import type { ReactNode } from 'react'

import { StatusPill } from '@/components/app/StatusPill'
import { memberAvatarColor, memberAvatarInitials } from '@/features/bookings/member-avatar'
import { cn } from '@/lib/utils'
import type { UserRequest } from '@/types/user-request'

function createdAtLabel(value?: number | null) {
  if (value == null) return null
  const timestamp = value > 0 && value < 1_000_000_000_000 ? value * 1000 : value
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

export function InviteListCard({
  request,
  actions,
  quickActions,
}: {
  request: UserRequest
  actions?: ReactNode
  quickActions?: ReactNode
}) {
  const contact = request.isSent
    ? request.recipients.map((recipient) => recipient.displayName || recipient.value).filter(Boolean).join(', ')
    : request.senderName || request.recipients.map((recipient) => recipient.displayName || recipient.value).filter(Boolean).join(', ')
  const name = contact || 'Invitation'
  const avatarIdentity = name.normalize('NFKC').trim().toLocaleLowerCase() || request.id
  const details = request.metadata
    ? [
        'orgName' in request.metadata ? request.metadata.orgName : null,
        'name' in request.metadata && request.metadata.kind === 'CUSTOMER' ? request.metadata.name : null,
        'role' in request.metadata ? request.metadata.role : null,
        'position' in request.metadata ? request.metadata.position : null,
      ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).join(' · ')
    : ''
  const date = createdAtLabel(request.createdAt)
  const inactive = ['CANCELLED', 'REJECTED'].includes(request.status)

  return (
    <article className={cn('flex min-w-0 items-start gap-3 rounded-2xl bg-card px-4 py-3.5 text-card-foreground shadow-sm sm:gap-4 sm:px-5', inactive && 'opacity-60')}>
      <div className={cn('mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold', memberAvatarColor(avatarIdentity))} aria-hidden="true">
        {memberAvatarInitials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-3 sm:flex sm:gap-3">
          <div className="min-w-0 sm:flex-1">
            <div className="line-clamp-2 text-base font-semibold leading-5 text-foreground [overflow-wrap:anywhere] sm:line-clamp-none sm:block sm:truncate" title={name}>{name}</div>
            {details ? <div className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere] sm:line-clamp-none sm:block sm:truncate" title={details}>{details}</div> : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-start">
            {actions ? <div className="sm:order-2">{actions}</div> : null}
            <span className="sm:order-1"><StatusPill status={request.status} /></span>
          </div>
          {date ? <div className="col-span-2 text-xs text-[#a29b96] sm:hidden">{date}</div> : null}
          {quickActions ? <div className="col-span-2 flex justify-end sm:shrink-0">{quickActions}</div> : null}
        </div>
        {date ? <div className="mt-2 hidden text-xs text-[#a29b96] sm:block">{date}</div> : null}
      </div>
    </article>
  )
}
