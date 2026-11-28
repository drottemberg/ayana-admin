import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'

import {
  DetailPageLayout,
  DetailSidePanel,
  RelatedEntityModule,
  type DetailPanelSection,
} from '@/components/app/detail-page-layout'
import { type DataTableAsyncResult, type DataTableState } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import { getCustomersRequest } from '@/features/customers/api'
import { customerColumns } from '@/features/customers/customer-columns'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { OrganizationService } from '@/features/organizations/organization-service'
import { getAllLocationsForCustomerRequest, getLocationRequest } from '@/features/locations/api'
import { locationColumns } from '@/features/locations/location-columns'
import { locationsQueryKeys } from '@/features/locations/query-keys'
import { getUserMarketingPreferencesRequest, getUserRequest, type UserMarketingPreference } from '@/features/users/api'
import { UserStatusBadge } from '@/features/users/UserStatusBadge'
import { usersQueryKeys } from '@/features/users/query-keys'
import { UserService } from '@/features/users/user-service'
import { MergeUserDrawer } from '@/features/users/components/MergeUserDrawer'
import { canViewBookingContractDetails } from '@/features/bookings/booking-display-permissions'
import { Drawer, DrawerId } from '@/providers/drawer'
import { LocationScope } from '@/types/membership'
import type { Location } from '@/types/location'
import type { User } from '@/types/user'
import { NO_VALUE_STR } from '@/constants'
import { useDetailQuery } from '@/lib/query-hooks'
import { formatDateTime } from '@/utils/date-utils'
import { formatPhoneNumber } from '@/lib/phone'
import { getClientContractsRequest, getUserCreditMovementsRequest, getUserCreditWalletBalancesRequest } from '@/features/client-contracts/api'
import { getClientContractColumns } from '@/features/client-contracts/client-contract-columns'
import { getCreditMovementColumns } from '@/features/client-contracts/credit-movement-columns'
import { getCreditMovementRowActions } from '@/features/client-contracts/credit-movement-service'
import { ClientContractService } from '@/features/client-contracts/client-contract-service'
import { clientContractsQueryKeys } from '@/features/client-contracts/query-keys'
import type { ClientContract, ClientContractCreditMovement } from '@/types/client-contract'
import { getOrdersRequest } from '@/features/orders/api'
import { getOrderColumns } from '@/features/orders/order-columns'
import { OrderService } from '@/features/orders/order-service'
import { ordersQueryKeys } from '@/features/orders/query-keys'
import type { Order } from '@/types/order'
import { getBookingsRequest } from '@/features/bookings/api'
import { getBookingColumns } from '@/features/bookings/booking-columns'
import { BookingListCard } from '@/features/bookings/BookingListCard'
import { bookingsQueryKeys } from '@/features/bookings/query-keys'
import type { Booking } from '@/types/booking'
import { acceptWaitlistedBooking, cancelBookingWithChoice, cancelClassPassBookingWithConfirmation, decideEgym2Booking, getBookingRowActions, rebookClientForSession, updateBookingAttendance } from '@/features/bookings/booking-row-actions'
import { EntityIcon } from '@/components/app/entity-icons'
import { getClassSchedulesRequest, getClassSessionsRequest } from '@/features/classes/api'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import { ClassSessionListCard, getClassSessionColumns } from '@/features/classes/class-session-columns'
import type { ClassSchedule, ClassSession } from '@/types/class-type'
import { GiftCreditsDrawer, GrantCreditsDrawer, RemoveCreditsDrawer } from '@/features/client-contracts/CreditManagementDrawers'
import { getAiSupportIssuesRequest, updateAiSupportIssueRequest } from '@/features/ai-support-issues/api'
import { aiSupportIssueQueryKeys } from '@/features/ai-support-issues/query-keys'
import type { AiSupportIssue } from '@/features/ai-support-issues/types'
import { activateAccessTokenRequest, deactivateAccessTokenRequest, getAccessScansRequest, getAccessTokensRequest, type AccessScan, type AccessToken } from '@/features/devices/access-api'
import { AccessTokenDrawer } from '@/features/devices/AccessTokenDrawer'
import { AccessTokenQrDialog } from '@/features/devices/AccessTokenQrDialog'

const MODULE_ANCHOR_PREFIX = 'module'

