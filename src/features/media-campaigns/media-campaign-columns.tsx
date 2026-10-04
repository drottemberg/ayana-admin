import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import type { MediaCampaign } from '@/types/media'
import { DateUtils, StringUtils } from '@/utils'

export function renderCampaignStatus(campaign: MediaCampaign) {
  const status = campaign.isArchived ? 'archived' : (campaign.status ?? 'draft')
  const normalized = status.toLowerCase()
  const className =
    normalized === 'active' || normalized === 'started'
      ? 'bg-green-100 text-green-800 border-green-200'
      : normalized === 'paused' || normalized === 'draft'
        ? 'bg-orange-100 text-orange-800 border-orange-200'
        : normalized === 'failed'
          ? 'bg-red-100 text-red-800 border-red-200'
          : 'bg-muted text-muted-foreground border-border'

  return (
    <Badge variant="outline" className={className}>
      <span className="capitalize">{status.replaceAll('_', ' ')}</span>
    </Badge>
  )
}

export function getMediaCampaignColumns({
  showCustomer = true,
  linkName = true,
}: { showCustomer?: boolean; linkName?: boolean } = {}): ColumnDef<MediaCampaign>[] {
  return [
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => renderCampaignStatus(row.original),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) =>
        linkName ? (
          <Link to={`/media-campaigns/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
            {row.original.name}
          </Link>
        ) : (
          row.original.name
        ),
    },
    ...(showCustomer
      ? [
          {
            accessorKey: 'customer',
            header: 'Customer',
            cell: ({ row }) => row.original.customer?.name || NO_VALUE_STR,
            sortingFn: (a, b) => StringUtils.safeLocaleCompare(a.original.customer?.name, b.original.customer?.name),
          } satisfies ColumnDef<MediaCampaign>,
        ]
      : []),
    {
      accessorKey: 'startAt',
      header: 'Start at',
      cell: ({ row }) => DateUtils.formatDisplayDate(row.original.startAt),
    },
    {
      accessorKey: 'endAt',
      header: 'End at',
      cell: ({ row }) => DateUtils.formatDisplayDate(row.original.endAt),
    },
  ]
}

export const mediaCampaignColumns = getMediaCampaignColumns()
