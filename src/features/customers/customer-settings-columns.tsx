import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import type {
  CustomerLocationPolicyRow,
  CustomerMessagingConfigRow,
  CustomerPromptProfileRow,
} from '@/features/customers/customer-settings-api'

export const customerMessagingConfigColumns: ColumnDef<CustomerMessagingConfigRow>[] = [
  { accessorKey: 'whatsapp', header: 'WhatsApp' },
  {
    accessorKey: 'whatsappBusinessPhoneNumber',
    header: 'WhatsApp business number',
    cell: ({ row }) => row.original.whatsappBusinessPhoneNumber?.trim() || NO_VALUE_STR,
  },
  { accessorKey: 'telegram', header: 'Telegram' },
]

export const customerPromptProfileColumns: ColumnDef<CustomerPromptProfileRow>[] = [
  { accessorKey: 'summary', header: 'Agent profile' },
  {
    accessorKey: 'communicationStyle',
    header: 'Communication style',
    cell: ({ row }) => row.original.communicationStyle || NO_VALUE_STR,
  },
]

export const customerLocationPolicyColumns: ColumnDef<CustomerLocationPolicyRow>[] = [
  {
    accessorKey: 'name',
    header: 'Location',
    cell: ({ row }) => (
      <Link to={`/locations/${row.original.id}`} className="font-medium underline-offset-2 hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'isConfigured',
    header: 'Policy',
    cell: ({ row }) => (
      <Badge variant="outline" className={row.original.isConfigured ? 'border-green-200 text-green-800' : ''}>
        {row.original.isConfigured ? 'Configured' : 'Defaults'}
      </Badge>
    ),
  },
  {
    accessorKey: 'lateCancelWindowHours',
    header: 'Late cancellation',
    cell: ({ row }) => `${row.original.lateCancelWindowHours} h · ${row.original.lateCancelPenaltyCredits} credits`,
  },
  { accessorKey: 'noShowPenaltyCredits', header: 'No-show credits' },
  {
    accessorKey: 'openingDate',
    header: 'Opening date',
    cell: ({ row }) => row.original.openingDate ? new Date(row.original.openingDate).toLocaleDateString() : NO_VALUE_STR,
  },
]
