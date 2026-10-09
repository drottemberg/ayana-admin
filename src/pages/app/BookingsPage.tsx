import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { getCustomersListRequest } from '@/features/customers/api'
import { getOrderLocationOptions } from '@/features/orders/api'
import { bookingsQueryKeys } from '@/features/bookings/query-keys'
import { getBookingsRequest } from '@/features/bookings/api'
import { getBookingColumns } from '@/features/bookings/booking-columns'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import type { Booking } from '@/types/booking'
import { CreateManualBookingDrawer } from '@/features/bookings/CreateManualBookingDrawer'

const statuses = ['CONFIRMED', 'WAITLISTED', 'ATTENDED', 'NO_SHOW', 'CANCELLED', 'LATE_CANCELLED']

export default function BookingsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [searchParams] = useSearchParams()
  const { session } = useConnect()
  const isAdminContext = getAppMode() === 'admin'
  const currentCustomerId = session?.currentOrganization?.id
  const columns = useMemo(() => getBookingColumns({ showCustomer: isAdminContext }), [isAdminContext])
  const canCreateBooking = Boolean(session?.permissions.bookings?.create)
  const initialFilters = {
    ...(isAdminContext && searchParams.get('filterCustomerId') ? { customerId: [searchParams.get('filterCustomerId')!] } : {}),
    ...(searchParams.get('filterLocationId') ? { locationId: [searchParams.get('filterLocationId')!] } : {}),
    ...(searchParams.get('userId') ? { userId: [searchParams.get('userId')!] } : {}),
  }

  return <>
    <PageHeader
      title="Bookings"
      subtitle="Class bookings across customers and locations."
      primaryAction={canCreateBooking ? { children: 'Create manual booking', onClick: () => setCreateOpen(true) } : undefined}
    />
    <section className="p-4 md:p-6">
      <DataTableAsync
        queryKey={[...bookingsQueryKeys.all, 'table']}
        loadData={(state: DataTableState<Booking>) => getBookingsRequest(state, !isAdminContext && currentCustomerId ? { customerId: currentCustomerId } : undefined)}
        refetchOnMount="always"
        tableKey="bookings.root"
        initialFilters={Object.keys(initialFilters).length ? initialFilters : undefined}
        columns={columns}
        disabledSelection
        searchPlaceholder="Search by member, class, location or booking ID"
        searchColumns={['id']}
        filters={[
          { id: 'status', label: 'Status', column: 'status' as const, options: statuses, getValue: (booking: Booking) => booking.status },
          ...(isAdminContext ? [{
            id: 'customerId', label: 'Customer', column: 'customer' as const, selectionMode: 'single' as const,
            queryFn: async (search: string) => {
              const customers = await getCustomersListRequest(undefined, search)
              return { items: customers.map((customer) => ({ id: customer.id, label: customer.name })), total: customers.length }
            },
            getValue: (booking: Booking) => booking.customer.id,
          }] : []),
          {
            id: 'locationId', label: 'Location', column: 'location' as const, selectionMode: 'single' as const,
            queryFn: getOrderLocationOptions,
            getValue: (booking: Booking) => booking.location.id,
          },
        ]}
        loadingMessage="Loading bookings..."
        emptyMessage="No bookings found."
        errorMessage="Failed to load bookings."
      />
    </section>
    <CreateManualBookingDrawer open={createOpen} onOpenChange={setCreateOpen} />
  </>
}
