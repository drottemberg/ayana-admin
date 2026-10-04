import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import { deviceColumns } from '@/features/devices/device-columns'
import {
  ContractStatus,
  ContractStatusLabel,
  type Contract,
  type ContractDeviceHistory,
  type ContractStatus as ContractStatusType,
} from '@/types/contract'
import type { Device } from '@/types/device'
import { DateUtils, StringUtils } from '@/utils'

const statusBadgeClassName: Record<ContractStatusType, string> = {
  [ContractStatus.Created]: 'bg-blue-100 text-blue-800 border-blue-200',
  [ContractStatus.Active]: 'bg-green-100 text-green-800 border-green-200',
  [ContractStatus.Suspended]: 'bg-orange-100 text-orange-800 border-orange-200',
  [ContractStatus.Completed]: 'bg-muted text-muted-foreground border-border',
  [ContractStatus.Cancelled]: 'bg-red-100 text-red-800 border-red-200',
  [ContractStatus.Archived]: 'bg-muted text-muted-foreground border-border',
  [ContractStatus.Deleted]: 'bg-red-100 text-red-800 border-red-200',
}

type ContractStatusBadgeSource = Pick<Contract, 'status' | 'isDeleted' | 'isArchived'>

export function renderStatusBadge(contract: ContractStatusBadgeSource) {
  const status = getContractStatus(contract)

  return (
    <Badge variant="outline" className={statusBadgeClassName[status]}>
      {ContractStatusLabel[status] ?? status}
    </Badge>
  )
}

function getContractStatus(contract: ContractStatusBadgeSource): ContractStatusType {
  if (contract.isDeleted) return ContractStatus.Deleted
  if (contract.isArchived) return ContractStatus.Archived
  return contract.status
}

export const contractColumns: ColumnDef<Contract>[] = [
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => renderStatusBadge(row.original),
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link to={`/contracts/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'customer',
    header: 'Customer',
    cell: ({ row }) => row.original.customer?.name || NO_VALUE_STR,
    sortingFn: (a, b) => StringUtils.safeLocaleCompare(a.original.customer?.name, b.original.customer?.name),
  },
  {
    accessorKey: 'startDate',
    header: 'Start date',
    cell: ({ row }) => DateUtils.formatDisplayDate(row.original.startDate),
  },
  {
    accessorKey: 'endDate',
    header: 'End date',
    cell: ({ row }) => DateUtils.formatDisplayDate(row.original.endDate),
  },
  {
    accessorKey: 'createdAt',
    header: 'Created at',
    cell: ({ row }) => DateUtils.formatDateTime(row.original.createdAt, NO_VALUE_STR),
  },
]

const deviceContractStatusClassName: Record<ContractDeviceHistory['status'], string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  INACTIVE: 'bg-muted text-muted-foreground border-border',
}

export const contractDeviceHistoryColumns: ColumnDef<ContractDeviceHistory>[] = [
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant="outline" className={deviceContractStatusClassName[row.original.status]}>
        {row.original.status === 'ACTIVE' ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    accessorKey: 'contract',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.original.contract.name || NO_VALUE_STR}</span>,
    enableSorting: false,
  },
  {
    accessorKey: 'assignedAt',
    header: 'Assigned',
    cell: ({ row }) => DateUtils.formatDateTime(row.original.assignedAt, NO_VALUE_STR),
  },
  {
    accessorKey: 'unassignedAt',
    header: 'Unassigned',
    cell: ({ row }) => DateUtils.formatDateTime(row.original.unassignedAt ?? undefined, NO_VALUE_STR),
  },
]

export function getContractDeviceColumns(contract?: Contract): ColumnDef<Device>[] {
  return [
    ...deviceColumns,
    {
      accessorKey: 'contractDeliveryDate',
      header: 'Delivery date',
      cell: () => DateUtils.formatDisplayDate(contract?.startDate),
      enableSorting: false,
    },
    {
      accessorKey: 'contractPickupDate',
      header: 'Pickup date',
      cell: () => DateUtils.formatDisplayDate(contract?.endDate),
      enableSorting: false,
    },
  ]
}
