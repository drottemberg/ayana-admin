import type { ColumnDef } from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import { DeviceTypeStatus, type DeviceTypeConfig, type VariableMapping } from '@/features/device-types/api'
import { DeviceTypeService } from '@/features/device-types/device-type-service'
import { getDeviceTypeLabel } from '@/features/device-types/utils'
import { formatDateTime } from '@/utils/date-utils'

export function variableMappingTopics(mapping?: VariableMapping | null): string[] {
  const topics = []
  if (mapping?.status?.length) topics.push('status')
  if (mapping?.info?.length) topics.push('info')
  if (mapping?.setup?.length) topics.push('setup')
  return topics
}

export function variableMappingCount(mapping?: VariableMapping | null): number {
  return (mapping?.status?.length ?? 0) + (mapping?.info?.length ?? 0) + (mapping?.setup?.length ?? 0)
}

export function renderVariableMappingTopics(mapping?: VariableMapping | null) {
  const topics = variableMappingTopics(mapping)

  return (
    <div className="flex flex-wrap gap-1">
      {topics.length ? (
        topics.map((topic) => (
          <Badge key={topic} variant="secondary">
            {topic}
          </Badge>
        ))
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      )}
    </div>
  )
}

const badgeClassByStatus: Record<DeviceTypeStatus, string> = {
  [DeviceTypeStatus.ACTIVE]: 'bg-green-100 text-green-800 border-green-200',
  [DeviceTypeStatus.DISABLED]: 'bg-orange-100 text-orange-800 border-orange-200',
  [DeviceTypeStatus.ARCHIVED]: 'bg-muted text-muted-foreground border-border',
  [DeviceTypeStatus.DELETED]: 'bg-red-100 text-red-800 border-red-200',
}

const labelByStatus: Record<DeviceTypeStatus, string> = {
  [DeviceTypeStatus.ACTIVE]: 'Active',
  [DeviceTypeStatus.DISABLED]: 'Disabled',
  [DeviceTypeStatus.ARCHIVED]: 'Archived',
  [DeviceTypeStatus.DELETED]: 'Deleted',
}

export const deviceTypeColumns: ColumnDef<DeviceTypeConfig>[] = [
  {
    id: 'status',
    header: 'Status',
    accessorFn: (config) => DeviceTypeService.getStatus(config),
    cell: ({ row }) => {
      const status = DeviceTypeService.getStatus(row.original)

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
      <span className="font-medium">{row.original.name || getDeviceTypeLabel(row.original.code)}</span>
    ),
  },
  {
    accessorKey: 'group',
    header: 'Group',
    cell: ({ row }) => row.original.group?.name || <span className="text-sm text-muted-foreground">-</span>,
  },
  {
    accessorKey: 'hardwareVersion',
    header: 'Hardware version',
    cell: ({ row }) => row.original.hardwareVersion || <span className="text-sm text-muted-foreground">-</span>,
  },
  {
    accessorKey: 'deviceCount',
    header: 'Device count',
    size: 120,
    cell: ({ row }) => <span className="tabular-nums">{row.original.deviceCount ?? 0}</span>,
  },
  {
    accessorKey: 'documentationCount',
    header: 'Documentation files',
    size: 160,
    cell: ({ row }) => <span className="tabular-nums">{row.original.documentationCount ?? 0}</span>,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created at',
    cell: ({ row }) => formatDateTime(row.original.createdAt, '-'),
  },
]
