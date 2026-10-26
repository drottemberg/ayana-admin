import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { SelectInput } from '@/components/ui/select-input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import { getCustomersListRequest, getCustomersRequest } from '@/features/customers/api'
import { customerColumns } from '@/features/customers/customer-columns'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { OrganizationService } from '@/features/organizations/organization-service'
import { getAllLocationsForCustomerRequest, getLocationRequest } from '@/features/locations/api'
import { locationColumns } from '@/features/locations/location-columns'
import { locationsQueryKeys } from '@/features/locations/query-keys'
import { getUserMarketingPreferencesRequest, getUserRequest, updateUserMarketingPreferenceRequest } from '@/features/users/api'
import { UserStatusBadge } from '@/features/users/UserStatusBadge'
import { usersQueryKeys } from '@/features/users/query-keys'
import { UserService } from '@/features/users/user-service'
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
import { bookingsQueryKeys } from '@/features/bookings/query-keys'
import type { Booking } from '@/types/booking'
import { EntityIcon } from '@/components/app/entity-icons'
import { GiftCreditsDrawer, GrantCreditsDrawer, RemoveCreditsDrawer } from '@/features/client-contracts/CreditManagementDrawers'
import { getAiSupportIssuesRequest, updateAiSupportIssueRequest } from '@/features/ai-support-issues/api'
import { aiSupportIssueQueryKeys } from '@/features/ai-support-issues/query-keys'
import type { AiSupportIssue } from '@/features/ai-support-issues/types'

const MODULE_ANCHOR_PREFIX = 'module'

const aiSupportIssueColumns: ColumnDef<AiSupportIssue>[] = [
  { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => formatDateTime(row.original.createdAt) },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant="outline">{row.original.status.replaceAll('_', ' ')}</Badge> },
  {
    accessorKey: 'summary',
    header: 'Summary',
    cell: ({ row }) => <Link className="block max-w-72 whitespace-normal break-words underline-offset-2 hover:underline" to={`/ai-support-issues?issueId=${encodeURIComponent(row.original.id)}`}>{row.original.summary}</Link>,
  },
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

