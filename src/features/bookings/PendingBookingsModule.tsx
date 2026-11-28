import { useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'

import { RelatedEntityModule } from '@/components/app/detail-page-layout'
import { EntityIcon } from '@/components/app/entity-icons'
import type { DataTableState } from '@/components/data-table'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import { getBookingColumns } from './booking-columns'
import { BookingListCard } from './BookingListCard'
import { canViewBookingContractDetails } from './booking-display-permissions'
import { bookingsQueryKeys } from './query-keys'
import { getBookingsRequest } from './api'
import { decideEgym2Booking, getBookingRowActions } from './booking-row-actions'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import type { Booking } from '@/types/booking'

type PendingBookingRow = Booking & Record<string, unknown>

export function PendingBookingsModule({ customerId, locationId }: { customerId: string; locationId?: string }) {
  const { session } = useConnect()
  const queryClient = useQueryClient()
  const canEdit = Boolean(session?.permissions.bookings?.edit)
  const invalidateBookingViews = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
  ])

  return <RelatedEntityModule<PendingBookingRow>
    id="module-pending-bookings"
    title="Pending Bookings"
    icon={EntityIcon.classes}
    columns={getBookingColumns({ showUser: true, showLocation: true }) as ColumnDef<PendingBookingRow>[]}
    renderCard={(booking, actions) => <BookingListCard booking={booking} actions={actions} showContractDetails={canViewBookingContractDetails(session?.user, getAppMode(), customerId)} />}
    queryKey={[...bookingsQueryKeys.all, 'home', 'pending-approval', customerId, locationId]}
    loadData={async (state: DataTableState<PendingBookingRow>) => {
      const result = await getBookingsRequest(state as DataTableState<Booking>, {
        customerId: [customerId],
        status: ['PENDING_APPROVAL'],
        ...(locationId ? { locationId: [locationId] } : {}),
      })
      return { ...result, items: result.items as PendingBookingRow[] }
    }}
    getRowCommands={(booking) => getBookingRowActions({
      status: booking.status,
      canEdit,
      canCreate: false,
      isPast: Boolean(booking.startsAt && new Date(booking.startsAt).getTime() < Date.now()),
      source: booking.source,
      onCancel: () => undefined,
      onRebook: () => undefined,
      onSetAttendance: () => undefined,
      onCancelClassPass: () => undefined,
      onEgym2Decision: (action) => { void decideEgym2Booking(booking.id, booking.location.id, action, invalidateBookingViews) },
    })}
    tableKey="home.pending-bookings"
    emptyMessage="No bookings are waiting for approval."
    loadingMessage="Loading pending bookings…"
    errorMessage="Could not load pending bookings."
    pageSize={5}
    refetchOnMount="always"
  />
}
