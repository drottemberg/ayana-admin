import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { useConnect } from '@/features/app/use-connect'
import { getUserRequestsPageRequest } from '@/features/user-requests/api'
import { userRequestsQueryKeys } from '@/features/user-requests/query-keys'
import { UserRequestService } from '@/features/user-requests/user-request-service'
import { Drawer, DrawerId } from '@/providers/drawer'
import { UserRequestStatus, type UserRequest } from '@/types/user-request'
import { formatDateTime } from '@/utils/date-utils'

const columns: ColumnDef<UserRequest>[] = [
  { accessorKey: 'type', header: 'Type', cell: ({ row }) => UserRequestService.typeToString(row.original.type) },
  {
    id: 'contact',
    header: 'Contact',
    cell: ({ row }) => UserRequestService.getContactText(row.original, !row.original.isSent),
  },
  { id: 'details', header: 'Details', cell: ({ row }) => UserRequestService.getMetadataText(row.original) },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => UserRequestService.statusToString(row.original.status) },
  { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => formatDateTime(row.original.createdAt, '-') },
]

export default function InvitesPage() {
  const [direction, setDirection] = useState<'RECEIVED' | 'SENT'>('RECEIVED')
  const { session } = useConnect()
  const canInvite = Boolean(session?.can('users', 'create'))

  return <>
    <PageHeader
      title="Invites"
      subtitle="Review invitations you received and track the ones you sent."
      primaryAction={canInvite ? { children: 'Send invite', onClick: () => Drawer.show(DrawerId.CreateUser, { mode: 'invite' }) } : undefined}
      tabs={[
        { key: 'received', label: 'Received', active: direction === 'RECEIVED', onClick: () => setDirection('RECEIVED') },
        { key: 'sent', label: 'Sent', active: direction === 'SENT', onClick: () => setDirection('SENT') },
      ]}
    />
    <section className="p-4 md:p-6">
      <DataTableAsync
        queryKey={[...userRequestsQueryKeys.all, 'page', direction]}
        loadData={(state: DataTableState<UserRequest>) => getUserRequestsPageRequest(state, direction, { type: ['ORG_INVITE'] })}
        refetchOnMount="always"
        tableKey={`invites.${direction.toLowerCase()}`}
        columns={columns}
        getRowCommands={(request) => UserRequestService.getActions(request)}
        disabledSelection
        searchPlaceholder="Search invitations..."
        searchColumns={['type', 'status']}
        filters={[
          {
            id: 'status', label: 'Status', column: 'status' as const,
            options: Object.values(UserRequestStatus),
            getValue: (request: UserRequest) => request.status,
          },
        ]}
        loadingMessage="Loading invites..."
        emptyMessage={`No ${direction.toLowerCase()} invites found.`}
        errorMessage="Failed to load invites."
      />
    </section>
  </>
}
