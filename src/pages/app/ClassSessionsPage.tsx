import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { getCustomersListRequest } from '@/features/customers/api'
import { getClassSessionColumns } from '@/features/classes/class-session-columns'
import { cancelClassSessionRequest, getClassCategoryOptions, getClassSessionsRequest, getClassTypeLocationOptions } from '@/features/classes/api'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import { Modals } from '@/providers/modal'
import type { ClassSession } from '@/types/class-type'

export default function ClassSessionsPage() {
  const { session } = useConnect()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdminContext = getAppMode() === 'admin'
  const currentCustomerId = session?.currentOrganization?.id
  const [searchParams] = useSearchParams()
  const canCancelSessions = Boolean(session?.permissions.classSessions?.delete)
  const filterCustomerId = searchParams.get('filterCustomerId')
  const filterLocationId = searchParams.get('filterLocationId')
  const initialFilters = {
    ...(isAdminContext && filterCustomerId ? { customerId: [filterCustomerId] } : {}),
    ...(filterLocationId ? { locationId: [filterLocationId] } : {}),
  }
  const columns = useMemo(
    () => getClassSessionColumns({ showCustomer: isAdminContext, showLocation: true }),
    [isAdminContext],
  )

  return (
    <>
      <PageHeader
        title="Class sessions"
        subtitle="Review scheduled classes, capacity, and bookings."
        primaryAction={{ children: 'Class types and schedules', onClick: () => navigate('/classes') }}
      />
      <section className="p-4 md:p-6">
        <DataTableAsync
          queryKey={[...classSessionsQueryKeys.all, 'table']}
          loadData={(state: DataTableState<ClassSession>) => getClassSessionsRequest(
            state,
            !isAdminContext && currentCustomerId
              ? { customerId: currentCustomerId }
              : undefined,
          )}
          refetchOnMount="always"
          tableKey="class-sessions.root"
          initialFilters={Object.keys(initialFilters).length ? initialFilters : undefined}
          columns={columns}
          getRowCommands={(item) => [
            {
              label: 'View session',
              onClick: () => navigate(`/class-sessions/${item.id}?locationId=${encodeURIComponent(item.locationId ?? item.organizationId)}`),
            },
            ...(canCancelSessions && (item.status === 'SCHEDULED' || item.status === 'PAUSED') ? [{
              label: 'Cancel session',
              variant: 'destructive' as const,
              onClick: async () => {
                const confirmed = await Modals.confirm({
                  title: 'Cancel this class session?',
                  content: 'All bookings will be cancelled. Members with an email address will be notified, and used contract credits will be returned.',
                  okText: 'Cancel session',
                  cancelText: 'Keep session',
                  okButtonProps: { variant: 'destructive' },
                })
                if (!confirmed) return
                try {
                  const result = await cancelClassSessionRequest(item.id, item.locationId ?? item.organizationId)
                  await queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all })
                  toast.success(`Session cancelled. ${result.bookingCount} booking(s) cancelled; ${result.creditsReturned} credit(s) returned.`)
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not cancel the class session.')
                }
              },
            }] : []),
          ]}
          disabledSelection
          searchPlaceholder="Search by class, session, or coach"
          searchColumns={['id', 'className', 'coachName']}
          filters={[
            ...(!isAdminContext ? [] : [{
              id: 'customerId',
              label: 'Customer',
              column: 'customerId' as const,
              selectionMode: 'single' as const,
              queryFn: async (search: string) => {
                const customers = await getCustomersListRequest(undefined, search)
                return { items: customers.map((customer) => ({ id: customer.id, label: customer.name })), total: customers.length }
              },
              getValue: (item: ClassSession) => item.customerId,
            }]),
            {
              id: 'locationId',
              label: 'Location',
              column: 'locationId' as const,
              selectionMode: 'single' as const,
              queryFn: getClassTypeLocationOptions,
              getValue: (item: ClassSession) => item.locationId,
            },
            {
              id: 'category', label: 'Category', column: 'classCategory' as const,
              selectionMode: 'single' as const,
              queryFn: getClassCategoryOptions,
              getValue: (item: ClassSession) => item.classCategory,
            },
            {
              id: 'status', label: 'Status', column: 'status' as const,
              options: ['SCHEDULED', 'PAUSED', 'CANCELLED', 'COMPLETED'],
              getValue: (item: ClassSession) => item.status,
            },
            {
              id: 'type', label: 'Format', column: 'type' as const,
              options: ['GROUP', 'SEMI_PRIVATE', 'PRIVATE'],
              getValue: (item: ClassSession) => item.type,
            },
          ]}
          loadingMessage="Loading class sessions..."
          emptyMessage="No class sessions found."
          errorMessage="Failed to load class sessions."
        />
      </section>
    </>
  )
}
