import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { useConnect } from '@/features/app/use-connect'
import { getUserRequestsRequest } from '@/features/user-requests/api'
import { userRequestsQueryKeys } from '@/features/user-requests/query-keys'
import { UserRequestService, UserRequestTab } from '@/features/user-requests/user-request-service'
import { Drawer, DrawerId } from '@/providers/drawer'
import { Feature } from '@/types/feature'
import type { UserRequest } from '@/types/user-request'
import { formatDateTime } from '@/utils/date-utils'

function buildColumns(tab: UserRequestTab): ColumnDef<UserRequest>[] {
  return [
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => UserRequestService.typeToString(row.original.type),
    },
    {
      id: 'contact',
      header: tab === UserRequestTab.SENT ? 'Recipient' : 'Sender',
      cell: ({ row }) => UserRequestService.getContactText(row.original),
    },
    {
      accessorKey: 'metadata',
      header: 'Details',
      cell: ({ row }) => UserRequestService.getMetadataText(row.original),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => UserRequestService.statusToString(row.original.status),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => formatDateTime(row.original.createdAt, '-'),
    },
  ]
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<UserRequestTab>(UserRequestTab.RECEIVED)
  const { session } = useConnect()
  const canInviteUsers = Boolean(session?.hasFeature(Feature.INVITATIONS))
  const requestsQuery = useQuery({
    queryKey: userRequestsQueryKeys.all,
    queryFn: getUserRequestsRequest,
  })
  const allRequests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data])
  const requests = useMemo(() => UserRequestService.filterByTab(allRequests, activeTab), [activeTab, allRequests])
  const columns = useMemo(() => buildColumns(activeTab), [activeTab])

  return (
    <>
      <PageHeader
        title="Home"
        primaryAction={
          canInviteUsers
            ? {
                children: 'Send invite',
                onClick: () => Drawer.show(DrawerId.CreateUser, { mode: 'invite' }),
              }
            : undefined
        }
        tabs={[
          {
            key: UserRequestTab.RECEIVED,
            label: 'Received',
            count: allRequests.filter((r) => !r.isSent).length,
            active: activeTab === UserRequestTab.RECEIVED,
            onClick: () => setActiveTab(UserRequestTab.RECEIVED),
          },
          {
            key: UserRequestTab.SENT,
            label: 'Sent',
            count: allRequests.filter((r) => r.isSent).length,
            active: activeTab === UserRequestTab.SENT,
            onClick: () => setActiveTab(UserRequestTab.SENT),
          },
        ]}
      />

      <section className="p-4 md:p-6">
        <DataTable
          tableData={requests}
          tableKey={`home.user-requests.${activeTab}`}
          columns={columns}
          searchPlaceholder="Search requests..."
          searchColumns={['type', 'status']}
          filters={[
            {
              id: 'status',
              label: 'Status',
              column: 'status',
              getValue: (request) => UserRequestService.statusToString(request.status),
            },
          ]}
          getRowCommands={(request) => UserRequestService.getActions(request)}
          isLoading={requestsQuery.isLoading}
          loadingMessage="Loading requests..."
          emptyMessage="No requests found."
          errorMessage="No requests found."
        />
      </section>
    </>
  )
}
