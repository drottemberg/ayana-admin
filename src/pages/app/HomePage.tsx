import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  DetailPageLayout,
  RelatedEntityModule,
} from '@/components/app/detail-page-layout'
import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import {
  claimCoachSessionRequest,
  getMyCoachCoverageRequestsRequest,
  getMyCoachSessionsRequest,
  getCoachProfileRequest,
  releaseCoachSessionRequest,
  type CoachCoverageRequest,
} from '@/features/coaches/api'
import { MyCoachProfileDrawer } from '@/features/coaches/MyCoachProfileDrawer'
import { coachesQueryKeys } from '@/features/coaches/query-keys'
import { bookingsQueryKeys } from '@/features/bookings/query-keys'
import { getBookingsRequest } from '@/features/bookings/api'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import { formatClassSessionTime } from '@/features/classes/time-zone'
import { getLocationRequest } from '@/features/locations/api'
import type { Booking } from '@/types/booking'
import type { ClassSession } from '@/types/class-type'
import { UserRequestStatus, UserRequestType, type UserRequest } from '@/types/user-request'
import { getUserRequestsPageRequest } from '@/features/user-requests/api'
import { userRequestsQueryKeys } from '@/features/user-requests/query-keys'
import { UserRequestService } from '@/features/user-requests/user-request-service'
import { CustomerRole } from '@/types/membership'
import { ALL_LOCATIONS_SCOPE, readSelectedLocationScope } from '@/features/organizations/storage'
import { EntityIcon } from '@/components/app/entity-icons'
import { Modals } from '@/providers/modal'
import { formatDateTime } from '@/utils/date-utils'

const MODULE_ANCHOR_PREFIX = 'module'

type HomeInviteRow = UserRequest & Record<string, unknown>
type HomeSessionRow = ClassSession & Record<string, unknown>
type HomeBookingRow = Booking & Record<string, unknown>

function toTableResult<T extends Record<string, unknown>>(rows: T[], state: DataTableState<T>): DataTableAsyncResult<T> {
  const pageSize = state.pagination.pageSize
  const start = state.pagination.pageIndex * pageSize
  return {
    items: rows.slice(start, start + pageSize),
    count: rows.length,
    pageCount: Math.ceil(rows.length / pageSize),
  }
}

