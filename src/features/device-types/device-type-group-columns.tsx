import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { DeviceTypeGroupStatus, type DeviceTypeGroup } from '@/features/device-types/api'
import { DeviceTypeGroupService } from '@/features/device-types/device-type-group-service'
import { formatDateTime } from '@/utils/date-utils'

const badgeClassByStatus: Record<DeviceTypeGroupStatus, string> = {
  [DeviceTypeGroupStatus.ACTIVE]: 'bg-green-100 text-green-800 border-green-200',
  [DeviceTypeGroupStatus.DISABLED]: 'bg-orange-100 text-orange-800 border-orange-200',
  [DeviceTypeGroupStatus.ARCHIVED]: 'bg-muted text-muted-foreground border-border',
  [DeviceTypeGroupStatus.DELETED]: 'bg-red-100 text-red-800 border-red-200',
}

const labelByStatus: Record<DeviceTypeGroupStatus, string> = {
  [DeviceTypeGroupStatus.ACTIVE]: 'Active',
  [DeviceTypeGroupStatus.DISABLED]: 'Disabled',
  [DeviceTypeGroupStatus.ARCHIVED]: 'Archived',
  [DeviceTypeGroupStatus.DELETED]: 'Deleted',
}

export const deviceTypeGroupColumns: ColumnDef<DeviceTypeGroup>[] = [
  {
    id: 'status',
    header: 'Status',
    accessorFn: (group) => DeviceTypeGroupService.getStatus(group),
    cell: ({ row }) => {
      const status = DeviceTypeGroupService.getStatus(row.original)

      return (
        <Badge variant="outline" className={badgeClassByStatus[status]}>
          {labelByStatus[status]}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link
        className="font-medium text-foreground underline-offset-2 hover:underline"
        to={`/device-type-groups/${row.original.id}`}
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'deviceTypeCount',
    header: 'Device Type count',
    size: 150,
    cell: ({ row }) => <span className="tabular-nums">{row.original.deviceTypeCount ?? 0}</span>,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created at',
    cell: ({ row }) => formatDateTime(row.original.createdAt, '-'),
  },
]
