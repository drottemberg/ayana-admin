import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { OrganizationStatusBadge } from '@/features/organizations/OrganizationStatusBadge'
import type { Location } from '@/types/location'
import { formatPhoneNumber } from '@/lib/phone'
import { StringUtils, TimezoneUtils } from '@/utils'

export function LocationListCard({
  location,
  actions,
  showCustomer = false,
}: {
  location: Location
  actions: ReactNode
  showCustomer?: boolean
}) {
  const address = location.address ? StringUtils.displayAddress(location.address, { splitter: '\n' }) : ''
  const phones = [
    ...(location.phone ? [{ label: 'Phone', value: location.phone }] : []),
    ...(location.contactPhone && location.contactPhone !== location.phone ? [{ label: 'Contact phone', value: location.contactPhone }] : []),
  ]
  const emails = [
    ...(location.email ? [{ label: 'Email', value: location.email }] : []),
    ...(location.contactEmail && location.contactEmail !== location.email ? [{ label: 'Contact email', value: location.contactEmail }] : []),
  ]
  const hasContact = Boolean(location.contactName || phones.length || emails.length)

  return <article className="flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-card-foreground shadow-sm sm:gap-4 sm:px-5">
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/locations/${encodeURIComponent(location.id)}`} className="line-clamp-2 break-words text-base font-semibold leading-5 text-foreground hover:underline">
            {location.name}
          </Link>
          {showCustomer && location.customerName && location.parentId ? (
            <Link to={`/customers/${encodeURIComponent(location.parentId)}`} className="mt-1 block truncate text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              {location.customerName}
            </Link>
          ) : null}
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          <OrganizationStatusBadge status={location.status} isDeleted={location.isDeleted} isArchived={location.isArchived} />
          {actions ? <div className="-mr-2 -mt-2">{actions}</div> : null}
        </div>
      </div>
      {address || hasContact ? <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
        {address ? <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">Address</div>
          <div className="mt-1 whitespace-pre-line break-words text-sm leading-5 text-[#625b56]">{address}</div>
        </div> : null}
        {hasContact ? <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">Contact</div>
          {location.contactName ? <div className="mt-1 truncate text-sm font-medium leading-5 text-foreground">{location.contactName}</div> : null}
          <div className="mt-1 space-y-0.5">
            {phones.map(({ label, value }) => <div key={label} className="flex min-w-0 gap-1.5 text-sm leading-5">
              <span className="shrink-0 text-muted-foreground">{label}</span>
              <a href={`tel:${value.replace(/[^+\d]/g, '')}`} className="truncate text-[#625b56] underline-offset-2 hover:text-foreground hover:underline">{formatPhoneNumber(value)}</a>
            </div>)}
            {emails.map(({ label, value }) => <div key={label} className="flex min-w-0 gap-1.5 text-sm leading-5">
              <span className="shrink-0 text-muted-foreground">{label}</span>
              <a href={`mailto:${value}`} className="truncate text-[#625b56] underline-offset-2 hover:text-foreground hover:underline">{value}</a>
            </div>)}
          </div>
        </div> : null}
      </div> : null}
      <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
        {location.timezone ? <span className="inline-flex h-6 max-w-full items-center truncate rounded-md bg-muted px-2 text-xs font-medium text-muted-foreground">{TimezoneUtils.getTimezoneLabel(location.timezone)}</span> : null}
        {location.currency ? <span className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-xs font-medium text-muted-foreground">{location.currency}</span> : null}
      </div>
    </div>
  </article>
}
