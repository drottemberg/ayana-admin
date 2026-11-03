import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getIntegrationProviderLabel, type CustomerIntegration } from './api'

export function getIntegrationColumns(onSetup?: (integration: CustomerIntegration) => void): ColumnDef<CustomerIntegration>[] {
  return [
    { accessorKey: 'provider', header: 'Service', cell: ({ row }) => getIntegrationProviderLabel(row.original.provider) },
    { accessorKey: 'username', header: 'Account', cell: ({ row }) => <span className="font-medium">{row.original.username ?? '—'}</span> },
    {
      accessorKey: 'setupComplete',
      header: 'Setup',
      cell: ({ row }) => {
        const item = row.original
        const label = item.setupComplete ? 'Complete' : item.setupStarted ? 'In progress' : 'Not started'
        return <Badge variant="outline" className={item.setupComplete ? 'border-green-200 text-green-800' : 'text-muted-foreground'}>{label}</Badge>
      },
    },
    { accessorKey: 'mappedLocationsCount', header: 'Locations', cell: ({ row }) => row.original.mappedLocationsCount || '—' },
    {
      accessorKey: 'isEnabled',
      header: 'Status',
      cell: ({ row }) => <Badge variant="outline" className={row.original.isEnabled ? 'border-green-200 text-green-800' : 'text-muted-foreground'}>{row.original.isEnabled ? 'Enabled' : 'Disabled'}</Badge>,
    },
    {
      id: 'setupAction',
      header: '',
      enableHiding: false,
      cell: ({ row }) => !onSetup || row.original.setupComplete ? null : <Button type="button" variant="outline" size="sm" onClick={() => onSetup(row.original)}>{row.original.setupStarted ? 'Continue setup' : 'Start setup'}</Button>,
    },
  ]
}