const aiSupportIssueColumns: ColumnDef<AiSupportIssue>[] = [
  { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant="outline">{row.original.status.replaceAll('_', ' ')}</Badge> },
  {
    accessorKey: 'summary',
    header: 'Summary',
    cell: ({ row }) => <Link className="block max-w-72 whitespace-normal break-words underline-offset-2 hover:underline" to={`/agent-support-issues?issueId=${encodeURIComponent(row.original.id)}`}>{row.original.summary}</Link>,
  },
]

const accessTokenColumns: ColumnDef<AccessToken>[] = [
  { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  { accessorKey: 'organizationName', header: 'Customer / locations', cell: ({ row }) => <span>{row.original.organizationName || '—'} · {row.original.locationScope === 'ALL' ? 'All locations' : row.original.locationScope === 'SPECIFIC' ? row.original.locationNames?.join(', ') || `${row.original.locationIds?.length ?? 0} selected` : 'Location'}</span> },
  { accessorKey: 'purpose', header: 'Purpose', cell: ({ row }) => `${row.original.purpose} · ${row.original.isDynamic ? 'Dynamic QR' : 'Static code'}` },
  { accessorKey: 'label', header: 'Label', cell: ({ row }) => row.original.label || '—' },
  { accessorKey: 'usedCount', header: 'Uses', cell: ({ row }) => `${row.original.usedCount} / ${row.original.maxUses ?? '∞'}` },
  { accessorKey: 'expiresAt', header: 'Expires', cell: ({ row }) => row.original.expiresAt ? formatDateTime(row.original.expiresAt) : 'Never' },
  { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <Badge variant={row.original.isActive ? 'default' : 'secondary'}>{row.original.isActive ? 'Active' : 'Disabled'}</Badge> },
]

const userAccessScanColumns: ColumnDef<AccessScan>[] = [
  { accessorKey: 'createdAt', header: 'Scanned', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  { accessorKey: 'allowed', header: 'Result', cell: ({ row }) => <Badge variant={row.original.allowed ? 'default' : 'destructive'}>{row.original.allowed ? 'Allowed' : 'Denied'}</Badge> },
  { accessorKey: 'deviceId', header: 'Device', cell: ({ row }) => row.original.deviceName || row.original.deviceId },
  { accessorKey: 'organizationName', header: 'Location', cell: ({ row }) => row.original.organizationName || '—' },
  { accessorKey: 'reason', header: 'Reason' },
]

function makeViewAllTo(path: string, userId: string) {
  const params = new URLSearchParams({ userId })

  return `${path}?${params.toString()}`
}

function getUserCustomersCount(user?: User) {
  return user?.customerMemberships?.length ?? user?.memberOrganizations?.length ?? 0
}

function preferenceLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (character) => character.toLocaleUpperCase())
}

function preferenceValue(value: unknown): string {
  if (value == null || value === '') return NO_VALUE_STR
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(preferenceValue).join(', ') || NO_VALUE_STR
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

async function getUserLocations(user: User): Promise<Location[]> {
  const memberships = user.customerMemberships ?? []
  const locationSets = await Promise.all(
    memberships.map(async (membership) => {
      const scope = membership.locationScope ?? membership.storeScope
      if (scope === LocationScope.NONE) return []
      if (scope === LocationScope.SPECIFIC) {
        return Promise.all((membership.locations ?? []).map((location) => getLocationRequest(location.locationId)))
      }

      return getAllLocationsForCustomerRequest(membership.customerId)
    }),
  )

  return [...new Map(locationSets.flat().map((location) => [location.id, location])).values()]
}

async function loadUserLocations(
  user: User | undefined,
  tableState: DataTableState<Location>,
): Promise<DataTableAsyncResult<Location>> {
  const locations = user ? await getUserLocations(user) : []
  const search = tableState.search.trim().toLocaleLowerCase()
  const filtered = locations
    .filter((location) =>
      [location.name, location.email, location.phone].some((value) => value?.toLocaleLowerCase().includes(search)),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
  const { pageIndex, pageSize } = tableState.pagination
  const start = pageIndex * pageSize

  return {
    items: filtered.slice(start, start + pageSize),
    count: filtered.length,
    pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)),
  }
}

type UserCoachSchedule = ClassSchedule & { locationId: string; locationName: string }

