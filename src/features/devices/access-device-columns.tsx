import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import type { AccessDevice } from '@/features/devices/access-device-api'
import { DateUtils } from '@/utils'

const TYPE_LABELS: Record<string, string> = {
  GENERIC: 'Generic',
  AC600: 'AC600',
  STRIPE_TERMINAL: 'Stripe Terminal',
}

export const accessDeviceColumns: ColumnDef<AccessDevice>[] = [
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
        {row.original.isActive ? 'Active' : 'Disabled'}
      </Badge>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => row.original.label?.trim() || row.original.deviceId,
  },
  {
    accessorKey: 'deviceId',
    header: 'Device ID',
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => TYPE_LABELS[row.original.type] ?? row.original.type,
  },
  {
    accessorKey: 'purpose',
    header: 'Purpose',
    cell: ({ row }) => ({ ACCESS: 'Access', CHECK_IN: 'Check-in', PAYMENT: 'Payment' }[row.original.purpose] ?? row.original.purpose),
  },
  {
    id: 'organization',
    header: 'Customer / location',
    cell: ({ row }) => {
      const organization = row.original.organization
      if (!organization) return row.original.organizationId
      const path = organization.type === 'LOCATION' ? `/locations/${organization.id}` : `/customers/${organization.id}`
      return <Link className="underline-offset-2 hover:underline" to={path}>{organization.name || organization.id}</Link>
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => row.original.createdAt ? DateUtils.formatDateTime(row.original.createdAt, NO_VALUE_STR) : NO_VALUE_STR,
  },
]
