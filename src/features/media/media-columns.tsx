import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import { MediaThumbnail, formatDateTime } from '@/features/media/components/media-ui'
import type { Media } from '@/types/media'
import { StringUtils } from '@/utils'

function getMediaStatus(media: Media) {
  return media.status ?? 'active'
}

export function renderMediaStatusBadge(media: Media) {
  const status = getMediaStatus(media)
  const label = status ? String(status).replaceAll('_', ' ') : NO_VALUE_STR
  const normalized = String(status).toLowerCase()
  const className =
    normalized === 'deleted' || normalized === 'removed'
      ? 'bg-red-100 text-red-800 border-red-200'
      : normalized === 'disabled' || normalized === 'prepared'
        ? 'bg-orange-100 text-orange-800 border-orange-200'
        : normalized === 'archived'
          ? 'bg-muted text-muted-foreground border-border'
          : 'bg-green-100 text-green-800 border-green-200'

  return (
    <Badge variant="outline" className={className}>
      <span className="capitalize">{label}</span>
    </Badge>
  )
}

export function getMediaColumns({ showCustomer = true }: { showCustomer?: boolean } = {}): ColumnDef<Media>[] {
  return [
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => renderMediaStatusBadge(row.original),
    },
    {
      id: 'thumbnail',
      header: 'Thumbnail',
      cell: ({ row }) => <MediaThumbnail src={row.original.thumbnailUrl} alt={row.original.name} showPlay />,
      enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link to={`/media/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    ...(showCustomer
      ? [
          {
            accessorKey: 'customer',
            header: 'Customer',
            cell: ({ row }) => row.original.customer?.name || NO_VALUE_STR,
            sortingFn: (a, b) => StringUtils.safeLocaleCompare(a.original.customer?.name, b.original.customer?.name),
          } satisfies ColumnDef<Media>,
        ]
      : []),
    {
      accessorKey: 'createdAt',
      header: 'Created at',
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
  ]
}

export const mediaColumns = getMediaColumns()
