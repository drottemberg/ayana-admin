import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { getCustomersListRequest } from '@/features/customers/api'
import {
  getCreditMovementUserOptions,
  getCreditMovementsRequest,
  getClientContractLocationOptions,
} from '@/features/client-contracts/api'
import { getCreditMovementColumns } from '@/features/client-contracts/credit-movement-columns'
import { clientContractsQueryKeys } from '@/features/client-contracts/query-keys'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import type { ClientContractCreditMovement } from '@/types/client-contract'

const movementTypes: ClientContractCreditMovement['type'][] = [
  'OPENING_BALANCE',
  'PURCHASE_GRANT',
  'PERIOD_GRANT',
  'PERIOD_EXPIRY',
  'BOOKING_CONSUMPTION',
  'BOOKING_REFUND',
  'MANUAL_GRANT',
  'MANUAL_DEDUCTION',
  'CREDIT_EXPIRY',
]

export default function CreditTransactionsPage() {
  const [searchParams] = useSearchParams()
  const { session } = useConnect()
  const isAdminContext = getAppMode() === 'admin'
  const currentCustomerId = session?.currentOrganization?.id
  const columns = useMemo(() => getCreditMovementColumns({ showCustomer: isAdminContext }), [isAdminContext])
  const initialFilters = {
    ...(isAdminContext && searchParams.get('filterCustomerId') ? { customerId: [searchParams.get('filterCustomerId')!] } : {}),
    ...(searchParams.get('filterLocationId') ? { locationId: [searchParams.get('filterLocationId')!] } : {}),
    ...(searchParams.get('userId') ? { userId: [searchParams.get('userId')!] } : {}),
  }

  return <>
    <PageHeader title="Credit transactions" subtitle="Credit movements across customers and locations." />
    <section className="p-4 md:p-6">
      <DataTableAsync
        queryKey={[...clientContractsQueryKeys.creditMovements(), 'table']}
        loadData={(state: DataTableState<ClientContractCreditMovement>) => getCreditMovementsRequest(state, !isAdminContext && currentCustomerId ? { customerId: currentCustomerId } : undefined)}
        refetchOnMount="always"
        tableKey="credit-transactions.root"
        initialFilters={Object.keys(initialFilters).length ? initialFilters : undefined}
        columns={columns}
        disabledSelection
        searchPlaceholder="Search by user, customer, location, contract or reason"
        searchColumns={['id', 'reason']}
        filters={[
          {
            id: 'type',
            label: 'Activity',
            column: 'type' as const,
            options: movementTypes,
            getValue: (movement: ClientContractCreditMovement) => movement.type,
          },
          ...(!isAdminContext ? [] : [{
            id: 'customerId',
            label: 'Customer',
            column: 'customer' as const,
            selectionMode: 'single' as const,
            queryFn: async (search: string) => {
              const customers = await getCustomersListRequest(undefined, search)
              return { items: customers.map((customer) => ({ id: customer.id, label: customer.name })), total: customers.length }
            },
            getValue: (movement: ClientContractCreditMovement) => movement.customer?.id,
          }]),
          {
            id: 'locationId',
            label: 'Location',
            column: 'locationName' as const,
            selectionMode: 'single' as const,
            queryFn: getClientContractLocationOptions,
            getValue: (movement: ClientContractCreditMovement) => movement.organizationId,
          },
          {
            id: 'userId',
            label: 'User',
            column: 'user' as const,
            selectionMode: 'single' as const,
            queryFn: getCreditMovementUserOptions,
            getValue: (movement: ClientContractCreditMovement) => movement.user?.id,
          },
        ]}
        loadingMessage="Loading credit transactions..."
        emptyMessage="No credit transactions found."
        errorMessage="Failed to load credit transactions."
      />
    </section>
  </>
}
