import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MultiselectInput, MultiselectInputAsync, SelectInput, SelectInputAsync } from '@/components/ui/select-input'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { clientContractsQueryKeys } from '@/features/client-contracts/query-keys'
import { adjustClientContractCreditsRequest, adjustClientWalletCreditsRequest, getClientContractCreditMovementsRequest, grantClientContractCreditsRequest } from '@/features/client-contracts/api'
import { getAllLocationsForCustomerRequest } from '@/features/locations/api'
import { locationsQueryKeys } from '@/features/locations/query-keys'
import { searchUsersForCreditGift } from '@/features/users/api'
import { getCustomersListRequest } from '@/features/customers/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { getAppMode } from '@/features/app/app-mode'
import type { Customer } from '@/types/customer'
import type { Location } from '@/types/location'
import type { User } from '@/types/user'
import type { ClientContract, ClientContractCreditMovement } from '@/types/client-contract'
import { DateUtils } from '@/utils'

function contractRecipient(contract: ClientContract) {
  const name = [contract.user?.firstName, contract.user?.lastName].filter(Boolean).join(' ')
  return name || contract.user?.email || contract.userId
}

function toExpirationIso(date: string) {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined
}

export function GrantCreditsDrawer({
  contracts,
  open,
  onOpenChange,
}: {
  contracts: ClientContract[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('1')
  const [reason, setReason] = useState('')
  const [expirationDate, setExpirationDate] = useState('')

  useEffect(() => {
    if (open) {
      setAmount('1')
      setReason('')
      setExpirationDate('')
    }
  }, [open, contracts.map((contract) => contract.id).join(',')])

  const grant = useMutation({
    mutationFn: () => grantClientContractCreditsRequest({
      clientContractIds: contracts.map((contract) => contract.id),
      amount: Number(amount),
      reason: reason.trim(),
      expiresAt: toExpirationIso(expirationDate),
    }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: clientContractsQueryKeys.all })
      toast.success(`${result.creditsEach} credit(s) granted to ${result.grantedTo} contract(s).`)
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not grant credits.'),
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1000) {
      toast.error('Enter a credit amount greater than 0 and no more than 1,000.')
      return
    }
    if (reason.trim().length < 3) {
      toast.error('Add a short reason for this credit gift.')
      return
    }
    if (!contracts.length) return
    grant.mutate()
  }

  const recipients = [...new Set(contracts.map(contractRecipient))]

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Offer credits"
      description="Add credits to the selected active client contracts."
      contentClassName="sm:max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border p-3 text-sm">
            <div className="font-medium">{contracts.length} contract(s) · {recipients.length} user(s)</div>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-muted-foreground">
              {contracts.map((contract) => (
                <li key={contract.id}>
                  {contractRecipient(contract)} — {contract.pricingOption?.name ?? 'Complimentary credits'}
                </li>
              ))}
            </ul>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Credits to add to each contract</span>
            <Input required type="number" min="0.01" max="1000" step="0.5" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Expiration date (optional)</span>
            <Input type="date" value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} />
            <span className="text-xs font-normal text-muted-foreground">Leave empty if these credits should never expire.</span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Reason</span>
            <Textarea required minLength={3} maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Goodwill gesture, service recovery…" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={grant.isPending || !contracts.length}>
            {grant.isPending ? <><Spinner /> Granting…</> : 'Grant credits'}
          </Button>
        </div>
      </form>
    </AppDrawer>
  )
}

