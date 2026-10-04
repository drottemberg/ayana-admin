import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { NO_VALUE_STR } from '@/constants'
import { Badge } from '@/components/ui/badge'
import { DeviceEntityStatusBadge, DeviceStatus } from '@/features/devices/components/DeviceStatus'
import { DeviceService } from '@/features/devices/device-service'
import { ContractStatusLabel } from '@/types/contract'
import type { Device } from '@/types/device'
import { DeviceConditionLabel } from '@/types/device'
import { DateUtils, StringUtils } from '@/utils'

function getDeviceTypeGroupName(device: Device) {
  const type = Array.isArray(device.type) ? device.type[0] : device.type
  return typeof type === 'object' ? (type.group?.name ?? NO_VALUE_STR) : NO_VALUE_STR
}

function formatLastSeen(value?: string) {
  return value ? DateUtils.formatDateTime(value, NO_VALUE_STR) : NO_VALUE_STR
}

function formatContractStatus(status?: string) {
  if (!status) return NO_VALUE_STR
  return ContractStatusLabel[status as keyof typeof ContractStatusLabel] ?? status
}

function getDeviceSetName(device: Device) {
  return device.parentSet?.name || device.parentSet?.serialNumber || device.parentId || ''
}

export const deviceColumns: ColumnDef<Device>[] = [
  {
    accessorKey: 'entityStatus',
    header: 'Status',
    cell: ({ row }) => <DeviceEntityStatusBadge status={row.original.entityStatus} />,
  },
  {
    accessorKey: 'status',
    header: 'Connection',
    cell: ({ row }) => (row.original.isSet ? 'N/A' : <DeviceStatus status={row.original.status} />),
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link to={`/devices/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
        {DeviceService.getDisplayName(row.original)}
      </Link>
    ),
  },
  {
    accessorKey: 'parentSet',
    header: 'Set',
    cell: ({ row }) => {
      const setName = getDeviceSetName(row.original)
      if (!row.original.parentId || !setName) return NO_VALUE_STR

      return (
        <Link to={`/devices/${row.original.parentId}`} className="font-medium underline-offset-2 hover:underline">
          {setName}
        </Link>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'serialNumber',
    header: 'Serial',
    enableSorting: false,
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-2">
        {DeviceService.getTypeLabelsFromQuery(row.original).map((type) => (
          <Badge key={type} variant="secondary" className="bg-muted text-xs text-foreground">
            {type}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    id: 'typeGroup',
    header: 'Group',
    cell: ({ row }) => getDeviceTypeGroupName(row.original),
  },
  {
    accessorKey: 'lastSeen',
    header: 'Last seen',
    cell: ({ row }) => formatLastSeen(row.original.lastSeen),
  },
  {
    id: 'activeContract',
    header: 'Last active contract',
    cell: ({ row }) => {
      const contract = row.original.contract
      if (!contract?.id) return NO_VALUE_STR

      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{contract.name || contract.id}</span>
          <span className="text-xs text-muted-foreground">
            {[formatContractStatus(contract.status), row.original.customer?.name, row.original.store?.name]
              .filter(Boolean)
              .join(' / ')}
          </span>
        </div>
      )
    },
    sortingFn: (a, b) => StringUtils.safeLocaleCompare(a.original.contract?.name, b.original.contract?.name),
  },
  {
    accessorKey: 'activeProduct',
    header: 'Active product',
    cell: ({ row }) => row.original.activeProduct?.name || NO_VALUE_STR,
    sortingFn: (a, b) => StringUtils.safeLocaleCompare(a.original.activeProduct?.name, b.original.activeProduct?.name),
  },
  {
    accessorKey: 'activeCampaign',
    header: 'Active campaign',
    cell: ({ row }) => row.original.activeCampaign?.name || NO_VALUE_STR,
    sortingFn: (a, b) =>
      StringUtils.safeLocaleCompare(a.original.activeCampaign?.name, b.original.activeCampaign?.name),
  },
  {
    accessorKey: 'condition',
    header: 'Device physical status',
    cell: ({ row }) => (row.original.condition ? DeviceConditionLabel[row.original.condition] : NO_VALUE_STR),
  },
]