async function getCoachScheduleLocations(
  user: User,
  isAdminContext: boolean,
  currentCustomerId: string | undefined,
  allowedLocationIds: string[] | null,
): Promise<Location[]> {
  const memberships = (user.customerMemberships ?? []).filter((membership) =>
    membership.role === 'INSTRUCTOR' && (isAdminContext || membership.customerId === currentCustomerId),
  )
  const locations = (await Promise.all(memberships.map(async (membership) => {
    const scope = membership.locationScope ?? membership.storeScope
    if (scope === LocationScope.NONE) return []
    if (scope === LocationScope.SPECIFIC) {
      return Promise.all((membership.locations ?? []).map((location) => getLocationRequest(location.locationId)))
    }
    return getAllLocationsForCustomerRequest(membership.customerId)
  }))).flat()
  const uniqueLocations = [...new Map(locations.map((location) => [location.id, location])).values()]
  return allowedLocationIds === null ? uniqueLocations : uniqueLocations.filter((location) => allowedLocationIds.includes(location.id))
}

async function loadUserCoachSchedules(
  user: User | undefined,
  state: DataTableState<UserCoachSchedule>,
  isAdminContext: boolean,
  currentCustomerId: string | undefined,
  allowedLocationIds: string[] | null,
): Promise<DataTableAsyncResult<UserCoachSchedule>> {
  if (!user) return { items: [], count: 0, pageCount: 1 }
  const locations = await getCoachScheduleLocations(user, isAdminContext, currentCustomerId, allowedLocationIds)
  const byLocation = await Promise.all(locations.map(async (location) => ({
    location,
    schedules: await getClassSchedulesRequest(location.id),
  })))
  const schedules = byLocation.flatMap(({ location, schedules }) => schedules
    .filter((schedule) => schedule.coachId === String(user.id))
    .map((schedule) => ({ ...schedule, locationId: location.id, locationName: location.name })))
  const search = state.search.trim().toLocaleLowerCase()
  const filtered = schedules.filter((schedule) => [
    schedule.locationName,
    schedule.dayOfWeek,
    schedule.coachName,
    schedule.classTypeId,
    `${String(schedule.startHour).padStart(2, '0')}:${String(schedule.startMinute).padStart(2, '0')}`,
  ].some((value) => value?.toLocaleLowerCase().includes(search)))
  const sort = state.sorting[0]
  if (sort) filtered.sort((a, b) => String(a[sort.id as keyof UserCoachSchedule] ?? '').localeCompare(String(b[sort.id as keyof UserCoachSchedule] ?? '') ) * (sort.desc ? -1 : 1))
  const start = state.pagination.pageIndex * state.pagination.pageSize
  return {
    items: filtered.slice(start, start + state.pagination.pageSize),
    count: filtered.length,
    pageCount: Math.max(1, Math.ceil(filtered.length / state.pagination.pageSize)),
  }
}

const userCoachScheduleColumns: ColumnDef<UserCoachSchedule>[] = [
  {
    id: 'classType',
    header: 'Class',
    cell: ({ row }) => <Link to={`/classes/${encodeURIComponent(row.original.classTypeId)}?locationId=${encodeURIComponent(row.original.locationId)}`} className="font-medium underline-offset-2 hover:underline">{row.original.classTypeId}</Link>,
  },
  { accessorKey: 'locationName', header: 'Location' },
  { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <Badge variant="outline">{row.original.isActive ? 'Active' : 'Disabled'}</Badge> },
  { accessorKey: 'dayOfWeek', header: 'Day', cell: ({ row }) => row.original.dayOfWeek ?? NO_VALUE_STR },
  { id: 'time', header: 'Time', cell: ({ row }) => `${String(row.original.startHour).padStart(2, '0')}:${String(row.original.startMinute).padStart(2, '0')}` },
  { accessorKey: 'coachName', header: 'Default coach', cell: ({ row }) => row.original.coachName || NO_VALUE_STR },
  { accessorKey: 'capacity', header: 'Capacity', cell: ({ row }) => row.original.capacity ?? NO_VALUE_STR },
  { accessorKey: 'validFrom', header: 'Valid from', cell: ({ row }) => new Date(row.original.validFrom).toLocaleDateString() },
  { accessorKey: 'validUntil', header: 'Until', cell: ({ row }) => row.original.validUntil ? new Date(row.original.validUntil).toLocaleDateString() : 'No end date' },
]

