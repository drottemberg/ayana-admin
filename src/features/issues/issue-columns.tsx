import ShieldEnergyIcon from '@hugeicons/core-free-icons/ShieldEnergyIcon'
import ShieldHalfIcon from '@hugeicons/core-free-icons/ShieldHalfIcon'
import ShieldPlusIcon from '@hugeicons/core-free-icons/ShieldPlusIcon'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import { DeviceStatus } from '@/features/devices/components/DeviceStatus'
import { IssueService } from '@/features/issues/issue-service'
import { getIssueTypeLabels } from '@/features/issues/issue-utils'
import { cn } from '@/lib/utils'
import { IssueSeverity, IssueSlaClass, type Issue } from '@/types/issue'

export const issueColumns: ColumnDef<Issue>[] = [
  {
    id: 'deviceName',
    header: 'Device name',
    cell: ({ row }) => {
      const device = row.original.device

      return device?.id ? (
        <Link to={`/devices/${device.id}`} className="font-medium underline-offset-2 hover:underline">
          {device.name || NO_VALUE_STR}
        </Link>
      ) : (
        NO_VALUE_STR
      )
    },
  },
  {
    accessorKey: 'severity',
    header: 'Issue',
    cell: ({ row }) => renderIssueSeverity(row.original.severity),
  },
  {
    accessorKey: 'slaClass',
    header: 'SLA',
    cell: ({ row }) => (row.original.slaClass ? renderIssueSla(row.original.slaClass) : NO_VALUE_STR),
  },
  {
    accessorKey: 'serialNumber',
    header: 'Serial number',
    cell: ({ row }) => row.original.serialNumber ?? row.original.device?.serialNumber ?? NO_VALUE_STR,
    enableSorting: false,
  },
  {
    id: 'deviceType',
    header: 'Type',
    cell: ({ row }) => renderIssueDeviceType(row.original),
  },
  {
    id: 'deviceStatus',
    header: 'Status',
    cell: ({ row }) => (row.original.device ? <DeviceStatus status={row.original.device.status} /> : NO_VALUE_STR),
  },
  {
    accessorKey: 'customer',
    header: 'Customer',
    cell: ({ row }) => row.original.customer?.name || row.original.device?.customer?.name || NO_VALUE_STR,
  },
  {
    accessorKey: 'store',
    header: 'Store',
    cell: ({ row }) => row.original.store?.name || row.original.device?.store?.name || NO_VALUE_STR,
  },
]

function renderIssueSeverity(severity: Issue['severity']) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          'size-2 rounded-full',
          severity === IssueSeverity.Alert && 'bg-red-500',
          severity === IssueSeverity.Warning && 'bg-orange-500',
        )}
      />
      {IssueService.severityToString(severity)}
    </span>
  )
}

function renderIssueSla(slaClass: IssueSlaClass) {
  const icon: IconSvgElement =
    slaClass === IssueSlaClass.ClassAAA
      ? ShieldEnergyIcon
      : slaClass === IssueSlaClass.ClassAA
        ? ShieldPlusIcon
        : ShieldHalfIcon
  const className =
    slaClass === IssueSlaClass.ClassAAA
      ? 'border-orange-200 bg-orange-50 text-orange-700'
      : slaClass === IssueSlaClass.ClassAA
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-blue-200 bg-blue-50 text-blue-700'

  return (
    <Badge variant="outline" className={className}>
      <HugeiconsIcon icon={icon} strokeWidth={2} size={18} />
      <span className="font-semibold text-foreground">{IssueService.slaClassToString(slaClass)}</span>
    </Badge>
  )
}

function renderIssueDeviceType(issue: Issue) {
  const labels = getIssueTypeLabels(issue)

  if (!labels.length) return NO_VALUE_STR

  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((type) => (
        <Badge key={type} variant="secondary" className="bg-muted text-xs text-foreground">
          {type}
        </Badge>
      ))}
    </div>
  )
}