export function GiftCreditsDrawer({
  customerId,
  customerName,
  fixedUser,
  open,
  onOpenChange,
}: {
  customerId?: string
  customerName?: string
  fixedUser?: User
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const isAdminContext = getAppMode() === 'admin'
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId ?? '')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>()
  const effectiveCustomerId = isAdminContext ? selectedCustomerId : (customerId ?? '')
  const [scope, setScope] = useState<'ALL' | 'SPECIFIC'>('ALL')
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [userIds, setUserIds] = useState<string[]>([])
  const [operation, setOperation] = useState<'ADD' | 'REMOVE'>('ADD')
  const [amount, setAmount] = useState('1')
  const [reason, setReason] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const locations = useQuery({
    // Share the customer-scoped locations query used by the org switcher so the
    // drawer uses the same authorized location set already loaded for this customer.
    queryKey: locationsQueryKeys.customer(effectiveCustomerId),
    queryFn: () => getAllLocationsForCustomerRequest(effectiveCustomerId),
    enabled: open && Boolean(effectiveCustomerId),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  useEffect(() => {
    if (!open) return
    setSelectedCustomerId(isAdminContext ? '' : (customerId ?? ''))
    setSelectedCustomer(undefined)
    setScope('ALL')
    setLocationIds([])
    setUsers(fixedUser ? [fixedUser] : [])
    setUserIds(fixedUser?.id ? [String(fixedUser.id)] : [])
    setOperation('ADD')
    setAmount('1')
    setReason('')
    setExpirationDate('')
  }, [open, fixedUser?.id, customerId, isAdminContext])

  const userQuery = async (search: string) => {
    if (scope === 'SPECIFIC' && !locationIds.length) return []
    return searchUsersForCreditGift(effectiveCustomerId, scope === 'SPECIFIC' ? locationIds : [], search)
  }
  const userOption = (user: User) => ({
    value: String(user.id),
    label: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || String(user.id),
  })

  const adjust = useMutation({
    mutationFn: () => adjustClientWalletCreditsRequest({
      customerId: effectiveCustomerId,
      scope,
      locationIds: scope === 'SPECIFIC' ? locationIds : [],
      userIds,
      operation,
      amount: Number(amount),
      reason: reason.trim(),
      ...(operation === 'ADD' ? { expiresAt: toExpirationIso(expirationDate) } : {}),
    }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: clientContractsQueryKeys.all })
      toast.success(`${result.creditsEach} credit(s) ${operation === 'ADD' ? 'added to' : 'removed from'} ${result.adjusted} user wallet(s).`)
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not adjust credit wallets.'),
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!userIds.length || (scope === 'SPECIFIC' && !locationIds.length)) {
      toast.error('Choose at least one recipient and select locations, or choose all locations.')
      return
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1000) {
      toast.error('Enter a credit amount greater than 0 and no more than 1,000.')
      return
    }
    if (reason.trim().length < 3) {
      toast.error('Add a short reason for this credit gift.')
      return
    }
    adjust.mutate()
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Adjust credit balance"
      description="Add credits to or remove credits from the selected members' shared customer wallets."
      contentClassName="sm:max-w-xl"
    >
      {({ containerRef }) => (
        <form onSubmit={handleSubmit} autoComplete="off" className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Customer wallet</span>
              {isAdminContext ? (
                <SelectInputAsync<Customer>
                  aria-label="Customer for credit wallet"
                  placeholder="Search and select a customer"
                  queryKey={customersQueryKeys.all}
                  queryFn={(search) => getCustomersListRequest(undefined, search)}
                  getOption={(customer) => ({ value: String(customer.id), label: customer.name })}
                  selectedItems={selectedCustomer ? [selectedCustomer] : []}
                  value={selectedCustomerId}
                  onValueChange={(value) => {
                    setSelectedCustomerId(String(value))
                    setScope('ALL')
                    setLocationIds([])
                    setUsers(fixedUser ? [fixedUser] : [])
                    setUserIds(fixedUser?.id ? [String(fixedUser.id)] : [])
                  }}
                  onSelectedItemsChange={(items) => setSelectedCustomer(items[0])}
                  container={containerRef}
                />
              ) : (
                <div className="rounded-md border bg-muted/30 px-3 py-2 font-normal">{customerName ?? customerId}</div>
              )}
            </label>
            {fixedUser ? (
              <div className="grid gap-1.5 text-sm font-medium">
                <span>Recipient</span>
                <div className="rounded-md border bg-muted/30 px-3 py-2 font-normal">
                  {[fixedUser.firstName, fixedUser.lastName].filter(Boolean).join(' ') || fixedUser.email || fixedUser.id}
                </div>
              </div>
            ) : (
              <MultiselectInputAsync<User>
                label="Recipients"
                placeholder={!effectiveCustomerId ? 'Select a customer first' : scope === 'SPECIFIC' && !locationIds.length ? 'Select locations first' : 'Search users by name, email or phone'}
                queryKey={['users', 'credit-gift', effectiveCustomerId, scope, ...locationIds]}
                queryFn={userQuery}
                getOption={userOption}
                selectedItems={users}
                onSelectedItemsChange={setUsers}
                value={userIds}
                onValueChange={setUserIds}
                disabled={!effectiveCustomerId || (scope === 'SPECIFIC' && !locationIds.length)}
                loadingMessage="Searching users..."
                errorMessage="Failed to search users."
                emptyMessage="No customer members found."
                container={containerRef}
              />
            )}
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Credit availability</span>
              <SelectInput
                aria-label="Credit availability scope"
                items={[{ value: 'ALL', label: 'All locations' }, { value: 'SPECIFIC', label: 'Selected locations' }]}
                value={scope}
                onValueChange={(value) => setScope(String(value) as 'ALL' | 'SPECIFIC')}
                container={containerRef}
              />
            </label>
            {scope === 'SPECIFIC' ? (
              <MultiselectInput
                label="Locations"
                placeholder="Select one or more locations"
                items={(locations.data ?? []).map((location: Location) => ({ value: location.id, label: location.name }))}
                value={locationIds}
                onValueChange={setLocationIds}
                isLoading={locations.isFetching}
                emptyMessage={locations.isError ? 'Failed to load locations.' : 'No locations found for this customer.'}
                loadingMessage="Loading locations..."
                container={containerRef}
              />
            ) : (
              <p className="text-sm text-muted-foreground">These credits can be used at any location belonging to this customer.</p>
            )}
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Action</span>
              <SelectInput
                aria-label="Credit balance action"
                items={[{ value: 'ADD', label: 'Add credits' }, { value: 'REMOVE', label: 'Remove credits' }]}
                value={operation}
                onValueChange={(value) => setOperation(String(value) as 'ADD' | 'REMOVE')}
                container={containerRef}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Credits per person</span>
              <Input required type="number" min="0.01" max="1000" step="0.5" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            {operation === 'ADD' ? <label className="grid gap-1.5 text-sm font-medium">
              <span>Expiration date (optional)</span>
              <Input type="date" value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} />
              <span className="text-xs font-normal text-muted-foreground">Leave empty if these credits should never expire.</span>
            </label> : null}
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Reason</span>
              <Textarea required minLength={3} maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Goodwill gesture, service recovery…" />
            </label>
            {userIds.length ? <p className="text-sm text-muted-foreground">{operation === 'ADD' ? 'Each selected member will receive' : 'Credits will be removed from each selected member’s shared balance:'} {amount || 0} credits. Availability: {scope === 'ALL' ? 'all customer locations' : `${locationIds.length} selected location(s)`}.</p> : null}
          </div>
          <div className="flex justify-end gap-2 border-t p-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant={operation === 'REMOVE' ? 'destructive' : 'default'} disabled={adjust.isPending || !effectiveCustomerId || !userIds.length || (scope === 'SPECIFIC' && !locationIds.length)}>
              {adjust.isPending ? <><Spinner /> Saving…</> : operation === 'ADD' ? 'Add credits' : 'Remove credits'}
            </Button>
          </div>
        </form>
      )}
    </AppDrawer>
  )
}