function getUserDetailSections(
  user: User | undefined,
  creditWallets?: { customerId: string; customerName: string; balance: number; unlimited: boolean }[],
  creditWalletsLoading = false,
  canViewCreditWallets = false,
  marketingPreferences?: UserMarketingPreference[],
  marketingPreferencesLoading = false,
  marketingPreferencesError = false,
): DetailPanelSection[] {
  return [
    {
      title: 'Details',
      actions: user ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit user details"
          onClick={() => Drawer.show(DrawerId.CreateUser, { mode: 'edit-details', user })}
        >
          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
        </Button>
      ) : null,
      fields: [
        { label: 'Status', value: user ? <UserStatusBadge status={UserService.getUserStatus(user)} /> : NO_VALUE_STR },
        { label: 'ID', value: user?.id ?? NO_VALUE_STR },
        { label: 'First name', value: user?.firstName ?? NO_VALUE_STR },
        { label: 'Last name', value: user?.lastName ?? NO_VALUE_STR },
        { label: 'Email', value: user?.email ?? NO_VALUE_STR },
        { label: 'Email verified', value: user?.email ? (user.emailVerifiedAt ? 'Yes' : 'No') : 'No email' },
        { label: 'Email invalid', value: user?.email ? (user.invalidEmail ? 'Yes' : 'No') : 'No email' },
        ...(user?.invalidAt ? [{ label: 'Email invalid since', value: formatDateTime(user.invalidAt, NO_VALUE_STR) }] : []),
        { label: 'Phone number', value: formatPhoneNumber(user?.phone) || NO_VALUE_STR },
        {
          label: 'Created at',
          value: user?.createdAt ? formatDateTime(user.createdAt, NO_VALUE_STR) : NO_VALUE_STR,
        },
      ],
    },
    ...(canViewCreditWallets ? [{
      title: 'Credits',
      fields: creditWalletsLoading
        ? [{ label: 'Balance', value: 'Loading…' }]
        : creditWallets?.length
          ? creditWallets.map((wallet) => ({
              label: wallet.customerName,
              value: wallet.unlimited ? `${wallet.balance} · Unlimited access` : `${wallet.balance} credits`,
            }))
          : [{ label: 'Balance', value: '0 credits' }],
    }] : []),
    {
      title: 'Preferences',
      fields: [
        { label: 'Newsletter opt-in', value: user ? (user.newsletterEnabled ? 'Yes' : 'No') : NO_VALUE_STR },
        ...(marketingPreferencesLoading ? [{ label: 'Explicit campaign opt-out', value: 'Loading…' }] :
          marketingPreferencesError ? [{ label: 'Explicit campaign opt-out', value: 'Could not load' }] :
          marketingPreferences?.length ? marketingPreferences.map((preference) => ({
            label: `Explicit campaign opt-out · ${preference.customerName}`,
            value: preference.customerOptedOut
              ? `Yes${preference.optedOutAt ? ` · since ${formatDateTime(preference.optedOutAt, NO_VALUE_STR)}` : ' · date unavailable'}`
              : 'No',
          })) : [{ label: 'Explicit campaign opt-out', value: NO_VALUE_STR }]),
        { label: 'Push notifications', value: user ? (user.pushNotificationsEnabled ? 'Enabled' : 'Disabled') : NO_VALUE_STR },
        { label: 'Email notifications', value: user ? (user.emailNotificationsEnabled ? 'Enabled' : 'Disabled') : NO_VALUE_STR },
        ...(user?.preferences ? Object.entries(user.preferences).map(([key, value]) => ({ label: preferenceLabel(key), value: preferenceValue(value) })) : []),
      ],
    },
  ]
}