function localDayKey(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${values.year}-${values.month}-${values.day}`
}

const inviteColumns: ColumnDef<HomeInviteRow>[] = [
  { accessorKey: 'type', header: 'Type', cell: ({ row }) => UserRequestService.typeToString(row.original.type) },
  { id: 'sender', header: 'From', cell: ({ row }) => row.original.senderName || '-' },
  { id: 'details', header: 'Details', cell: ({ row }) => UserRequestService.getMetadataText(row.original) },
  { accessorKey: 'createdAt', header: 'Received', cell: ({ row }) => formatDateTime(row.original.createdAt, '-') },
]

const sessionColumns: ColumnDef<HomeSessionRow>[] = [
  {
    id: 'class',
    header: 'Class',
    cell: ({ row }) => {
      const session = row.original
      const locationId = session.locationId || session.organizationId
      return (
        <Link
          to={`/class-sessions/${encodeURIComponent(session.id)}?locationId=${encodeURIComponent(locationId)}`}
          className="font-medium underline-offset-2 hover:underline"
        >
          {session.className || session.classTypeId}
        </Link>
      )
    },
  },
  { id: 'starts', header: 'Starts', cell: ({ row }) => formatClassSessionTime(row.original.startTime, row.original.timezone) },
  {
    id: 'capacity',
    header: 'Bookings',
    cell: ({ row }) => `${row.original.bookedCount} / ${row.original.capacity}`,
  },
  { accessorKey: 'locationName', header: 'Location', cell: ({ row }) => row.original.locationName || '-' },
]

const bookingColumns: ColumnDef<HomeBookingRow>[] = [
  {
    id: 'member',
    header: 'Member',
    cell: ({ row }) => {
      const booking = row.original
      const name = [booking.user.firstName, booking.user.lastName].filter(Boolean).join(' ')
      return (
        <Link to={`/users/${encodeURIComponent(booking.user.id)}`} className="underline-offset-2 hover:underline">
          {name || booking.user.email || booking.user.id}
        </Link>
      )
    },
  },
  {
    id: 'class',
    header: 'Class',
    cell: ({ row }) => {
      const booking = row.original
      return (
        <Link to={`/bookings/${encodeURIComponent(booking.id)}`} className="font-medium underline-offset-2 hover:underline">
          {booking.className || booking.sessionId}
        </Link>
      )
    },
  },
  { accessorKey: 'startsAt', header: 'Session', cell: ({ row }) => row.original.startsAt ? formatDateTime(row.original.startsAt) : '-' },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant="outline">{row.original.status.replaceAll('_', ' ')}</Badge> },
]

function scopedListUrl(path: string, customerId: string, locationId: string | null, coachId: string, upcoming = false) {
  const params = new URLSearchParams({ filterCustomerId: customerId, filterCoachId: coachId })
  if (upcoming) params.set('dateMode', 'upcoming')
  if (locationId) params.set('filterLocationId', locationId)
  return `${path}?${params.toString()}`
}

async function loadSessions(state: DataTableState<HomeSessionRow>, filter: (session: ClassSession) => boolean) {
  const sessions = await getMyCoachSessionsRequest()
  return toTableResult(sessions.filter(filter) as HomeSessionRow[], state)
}

export default function HomePage() {
  const { session } = useConnect()
  const queryClient = useQueryClient()
  const [isMyCoachProfileOpen, setIsMyCoachProfileOpen] = useState(false)
  const customerId = session?.currentOrganization?.id ?? null
  const userId = String(session?.user.id ?? '')
  const membership = session?.user.customerMemberships.find((item) => item.customerId === customerId)
  const isCoach = membership?.role === CustomerRole.INSTRUCTOR
  const locationScope = customerId && getAppMode() === 'customer' ? readSelectedLocationScope(customerId) : null
  const locationId = locationScope && locationScope !== ALL_LOCATIONS_SCOPE ? locationScope : null
  const locationQuery = useMemo(() => ({ customerId, locationId }), [customerId, locationId])
  const selectedLocation = useQuery({
    queryKey: ['home', 'location', locationQuery.customerId, locationQuery.locationId],
    queryFn: () => getLocationRequest(locationQuery.locationId!),
    enabled: Boolean(locationQuery.customerId && locationQuery.locationId),
  })
  const pendingInvites = useQuery({
    queryKey: [...userRequestsQueryKeys.all, 'home', getAppMode(), userId, 'received', 'pending-count'],
    queryFn: () => getUserRequestsPageRequest({
      pagination: { pageIndex: 0, pageSize: 1 },
      sorting: [],
      search: '',
      filters: {},
    } as DataTableState<HomeInviteRow>, 'RECEIVED', {
      status: [UserRequestStatus.PENDING],
      type: [UserRequestType.ORG_INVITE],
    }),
    enabled: Boolean(session?.user.id),
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const hasPendingInvites = pendingInvites.isSuccess
    && !pendingInvites.isFetching
    && (pendingInvites.data.count > 0)

  const canViewSessions = Boolean(isCoach && session?.permissions.classSessions?.view)
  const canViewBookings = Boolean(isCoach && session?.permissions.bookings?.view)
  const showCoachModules = Boolean(customerId && userId && isCoach)
  const myCoachProfile = useQuery({
    queryKey: [...coachesQueryKeys.all, 'profile', customerId, userId],
    queryFn: () => getCoachProfileRequest(customerId!, userId),
    enabled: showCoachModules,
  })
  const todayKey = locationId && selectedLocation.data?.timezone
    ? localDayKey(new Date(), selectedLocation.data.timezone)
    : localDayKey(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')

  const modules = useMemo(() => [
    ...(hasPendingInvites ? [{ key: 'received-invites', label: 'Received invites' }] : []),
    ...(canViewSessions ? [
      { key: 'day-planning', label: 'Day planning' },
      { key: 'upcoming-sessions', label: 'Upcoming sessions' },
      { key: 'sessions-to-claim', label: 'Sessions to claim' },
    ] : []),
    ...(canViewBookings ? [{ key: 'last-bookings', label: 'Last bookings' }] : []),
  ], [canViewBookings, canViewSessions, hasPendingInvites])

  const sessionListUrl = customerId ? scopedListUrl('/class-sessions', customerId, locationId, userId, true) : '/class-sessions'
  const bookingListUrl = customerId ? scopedListUrl('/bookings', customerId, locationId, userId) : '/bookings'

  return (
    <DetailPageLayout
      header={{
        title: 'Home',
        subtitle: 'Your studio activity.',
        primaryAction: showCoachModules && myCoachProfile.data
          ? { children: 'Edit my coach profile', onClick: () => setIsMyCoachProfileOpen(true) }
          : undefined,
      }}
      modules={modules}
      aside={null}
    >
      {session && hasPendingInvites ? (
        <RelatedEntityModule<HomeInviteRow>
          id={`${MODULE_ANCHOR_PREFIX}-received-invites`}
          title="Received invites"
          icon={EntityIcon.users}
          columns={inviteColumns}
          queryKey={[...userRequestsQueryKeys.all, 'home', getAppMode(), userId, 'received', 'pending']}
          loadData={async (state) => {
            const result = await getUserRequestsPageRequest(state, 'RECEIVED', {
              status: [UserRequestStatus.PENDING],
              type: [UserRequestType.ORG_INVITE],
            })
            return { ...result, items: result.items as HomeInviteRow[] }
          }}
          tableKey="home.received-invites"
          getRowCommands={(request) => UserRequestService.getActions(request)}
          emptyMessage="No active invitations."
          loadingMessage="Loading invitations…"
          errorMessage="Could not load invitations."
          pageSize={5}
          refetchOnMount="always"
        />
      ) : null}

      {showCoachModules && canViewSessions ? (
        <RelatedEntityModule<HomeSessionRow>
          id={`${MODULE_ANCHOR_PREFIX}-day-planning`}
          title="Day planning"
          icon={EntityIcon.classes}
          columns={sessionColumns}
          queryKey={[...classSessionsQueryKeys.all, 'home', 'day', customerId, locationId, userId, todayKey]}
          loadData={(state) => loadSessions(state, (item) =>
            item.status === 'SCHEDULED'
              && localDayKey(new Date(item.startTime), item.timezone || 'UTC') === localDayKey(new Date(), item.timezone || 'UTC'),
          )}
          tableKey="home.coach-day-planning"
          emptyMessage="No sessions scheduled for today."
          loadingMessage="Loading today's sessions…"
          errorMessage="Could not load today's sessions."
          pageSize={5}
          refetchOnMount="always"
        />
      ) : null}

      {showCoachModules && canViewSessions ? (
        <RelatedEntityModule<HomeSessionRow>
          id={`${MODULE_ANCHOR_PREFIX}-upcoming-sessions`}
          title="Upcoming sessions"
          icon={EntityIcon.classes}
          columns={sessionColumns}
          queryKey={[...classSessionsQueryKeys.all, 'home', 'upcoming', customerId, locationId, userId]}
          viewAllTo={sessionListUrl}
          viewAllMinCount={0}
          loadData={(state) => {
            const now = Date.now()
            return loadSessions(state, (item) => item.status === 'SCHEDULED' && new Date(item.startTime).getTime() >= now)
          }}
          tableKey="home.coach-upcoming-sessions"
          getRowCommands={(item) => [{
            label: 'Request cover',
            onClick: async () => {
              const confirmed = await Modals.confirm({ operation: 'request cover for this session' })
              if (!confirmed) return
              try {
                await releaseCoachSessionRequest(item.id)
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
                  queryClient.invalidateQueries({ queryKey: ['coaches'] }),
                ])
                toast.success('Other qualified coaches have been notified to claim this session.')
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Could not request a cover.')
              }
            },
          }]}
          emptyMessage="No upcoming sessions assigned to you."
          loadingMessage="Loading upcoming sessions…"
          errorMessage="Could not load upcoming sessions."
          pageSize={5}
          refetchOnMount="always"
        />
      ) : null}

      {showCoachModules && canViewSessions ? (
        <RelatedEntityModule<HomeSessionRow>
          id={`${MODULE_ANCHOR_PREFIX}-sessions-to-claim`}
          title="Sessions to claim"
          icon={EntityIcon.classes}
          columns={sessionColumns}
          queryKey={['coaches', 'home', 'claimable-sessions', customerId, locationId, userId]}
          loadData={async (state: DataTableState<HomeSessionRow>) => {
            const offers = await getMyCoachCoverageRequestsRequest()
            const sessions = offers
              .filter((offer) => offer.kind === 'COVER_REQUEST' || offer.kind === 'UNASSIGNED')
              .map((offer: CoachCoverageRequest) => offer.session)
              .filter((item) => item.status === 'SCHEDULED' && new Date(item.startTime).getTime() >= Date.now())
            return toTableResult(sessions as HomeSessionRow[], state)
          }}
          tableKey="home.coach-claimable-sessions"
          getRowCommands={(item) => [{
            label: 'Claim session',
            onClick: async () => {
              try {
                await claimCoachSessionRequest(item.id)
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
                  queryClient.invalidateQueries({ queryKey: ['coaches'] }),
                ])
                toast.success('Session assigned to you.')
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Could not claim this session.')
              }
            },
          }]}
          emptyMessage="No sessions are currently available to claim."
          loadingMessage="Loading sessions to claim…"
          errorMessage="Could not load sessions to claim."
          pageSize={5}
          refetchOnMount="always"
        />
      ) : null}

      {showCoachModules && canViewBookings ? (
        <RelatedEntityModule<HomeBookingRow>
          id={`${MODULE_ANCHOR_PREFIX}-last-bookings`}
          title="Last bookings"
          icon={EntityIcon.classes}
          columns={bookingColumns}
          queryKey={[...bookingsQueryKeys.all, 'home', 'coach', customerId, locationId, userId]}
          viewAllTo={bookingListUrl}
          viewAllMinCount={0}
          loadData={async (state: DataTableState<HomeBookingRow>) => {
            const filters = {
              ...(customerId ? { customerId: [customerId] } : {}),
              ...(locationId ? { locationId: [locationId] } : {}),
              coachId: [userId],
            }
            const result = await getBookingsRequest(state as DataTableState<Booking>, filters)
            return { ...result, items: result.items as HomeBookingRow[] }
          }}
          tableKey="home.coach-last-bookings"
          emptyMessage="No bookings for your assigned sessions."
          loadingMessage="Loading recent bookings…"
          errorMessage="Could not load recent bookings."
          pageSize={5}
          refetchOnMount="always"
        />
      ) : null}
      {showCoachModules && myCoachProfile.data ? <MyCoachProfileDrawer
        customerId={customerId!}
        profile={myCoachProfile.data}
        open={isMyCoachProfileOpen}
        onOpenChange={setIsMyCoachProfileOpen}
      /> : null}
    </DetailPageLayout>
  )
}