const movementLabels: Record<ClientContractCreditMovement['type'], string> = {
  OPENING_BALANCE: 'Opening balance',
  PURCHASE_GRANT: 'Purchased credits',
  PERIOD_GRANT: 'Periodic allowance',
  PERIOD_EXPIRY: 'Expired credits',
  BOOKING_CONSUMPTION: 'Booking consumption',
  BOOKING_REFUND: 'Booking credit return',
  MANUAL_GRANT: 'Manual credit gift',
  MANUAL_DEDUCTION: 'Manual credit removal',
  CREDIT_EXPIRY: 'Expired credits',
}

export function CreditHistoryDrawer({
  contract,
  open,
  onOpenChange,
}: {
  contract: ClientContract | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const movements = useQuery({
    queryKey: [...clientContractsQueryKeys.all, contract?.id, 'credit-movements'],
    queryFn: () => getClientContractCreditMovementsRequest(contract!.id),
    enabled: open && Boolean(contract?.id),
  })

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Credit history"
      description={contract ? `${contractRecipient(contract)} · ${contract.pricingOption?.name ?? 'Complimentary credits'}` : undefined}
      contentClassName="sm:max-w-3xl"
    >
      <div className="min-h-0 flex-1 overflow-auto px-5 pb-5">
        {movements.isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : null}
        {movements.isError ? <p className="py-8 text-center text-sm text-destructive">Failed to load credit history.</p> : null}
        {movements.data?.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No credit activity recorded.</p> : null}
        {movements.data?.length ? (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(movements.data as ClientContractCreditMovement[]).map((movement) => {
                  const creator = [movement.creator?.firstName, movement.creator?.lastName].filter(Boolean).join(' ')
                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="whitespace-nowrap">{DateUtils.formatDateTime(movement.createdAt)}</TableCell>
                      <TableCell>{movementLabels[movement.type] ?? movement.type}</TableCell>
                      <TableCell className="whitespace-nowrap">{movement.expiresAt ? DateUtils.formatDateTime(movement.expiresAt) : 'Never'}</TableCell>
                      <TableCell className="min-w-40 text-muted-foreground">
                        {movement.bookingInfo?.className ?? movement.reason ?? (movement.bookingId ? `Booking ${movement.bookingId}` : '—')}
                        {movement.reason && movement.bookingInfo?.className ? <div className="text-xs">{movement.reason}</div> : null}
                        {movement.bookingInfo?.startTime ? <div className="text-xs">{DateUtils.formatDateTime(movement.bookingInfo.startTime)}</div> : null}
                        {creator ? <div className="text-xs">By {creator}</div> : null}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${movement.amount < 0 ? 'text-destructive' : 'text-green-700'}`}>
                        {movement.amount > 0 ? '+' : ''}{movement.amount}
                      </TableCell>
                      <TableCell className="text-right">{movement.balanceAfter ?? 'Unlimited'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>
    </AppDrawer>
  )
}

export function RemoveCreditsDrawer({
  contract,
  open,
  onOpenChange,
}: {
  contract: ClientContract | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('1')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    setAmount('1')
    setReason('')
  }, [open, contract?.id])

  const remove = useMutation({
    mutationFn: () => adjustClientContractCreditsRequest({
      clientContractId: contract!.id,
      operation: 'REMOVE',
      amount: Number(amount),
      reason: reason.trim(),
    }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: clientContractsQueryKeys.all })
      toast.success(`${result.amount} credit(s) removed. ${result.balanceAfter} remaining.`)
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not remove credits.'),
  })

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!contract || !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > Number(contract.creditsRemaining ?? 0)) {
      toast.error('Enter a credit amount within the available balance.')
      return
    }
    if (reason.trim().length < 3) {
      toast.error('Add a short reason for removing credits.')
      return
    }
    remove.mutate()
  }

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} title="Remove credits"
      description={contract ? `${contractRecipient(contract)} · ${contract.pricingOption?.name ?? 'Complimentary credits'} · ${contract.creditsRemaining} remaining` : undefined}
      contentClassName="sm:max-w-xl">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Credits to remove</span>
            <Input required type="number" min="0.01" max={contract?.creditsRemaining ?? 0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Reason</span>
            <Textarea required minLength={3} maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Correction, goodwill reversal…" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="destructive" disabled={remove.isPending || !contract}>
            {remove.isPending ? <><Spinner /> Removing…</> : 'Remove credits'}
          </Button>
        </div>
      </form>
    </AppDrawer>
  )
}