function getUserDetailSections(
  user: User | undefined,
  creditWallets?: { customerId: string; customerName: string; balance: number; unlimited: boolean }[],
  creditWalletsLoading = false,
  canViewCreditWallets = false,
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
      fields: user?.preferences && Object.keys(user.preferences).length
        ? Object.entries(user.preferences).map(([key, value]) => ({ label: preferenceLabel(key), value: preferenceValue(value) }))
        : [{ label: 'Preferences', value: 'No preferences saved' }],
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
  const canViewOrders = Boolean(session?.permissions.orders?.view)
  const [contractsToGrant, setContractsToGrant] = useState<ClientContract[]>([])
  const [grantCreditsOpen, setGrantCreditsOpen] = useState(false)
  const [walletAdjustmentOpen, setWalletAdjustmentOpen] = useState(false)
  const [contractToRemoveCredits, setContractToRemoveCredits] = useState<ClientContract | null>(null)
  const currentCustomerId = session?.currentOrganization?.id
  const currentCustomerName = session?.currentOrganization?.name
  const isAdminContext = getAppMode() === 'admin'
  const canViewAiSupportIssues = Boolean(isAdminContext && ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'].includes(session?.user.staffRole ?? ''))
  const canManageMarketingPreferences = Boolean(permissions?.edit && (isAdminContext || currentCustomerId))
  const setAiSupportIssueStatus = async (issue: AiSupportIssue, status: 'RESOLVED' | 'DISMISSED') => {
    try {
      await updateAiSupportIssueRequest(issue.id, { status })
      await queryClient.invalidateQueries({ queryKey: aiSupportIssueQueryKeys.all })
      toast.success(status === 'RESOLVED' ? 'Issue resolved.' : 'Issue dismissed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the issue.')
    }
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
    ...(isAdminContext ? [{ key: 'customers', label: 'Customers' }] : []),
    ...(hasCustomerMembership ? [{ key: 'locations', label: 'Locations' }] : []),
    ...(canViewContracts || canViewCreditWallets || canViewBookings || canViewOrders
      ? [
          ...(canViewContracts ? [{ key: 'client-contracts', label: 'Client contracts' }] : []),
          ...(canViewCreditWallets ? [{ key: 'credit-transactions', label: 'Credit transactions' }] : []),
          ...(canViewBookings ? [{ key: 'bookings', label: 'Bookings' }] : []),
          ...(canViewOrders ? [{ key: 'orders', label: 'Orders' }] : []),
        ]
      : []),
    ...(canManageMarketingPreferences ? [{ key: 'marketing-messages', label: 'Marketing messages' }] : []),
    ...(canViewAiSupportIssues ? [{ key: 'ai-support-issues', label: 'AI support issues' }] : []),
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
        options: user ? UserService.getDetailHeaderActions(user, permissions).options : [],
      }}
      modules={modules}
      aside={<DetailSidePanel sections={getUserDetailSections(user, creditWallets.data?.items, creditWallets.isLoading, canViewCreditWallets)} isLoading={isLoading} />}
    >
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
        action={canManageCredits && (isAdminContext || currentCustomerId) && user ? {
          label: 'Adjust credits',
          onClick: () => setWalletAdjustmentOpen(true),
        } : undefined}
        loadingMessage="Loading credit transactions..."
        emptyMessage="No credit transactions found."
        errorMessage="Failed to load credit transactions."
      /> : null}
      {canViewBookings ? <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-bookings`}
        title="Bookings"
        icon={EntityIcon.classes}
        viewAllTo={makeViewAllTo('/bookings', userId)}
        queryKey={bookingsQueryKeys.user(userId)}
        loadData={(state: DataTableState<Booking>) => getBookingsRequest(state, {
          userId,
          ...(!isAdminContext && currentCustomerId ? { customerId: currentCustomerId } : {}),
        })}
        tableKey={`bookings.user.${userId}`}
        columns={getBookingColumns({ showUser: false, showCustomer: isAdminContext })}
        loadingMessage="Loading bookings..."
        emptyMessage="No bookings found."
        errorMessage="Failed to load bookings."
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
      {canManageMarketingPreferences && user ? (
        <MarketingMessagesModule userId={userId} isAdminContext={isAdminContext} currentCustomerId={currentCustomerId} />
      ) : null}
    </DetailPageLayout>
  )
}

function MarketingMessagesModule({
  userId,
  isAdminContext,
  currentCustomerId,
}: {
  userId: string
  isAdminContext: boolean
  currentCustomerId?: string
}) {
  const queryClient = useQueryClient()
  const [selectedCustomerId, setSelectedCustomerId] = useState(currentCustomerId ?? '')
  const queryKey = [...usersQueryKeys.detail(userId), 'marketing-preferences'] as const
  const preferences = useQuery({ queryKey, queryFn: () => getUserMarketingPreferencesRequest(userId) })
  const customers = useQuery({
    queryKey: [...customersQueryKeys.all, 'marketing-opt-out-picker'],
    queryFn: () => getCustomersListRequest(),
    enabled: isAdminContext,
  })
  const updatePreference = useMutation({
    mutationFn: (input: { customerId: string; optedOut: boolean }) => updateUserMarketingPreferenceRequest(userId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error('Could not update the marketing message preference.'),
  })
  const optOutSelectedCustomer = useMutation({
    mutationFn: () => updateUserMarketingPreferenceRequest(userId, { customerId: selectedCustomerId, optedOut: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      toast.success('User opted out of bulk campaigns for this customer.')
    },
    onError: () => toast.error('Could not opt this user out of bulk campaigns.'),
  })

  useEffect(() => {
    if (currentCustomerId) setSelectedCustomerId(currentCustomerId)
  }, [currentCustomerId])

  return (
    <Card id={`${MODULE_ANCHOR_PREFIX}-marketing-messages`} className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Marketing messages</CardTitle>
        <CardDescription>
          Opting out stops bulk campaigns for that customer. Transactional messages such as booking and order updates remain enabled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdminContext ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <SelectInput
                aria-label="Customer for marketing opt-out"
                placeholder="Select customer"
                searchable
                items={(customers.data ?? []).map((customer) => ({ value: customer.id, label: customer.name }))}
                isLoading={customers.isLoading}
                emptyMessage={customers.isError ? 'Failed to load customers.' : 'No customers found.'}
                value={selectedCustomerId || undefined}
                onValueChange={(value) => setSelectedCustomerId(String(value ?? ''))}
              />
            </div>
            <Button
              variant="outline"
              disabled={
                !selectedCustomerId ||
                optOutSelectedCustomer.isPending ||
                preferences.data?.items.find((item) => item.customerId === selectedCustomerId)?.optedOut === true
              }
              onClick={() => optOutSelectedCustomer.mutate()}
            >
              Opt out
            </Button>
          </div>
        ) : null}
        {preferences.isLoading ? <p className="text-muted-foreground">Loading customer preferences…</p> : null}
        {preferences.isError ? <p className="text-destructive">Could not load marketing preferences.</p> : null}
        {!preferences.isLoading && !preferences.isError && !preferences.data?.items.length ? (
          <p className="text-muted-foreground">No customer messaging history found for this user.</p>
        ) : null}
        {preferences.data?.items.map((preference) => (
          <label key={preference.customerId} className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-4">
            <span className="min-w-0">
              <span className="block truncate font-medium">{preference.customerName}</span>
              <span className="block text-muted-foreground">
                {preference.optedOut ? 'Excluded from bulk campaigns' : 'Included in eligible bulk campaigns'}
              </span>
            </span>
            <input
              aria-label={`Opt out of bulk campaigns from ${preference.customerName}`}
              type="checkbox"
              className="size-5 shrink-0 accent-primary"
              checked={preference.optedOut}
              disabled={updatePreference.isPending}
              onChange={(event) => updatePreference.mutate({ customerId: preference.customerId, optedOut: event.currentTarget.checked })}
            />
          </label>
        ))}
      </CardContent>
    </Card>
  )
}