export default function UserPage() {
  const { userId = '' } = useParams()
  const { session } = useConnect()
  const queryClient = useQueryClient()
  const permissions = session?.permissions.users
  const canViewContracts = Boolean(session?.permissions.clientContracts?.view)
  const canManageCredits = Boolean(session?.permissions.clientContracts?.edit)
  const canViewCreditWallets = canViewContracts
  const canViewBookings = Boolean(session?.permissions.bookings?.view)
  const canCreateBookings = Boolean(session?.permissions.bookings?.create)
  const canEditBookings = Boolean(session?.permissions.bookings?.edit)
  const canViewOrders = Boolean(session?.permissions.orders?.view)
  const canViewAccess = Boolean(session?.permissions.devices?.view)
  const canCreateAccess = Boolean(session?.permissions.devices?.create)
  const canEditAccess = Boolean(session?.permissions.devices?.edit)
  const [contractsToGrant, setContractsToGrant] = useState<ClientContract[]>([])
  const [grantCreditsOpen, setGrantCreditsOpen] = useState(false)
  const [walletAdjustmentOpen, setWalletAdjustmentOpen] = useState(false)
  const [accessDrawerOpen, setAccessDrawerOpen] = useState(false)
  const [editingAccess, setEditingAccess] = useState<AccessToken | null>(null)
  const [qrAccess, setQrAccess] = useState<AccessToken | null>(null)
  const [keptUser, setKeptUser] = useState<User | null>(null)
  const [contractToRemoveCredits, setContractToRemoveCredits] = useState<ClientContract | null>(null)
  const currentCustomerId = session?.currentOrganization?.id
  const currentCustomerName = session?.currentOrganization?.name
  const isAdminContext = getAppMode() === 'admin'
  const canViewAiSupportIssues = Boolean(session?.permissions.aiSupportIssues?.view)
  const invalidateBookingViews = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
  ])
  const setAiSupportIssueStatus = async (issue: AiSupportIssue, status: 'RESOLVED' | 'DISMISSED') => {
    try {
      await updateAiSupportIssueRequest(issue.id, { status })
      await queryClient.invalidateQueries({ queryKey: aiSupportIssueQueryKeys.all })
      toast.success(status === 'RESOLVED' ? 'Issue resolved.' : 'Issue dismissed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the issue.')
    }
  }
  const disableAccess = async (access: AccessToken) => {
    try {
      await deactivateAccessTokenRequest(access.id, access.organizationId)
      await queryClient.invalidateQueries({ queryKey: ['access-tokens', userId] })
      toast.success('Access disabled.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not disable access.') }
  }
  const enableAccess = async (access: AccessToken) => {
    try {
      await activateAccessTokenRequest(access.id, access.organizationId)
      await queryClient.invalidateQueries({ queryKey: ['access-tokens', userId] })
      toast.success('Access enabled.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not enable access.') }
  }
  const {
    data: user,
    isError,
    isLoading,
  } = useDetailQuery({
    queryKey: usersQueryKeys.detail(userId),
    queryFn: () => getUserRequest(userId),
    enabled: Boolean(userId),
  })
  const marketingPreferences = useQuery({
    queryKey: [...usersQueryKeys.detail(userId), 'marketing-preferences'],
    queryFn: () => getUserMarketingPreferencesRequest(userId),
    enabled: Boolean(userId && permissions?.view),
  })
  const isPartnerCoach = Boolean(user?.customerMemberships?.some((membership) => membership.role === 'INSTRUCTOR'))
  const canViewCoachSchedules = Boolean(isPartnerCoach && session?.permissions.classSchedules?.view)
  const canViewCoachSessions = Boolean(isPartnerCoach && session?.permissions.classSessions?.view)
  const actorCustomerMembership = currentCustomerId
    ? session?.user.customerMemberships.find((membership) => membership.customerId === currentCustomerId)
    : undefined
  const canMerge = !isAdminContext && Boolean(permissions?.edit) &&
    ['MANAGER', 'ADMIN', 'OWNER'].includes(actorCustomerMembership?.role ?? '') &&
    Boolean(user && !user.isDeleted && !user.isStaff)
  const actorLocationScope = actorCustomerMembership?.locationScope ?? actorCustomerMembership?.storeScope
  const allowedScheduleLocationIds = isAdminContext
    ? null
    : actorLocationScope === LocationScope.SPECIFIC
      ? (actorCustomerMembership?.locations ?? []).map((location) => location.locationId)
      : actorCustomerMembership?.stores?.length
        ? actorCustomerMembership.stores.map((store) => store.storeId)
        : actorLocationScope === LocationScope.NONE || !actorCustomerMembership
          ? []
          : null
  const creditWallets = useQuery({
    queryKey: [...clientContractsQueryKeys.all, 'wallet-balances', userId],
    queryFn: () => getUserCreditWalletBalancesRequest(userId),
    enabled: Boolean(userId && canViewCreditWallets),
  })
  const locationMembershipKey = (user?.customerMemberships ?? [])
    .map((membership) =>
      [membership.customerId, membership.locationScope ?? membership.storeScope, ...(membership.locations ?? []).map((location) => location.locationId)].join(':'),
    )
    .sort()
    .join('|')
  const hasCustomerMembership = (user?.customerMemberships?.length ?? 0) > 0
  const modules = [
    ...(canViewBookings ? [{ key: 'bookings', label: 'Bookings' }] : []),
    ...(isAdminContext ? [{ key: 'customers', label: 'Customers' }] : []),
    ...(hasCustomerMembership ? [{ key: 'locations', label: 'Locations' }] : []),
    ...(canViewCoachSchedules ? [{ key: 'schedules', label: 'Schedules' }] : []),
    ...(canViewCoachSessions ? [{ key: 'class-sessions', label: 'Class sessions' }] : []),
    ...(canViewContracts || canViewCreditWallets || canViewBookings || canViewOrders
      ? [
          ...(canViewContracts ? [{ key: 'client-contracts', label: 'Client contracts' }] : []),
          ...(canViewCreditWallets ? [{ key: 'credit-transactions', label: 'Credit transactions' }] : []),
          ...(canViewOrders ? [{ key: 'orders', label: 'Orders' }] : []),
        ]
      : []),
    ...(canViewAiSupportIssues ? [{ key: 'ai-support-issues', label: 'AI support issues' }] : []),
    ...(canViewAccess ? [{ key: 'access-tokens', label: 'Access' }, { key: 'access-scans', label: 'Access scans' }] : []),
  ]

  if (isError && !user) {
    return (
      <>
        <PageHeader title="User not found" subtitle={userId} backTo="/users" />
        <section className="p-4 md:p-6">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Failed to load this user.
          </div>
        </section>
      </>
    )
  }

  return (
    <DetailPageLayout
      header={{
        title: user ? `${user.firstName} ${user.lastName}` : 'User',
        subtitle: user ? UserService.roleToString(user.role) : userId,
        backTo: '/users',
        options: user ? [
          ...(UserService.getDetailHeaderActions(user, permissions).options ?? []),
          ...(canMerge ? [{ label: 'Merge with…', onClick: () => setKeptUser(user) }] : []),
        ] : [],
      }}
      modules={modules}
      aside={<DetailSidePanel sections={getUserDetailSections(user, creditWallets.data?.items, creditWallets.isLoading, canViewCreditWallets,
        marketingPreferences.data?.items, marketingPreferences.isLoading, marketingPreferences.isError)} isLoading={isLoading} />}
    >
      {canViewBookings ? <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-bookings`}
        title="Bookings"
        icon={EntityIcon.classes}
        viewAllTo={makeViewAllTo('/bookings', userId)}
        queryKey={bookingsQueryKeys.user(userId)}
        loadData={(state: DataTableState<Booking>) => getBookingsRequest({
          ...state,
          sorting: [{ id: 'startsAt', desc: true }],
        }, {
          userId,
          ...(!isAdminContext && currentCustomerId ? { customerId: currentCustomerId } : {}),
        })}
        tableKey={`bookings.user.${userId}`}
        columns={getBookingColumns({ showUser: false, showCustomer: isAdminContext })}
        renderCard={(booking, actions) => <BookingListCard booking={booking} actions={actions} showUser={false} showCustomer={isAdminContext} showSessionDateAside showContractDetails={canViewBookingContractDetails(session?.user, isAdminContext ? 'admin' : 'customer', currentCustomerId)} />}
        getRowCommands={(booking) => getBookingRowActions({
          status: booking.status,
          canEdit: canEditBookings,
          canCreate: canCreateBookings,
          isPast: Boolean(booking.startsAt && new Date(booking.startsAt).getTime() < Date.now()),
          source: booking.source,
          onCancel: () => { void cancelBookingWithChoice(booking.id, booking.location.id, invalidateBookingViews) },
          onAcceptWaitlist: () => { void acceptWaitlistedBooking(booking.id, booking.location.id, invalidateBookingViews) },
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
        loadingMessage="Loading bookings..."
        emptyMessage="No bookings found."
        errorMessage="Failed to load bookings."
      /> : null}
      {isAdminContext ? <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-customers`}
        title="Customers"
        initialTotal={getUserCustomersCount(user)}
        viewAllTo={makeViewAllTo('/customers', userId)}
        queryKey={[...customersQueryKeys.all, 'user', userId, 'module']}
        loadData={(tableState) => getCustomersRequest(tableState, { userId })}
        tableKey={`customers.user.${userId}`}
        columns={customerColumns}
        getRowCommands={(customer) =>
          OrganizationService.getActions({
            kind: 'customer',
            organization: customer,
          })
        }
        loadingMessage="Loading customers..."
        emptyMessage="No customers assigned"
        errorMessage="Failed to load customers."
      /> : null}
      {hasCustomerMembership ? <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-locations`}
        title="Locations"
        viewAllTo="/locations"
        queryKey={[...locationsQueryKeys.user(userId), 'module', locationMembershipKey]}
        loadData={(tableState: DataTableState<Location>) => loadUserLocations(user, tableState)}
        tableKey={`locations.user.${userId}`}
        columns={locationColumns}
        loadingMessage="Loading locations..."
        emptyMessage="No locations assigned"
        errorMessage="Failed to load locations."
      /> : null}
      {canViewCoachSchedules ? <RelatedEntityModule<UserCoachSchedule>
        id={`${MODULE_ANCHOR_PREFIX}-schedules`}
        title="Schedules"
        icon={EntityIcon.classes}
        queryKey={['class-schedules', 'user', userId, locationMembershipKey, currentCustomerId, isAdminContext]}
        loadData={(state: DataTableState<UserCoachSchedule>) => loadUserCoachSchedules(
          user,
          state,
          isAdminContext,
          currentCustomerId,
          allowedScheduleLocationIds,
        )}
        tableKey={`schedules.user.${userId}`}
        columns={userCoachScheduleColumns}
        loadingMessage="Loading schedules..."
        emptyMessage="No schedules assigned to this coach."
        errorMessage="Failed to load schedules."
      /> : null}
      {canViewCoachSessions ? <RelatedEntityModule<ClassSession>
        id={`${MODULE_ANCHOR_PREFIX}-class-sessions`}
        title="Class sessions"
        icon={EntityIcon.classes}
        viewAllTo={`/class-sessions?${new URLSearchParams({
          filterCoachId: userId,
          ...(!isAdminContext && currentCustomerId ? { filterCustomerId: currentCustomerId } : {}),
        }).toString()}`}
        queryKey={['class-sessions', 'user', userId, currentCustomerId, isAdminContext]}
        loadData={(state: DataTableState<ClassSession>) => getClassSessionsRequest(state, {
          coachId: [userId],
          ...(!isAdminContext && currentCustomerId ? { customerId: currentCustomerId } : {}),
        })}
        tableKey={`class-sessions.user.${userId}`}
        columns={getClassSessionColumns({ showCustomer: isAdminContext, showLocation: true })}
        renderCard={(item, actions) => <ClassSessionListCard session={item} actions={actions} />}
        loadingMessage="Loading class sessions..."
        emptyMessage="No class sessions assigned to this coach."
        errorMessage="Failed to load class sessions."
      /> : null}
      {canViewContracts ? <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-client-contracts`}
        title="Client contracts"
        icon={EntityIcon.clientContracts}
        viewAllTo={makeViewAllTo('/client-contracts', userId)}
        queryKey={clientContractsQueryKeys.user(userId)}
        loadData={(state: DataTableState<ClientContract>) => getClientContractsRequest(state, { userId })}
        tableKey={`client-contracts.user.${userId}`}
        columns={getClientContractColumns({ showUser: false })}
        getRowCommands={(contract) => ClientContractService.getRowActions(contract, canManageCredits, canManageCredits ? {
          onGrant: (selected) => { setContractsToGrant([selected]); setGrantCreditsOpen(true) },
          onRemove: setContractToRemoveCredits,
        } : undefined)}
        loadingMessage="Loading client contracts..."
        emptyMessage="No client contracts found."
      /> : null}
      <GrantCreditsDrawer contracts={contractsToGrant} open={grantCreditsOpen} onOpenChange={setGrantCreditsOpen} />
      {canManageCredits && (isAdminContext || currentCustomerId) && user ? (
        <GiftCreditsDrawer
          customerId={isAdminContext ? undefined : currentCustomerId}
          customerName={currentCustomerName}
          fixedUser={user}
          open={walletAdjustmentOpen}
          onOpenChange={setWalletAdjustmentOpen}
        />
      ) : null}
      <RemoveCreditsDrawer
        contract={contractToRemoveCredits}
        open={Boolean(contractToRemoveCredits)}
        onOpenChange={(open) => { if (!open) setContractToRemoveCredits(null) }}
      />
      {canViewCreditWallets ? <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-credit-transactions`}
        title="Credit transactions"
        icon={EntityIcon.clientContracts}
        viewAllTo={makeViewAllTo('/credit-transactions', userId)}
        viewAllMinCount={5}
        queryKey={clientContractsQueryKeys.userCreditMovements(userId)}
        loadData={(state: DataTableState<ClientContractCreditMovement>) => getUserCreditMovementsRequest(state, userId)}
        tableKey={`credit-transactions.user.${userId}`}
        columns={getCreditMovementColumns({ showUser: false, showCustomer: isAdminContext })}
        getRowCommands={(movement) => getCreditMovementRowActions(movement, canManageCredits)}
        action={canManageCredits && (isAdminContext || currentCustomerId) && user ? {
          label: 'Adjust credits',
          onClick: () => setWalletAdjustmentOpen(true),
        } : undefined}
        loadingMessage="Loading credit transactions..."
        emptyMessage="No credit transactions found."
        errorMessage="Failed to load credit transactions."
      /> : null}

      {canViewAiSupportIssues ? <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-ai-support-issues`}
        title="AI support issues"
        icon={EntityIcon.aiSupportIssues}
        queryKey={[...aiSupportIssueQueryKeys.all, 'user', userId]}
        loadData={(state: DataTableState<AiSupportIssue>) => getAiSupportIssuesRequest(state, { userId })}
        tableKey={`ai-support-issues.user.${userId}`}
        columns={aiSupportIssueColumns}
        getRowCommands={(issue) => [
          ...(issue.status !== 'RESOLVED' ? [{ label: 'Resolve', onClick: () => void setAiSupportIssueStatus(issue, 'RESOLVED') }] : []),
          ...(issue.status !== 'DISMISSED' ? [{ label: 'Dismiss', onClick: () => void setAiSupportIssueStatus(issue, 'DISMISSED') }] : []),
        ]}
        pageSize={5}
        showPagination
        loadingMessage="Loading AI support issues..."
        emptyMessage="No AI support issues found for this user."
        errorMessage="Failed to load AI support issues."
      /> : null}
      {canViewOrders ? <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-orders`}
        title="Orders"
        icon={EntityIcon.orders}
        viewAllTo={makeViewAllTo('/orders', userId)}
        queryKey={ordersQueryKeys.user(userId)}
        loadData={(state: DataTableState<Order>) => getOrdersRequest(state, { userId })}
        tableKey={`orders.user.${userId}`}
        columns={getOrderColumns({ showUser: false })}
        getRowCommands={(order) => OrderService.getRowActions(order, Boolean(session?.permissions.customers?.edit), Boolean(session?.permissions.orders?.edit || session?.permissions.orders?.delete))}
        loadingMessage="Loading orders..."
        emptyMessage="No orders found."
      /> : null}
      {canViewAccess ? <RelatedEntityModule<AccessToken>
        id={`${MODULE_ANCHOR_PREFIX}-access-tokens`}
        title="Access"
        icon={EntityIcon.devices}
        queryKey={['access-tokens', userId, currentCustomerId]}
        loadData={(state) => getAccessTokensRequest(state, { userId })}
        tableKey={`access.tokens.user.${userId}`}
        columns={accessTokenColumns}
        action={canCreateAccess && user ? { label: 'Create access', onClick: () => { setEditingAccess(null); setAccessDrawerOpen(true) } } : undefined}
        getRowCommands={(access) => canEditAccess ? [
          { label: 'Edit access', onClick: () => { setEditingAccess(access); setAccessDrawerOpen(true) } },
          ...(access.isActive ? [{ label: 'Generate QR code', onClick: () => setQrAccess(access) }] : []),
          ...(access.isActive ? [{ label: 'Disable access', onClick: () => void disableAccess(access) }] : []),
          ...(!access.isActive ? [{ label: 'Enable access', onClick: () => void enableAccess(access) }] : []),
        ] : []}
        showPagination
        loadingMessage="Loading access…"
        emptyMessage="No access created for this user."
      /> : null}
      {canViewAccess ? <RelatedEntityModule<AccessScan>
        id={`${MODULE_ANCHOR_PREFIX}-access-scans`}
        title="Access scans"
        icon={EntityIcon.commandLogs}
        viewAllTo={`/access/scans?f.userId=${encodeURIComponent(userId)}`}
        queryKey={['access-scans', 'user', userId, currentCustomerId]}
        loadData={(state) => getAccessScansRequest(state, { userId })}
        tableKey={`access.scans.user.${userId}`}
        columns={userAccessScanColumns}
        pageSize={5}
        showPagination
        loadingMessage="Loading access scans…"
        emptyMessage="No access scans for this user."
      /> : null}
      {(canCreateAccess || canEditAccess) && user ? <AccessTokenDrawer open={accessDrawerOpen}
        onOpenChange={(open) => { setAccessDrawerOpen(open); if (!open) setEditingAccess(null) }}
        user={user} access={editingAccess} currentCustomerId={isAdminContext ? undefined : currentCustomerId} /> : null}
      <AccessTokenQrDialog access={qrAccess} onOpenChange={(open) => { if (!open) setQrAccess(null) }} />
      <MergeUserDrawer keptUser={keptUser} onOpenChange={(open) => { if (!open) setKeptUser(null) }} />
    </DetailPageLayout>
  )
}
