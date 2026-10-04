import { useCallback } from 'react'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { ContractService } from '@/features/contracts/contract-service'
import { getContractFilterOptionsRequest, getContractsRequest } from '@/features/contracts/api'
import { contractColumns } from '@/features/contracts/contract-columns'
import { contractsQueryKeys } from '@/features/contracts/query-keys'
import { Drawer, DrawerId } from '@/providers/drawer'
import type { Contract } from '@/types/contract'

export default function ContractsPage() {
  const loadContracts = useCallback((tableState: DataTableState<Contract>) => getContractsRequest(tableState), [])
  const handleGetCommands = useCallback((contracts: Contract[]) => {
    return ContractService.getTableActions(contracts)
  }, [])

  return (
    <>
      <PageHeader
        title="Contracts list"
        primaryAction={{
          children: 'Create new contract',
          onClick: () => Drawer.show(DrawerId.CreateContract, {}),
        }}
      />

      <section className="p-4 md:p-6">
        <DataTableAsync
          queryKey={[...contractsQueryKeys.all, 'table']}
          loadData={loadContracts}
          tableKey="contracts.root"
          columns={contractColumns}
          searchPlaceholder="Search by ID, name, customer name"
          searchColumns={['id', 'name']}
          filters={[
            {
              id: 'status',
              label: 'Status',
              column: 'status',
              options: ContractService.statusFilterKeys(),
              getValue: ContractService.getStatus,
            },
            {
              id: 'customerId',
              label: 'Customer',
              column: 'customer',
              selectionMode: 'single',
              queryFn: (search, page) => getContractFilterOptionsRequest('customer', search, page),
            },
            {
              id: 'deviceId',
              label: 'Device',
              column: 'devices',
              selectionMode: 'single',
              queryFn: (search, page) => getContractFilterOptionsRequest('device', search, page),
            },
          ]}
          getCommands={handleGetCommands}
          getRowCommands={(contract) => ContractService.getActions(contract)}
          loadingMessage="Loading contracts..."
          emptyMessage="No contracts found."
          errorMessage="Failed to load contracts."
        />
      </section>
    </>
  )
}
