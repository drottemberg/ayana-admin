import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { getCustomersListRequest } from '@/features/customers/api'
import { clientContractsQueryKeys } from '@/features/client-contracts/query-keys'
import { getClientContractLocationOptions, getClientContractsRequest } from '@/features/client-contracts/api'
import { getClientContractColumns } from '@/features/client-contracts/client-contract-columns'
import { ClientContractService } from '@/features/client-contracts/client-contract-service'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import type { ClientContract } from '@/types/client-contract'
import { GrantCreditsDrawer, GiftCreditsDrawer, CreditHistoryDrawer, RemoveCreditsDrawer } from '@/features/client-contracts/CreditManagementDrawers'

const statuses = ['PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED']

export default function ClientContractsPage() {
  const [searchParams] = useSearchParams()
  const [selectedContracts, setSelectedContracts] = useState<ClientContract[]>([])
  const [contractsToGrant, setContractsToGrant] = useState<ClientContract[]>([])
  const [grantOpen, setGrantOpen] = useState(false)
  const [historyContract, setHistoryContract] = useState<ClientContract | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [contractToRemoveCredits, setContractToRemoveCredits] = useState<ClientContract | null>(null)
  const [giftOpen, setGiftOpen] = useState(false)
  const { session } = useConnect()
  const isAdminContext = getAppMode() === 'admin'
  const currentCustomerId = session?.currentOrganization?.id
  const columns = useMemo(() => getClientContractColumns({ showCustomer: isAdminContext, showLocation: true, showUser: true }), [isAdminContext])
  const initialFilters = {
    ...(isAdminContext && searchParams.get('filterCustomerId') ? { customerId: [searchParams.get('filterCustomerId')!] } : {}),
    ...(searchParams.get('filterLocationId') ? { locationId: [searchParams.get('filterLocationId')!] } : {}),
    ...(searchParams.get('userId') ? { userId: [searchParams.get('userId')!] } : {}),
  }
  const canManage = Boolean(session?.permissions.customers?.edit)

  return <>
    <PageHeader title="Client contracts" subtitle="Memberships and credit packs held by customers." />
    <section className="p-4 md:p-6">
      <DataTableAsync
        queryKey={[...clientContractsQueryKeys.all, 'table']}
        loadData={(state: DataTableState<ClientContract>) => getClientContractsRequest(state, !isAdminContext && currentCustomerId ? { customerId: currentCustomerId } : undefined)}
        refetchOnMount="always"
        tableKey="client-contracts.root"
        initialFilters={Object.keys(initialFilters).length ? initialFilters : undefined}
        columns={columns}
        getRowCanSelect={(contract) => canManage && contract.status === 'ACTIVE' && contract.creditsRemaining !== null}
        onSelectedDataChange={setSelectedContracts}
        primaryCommand={{
          label: 'Add to selected contracts',
          disabled: !canManage || selectedContracts.length === 0,
          onClick: (contracts) => {
            if (!contracts.length) return
            setContractsToGrant(contracts)
            setGrantOpen(true)
          },
        }}
        toolbarExtra={canManage && (isAdminContext || currentCustomerId) ? (
          <Button variant="outline" onClick={() => setGiftOpen(true)}>Adjust credits</Button>
        ) : null}
        searchPlaceholder="Search by ID, pricing option, customer or user"
        searchColumns={['id']}
        filters={[
          { id: 'status', label: 'Status', column: 'status', options: statuses, getValue: (contract) => contract.status },
          ...(!isAdminContext ? [] : [{
            id: 'customerId', label: 'Customer', column: 'customer' as const, selectionMode: 'single' as const,
            queryFn: async (search: string) => {
              const customers = await getCustomersListRequest(undefined, search)
              return { items: customers.map((customer) => ({ id: customer.id, label: customer.name })), total: customers.length }
            },
            getValue: (contract: ClientContract) => contract.customer.id,
          }]),
          {
            id: 'locationId', label: 'Location', column: 'location' as const, selectionMode: 'single' as const,
            queryFn: getClientContractLocationOptions,
            getValue: (contract: ClientContract) => contract.location.id,
          },
        ]}
        getRowCommands={(contract) => ClientContractService.getRowActions(contract, canManage, canManage ? {
          onGrant: (selected) => { setContractsToGrant([selected]); setGrantOpen(true) },
          onRemove: setContractToRemoveCredits,
          onHistory: (selected) => { setHistoryContract(selected); setHistoryOpen(true) },
        } : undefined)}
        loadingMessage="Loading client contracts..."
        emptyMessage="No client contracts found."
        errorMessage="Failed to load client contracts."
      />
    </section>
    <GrantCreditsDrawer contracts={contractsToGrant} open={grantOpen} onOpenChange={setGrantOpen} />
    <CreditHistoryDrawer contract={historyContract} open={historyOpen} onOpenChange={setHistoryOpen} />
    <RemoveCreditsDrawer contract={contractToRemoveCredits} open={Boolean(contractToRemoveCredits)} onOpenChange={(open) => { if (!open) setContractToRemoveCredits(null) }} />
    {canManage && (isAdminContext || currentCustomerId) ? (
      <GiftCreditsDrawer
        customerId={isAdminContext ? undefined : currentCustomerId}
        customerName={session?.currentOrganization?.name}
        open={giftOpen}
        onOpenChange={setGiftOpen}
      />
    ) : null}
  </>
}
