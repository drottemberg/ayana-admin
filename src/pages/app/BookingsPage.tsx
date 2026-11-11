import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { createPageHeaderAction, PageHeader } from '@/components/ui/page-header'
import { getCustomersListRequest } from '@/features/customers/api'
import { getOrderLocationOptions } from '@/features/orders/api'
import { bookingsQueryKeys } from '@/features/bookings/query-keys'
import { getBookingsRequest } from '@/features/bookings/api'
import { getBookingColumns } from '@/features/bookings/booking-columns'
import { BookingCardDayGroup, BookingListCard, bookingCreatedDateKey } from '@/features/bookings/BookingListCard'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import type { Booking } from '@/types/booking'
import { CreateManualBookingDrawer } from '@/features/bookings/CreateManualBookingDrawer'
import { cancelBookingWithChoice, cancelClassPassBookingWithConfirmation, decideEgym2Booking, getBookingRowActions, rebookClientForSession, updateBookingAttendance } from '@/features/bookings/booking-row-actions'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import { useQueryClient } from '@tanstack/react-query'
import { getCoachFilterOptionsRequest } from '@/features/coaches/api'
import { getUserFilterOptionsRequest } from '@/features/users/api'
import { canViewBookingContractDetails } from '@/features/bookings/booking-display-permissions'

const statuses = ['CONFIRMED', 'PENDING_APPROVAL', 'WAITLISTED', 'ATTENDED', 'NO_SHOW', 'CANCELLED', 'LATE_CANCELLED']

export default function BookingsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [searchParams] = useSearchParams()
  const { session } = useConnect()
  const queryClient = useQueryClient()
  const isAdminContext = getAppMode() === 'admin'
  const currentCustomerId = session?.currentOrganization?.id
  const showContractDetails = canViewBookingContractDetails(session?.user, isAdminContext ? 'admin' : 'customer', currentCustomerId)
  const columns = useMemo(() => getBookingColumns({ showCustomer: isAdminContext }), [isAdminContext])
  const canCreateBooking = Boolean(session?.permissions.bookings?.create)
  const canEditBooking = Boolean(session?.permissions.bookings?.edit)
  const invalidateBookingViews = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
  ])
  const initialFilters = {
    ...(isAdminContext && searchParams.get('filterCustomerId') ? { customerId: [searchParams.get('filterCustomerId')!] } : {}),
    ...(searchParams.get('filterLocationId') ? { locationId: [searchParams.get('filterLocationId')!] } : {}),
    ...(searchParams.get('filterCoachId') ? { coachId: [searchParams.get('filterCoachId')!] } : {}),
    ...(searchParams.get('userId') ? { userId: [searchParams.get('userId')!] } : {}),
  }

  return <>
    <PageHeader
      title="Bookings"
      subtitle="Class bookings across customers and locations."
      primaryAction={canCreateBooking ? createPageHeaderAction('Create manual booking', () => setCreateOpen(true)) : undefined}
    />
    <section className="p-4 md:p-6">
      <DataTableAsync
        queryKey={[...bookingsQueryKeys.all, 'table']}
        loadData={(state: DataTableState<Booking>) => getBookingsRequest(state, !isAdminContext && currentCustomerId ? { customerId: currentCustomerId } : undefined)}
        refetchOnMount="always"
        tableKey="bookings.root"
        initialFilters={Object.keys(initialFilters).length ? initialFilters : undefined}
        columns={columns}
        renderCard={(booking, actions, grouped) => <BookingListCard booking={booking} actions={actions} grouped={grouped} showCustomer={isAdminContext} showContractDetails={showContractDetails} />}
        getCardGroupKey={(booking) => bookingCreatedDateKey(booking.createdAt)}
        sortCardGroups={(left, right) => right.localeCompare(left)}
        sortCardGroupItems={(left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()}
        renderCardGroup={(dateKey, items) => <BookingCardDayGroup dateKey={dateKey} count={items.length}>
          {items.map((item) => <div key={item.key}>{item.content}</div>)}
        </BookingCardDayGroup>}
        getRowCommands={(booking) => getBookingRowActions({
          status: booking.status,
          canEdit: canEditBooking,
          canCreate: canCreateBooking,
          isPast: Boolean(booking.startsAt && new Date(booking.startsAt).getTime() < Date.now()),
          source: booking.source,
          onCancel: () => { void cancelBookingWithChoice(booking.id, booking.location.id, invalidateBookingViews) },
          onSetAttendance: (attended) => { void updateBookingAttendance(booking.id, booking.location.id, attended, invalidateBookingViews) },
          onCancelClassPass: () => { void cancelClassPassBookingWithConfirmation(booking.id, booking.location.id, invalidateBookingViews) },
          onEgym2Decision: (action) => { void decideEgym2Booking(booking.id, booking.location.id, action, invalidateBookingViews) },
          onRebook: () => {
            const clientName = [booking.user.firstName, booking.user.lastName].filter(Boolean).join(' ') || booking.user.email || booking.user.id
            void rebookClientForSession({
              customerId: booking.customer.id,
              locationId: booking.location.id,
              sessionId: booking.sessionId,
              userId: booking.userId,
              clientName,
              invalidate: invalidateBookingViews,
            })
          },
        })}
        disabledSelection
        searchPlaceholder="Search by member, class, location or booking ID"
        searchColumns={['id']}
        filters={[
          { id: 'status', label: 'Status', column: 'status' as const, options: statuses, getValue: (booking: Booking) => booking.status },
          {
            id: 'source', label: 'Source', column: 'source' as const, options: ['Direct', 'ClassPass', 'EGYM'],
            getValue: (booking: Booking) => booking.source === 'CLASSPASS' ? 'ClassPass' : booking.source === 'EGYM' ? 'EGYM' : 'Direct',
          },
          {
            id: 'isFreeTrial', label: 'Free trial', column: 'isFreeTrial' as const, options: ['Yes', 'No'],
            getValue: (booking: Booking) => booking.isFreeTrial ? 'Yes' : 'No',
          },
          {
            id: 'userId', label: 'User', column: 'userId' as const, selectionMode: 'single' as const,
            queryFn: getUserFilterOptionsRequest,
            getValue: (booking: Booking) => booking.userId,
          },
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
          ...(session?.user.customerMemberships.find((membership) => membership.customerId === currentCustomerId)?.role === 'INSTRUCTOR'
            ? []
            : [{
                id: 'coachId', label: 'Coach', column: 'coachId' as const,
                selectionMode: 'single' as const,
                queryFn: getCoachFilterOptionsRequest,
                getValue: (booking: Booking) => booking.coachId,
              }]),
        ]}
        loadingMessage="Loading bookings..."
        emptyMessage="No bookings found."
        errorMessage="Failed to load bookings."
      />
    </section>
    <CreateManualBookingDrawer open={createOpen} onOpenChange={setCreateOpen} />
  </>
}
