import { useCallback } from 'react'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { useConnect } from '@/features/app/use-connect'
import { getCustomersRequest } from '@/features/customers/api'
import { customerColumns } from '@/features/customers/customer-columns'
import { CustomerService } from '@/features/customers/customer-service'
import { customersQueryKeys } from '@/features/customers/query-keys'
import type { Customer } from '@/types/customer'
import { OrganizationStatusValues } from '@/types/organization'

export default function CustomersPage() {
  const { session } = useConnect()
  const permissions = session?.permissions.customers
  const headerActions = CustomerService.getListHeaderActions(permissions)

  const loadData = useCallback((state: DataTableState<Customer>) => getCustomersRequest(state), [])

  return (
    <>
      <PageHeader
        title="Customers"
        primaryAction={headerActions.primaryAction}
        secondaryAction={headerActions.secondaryAction}
        options={headerActions.options}
      />
      <section className="p-4 md:p-6">
        <DataTableAsync
          queryKey={[...customersQueryKeys.all, 'table']}
          loadData={loadData}
          tableKey="customers.root"
          columns={customerColumns}
          searchPlaceholder="Search by ID, name, contact email, phone"
          searchColumns={['id', 'name', 'contactEmail', 'contactPhone']}
          filters={[
            {
              id: 'status',
              label: 'Status',
              column: 'status',
              // Backend's OrganizationEntity.getStatus() (mirroring UserEntity.getStatus()) folds
              // isArchived/isDeleted into `status` directly now — one Status filter covers all 4
              // states, no separate "Show deleted"/"Show archived" toggles needed anymore.
              options: [...OrganizationStatusValues],
              getValue: (customer) => customer.status,
            },
          ]}
          getCommands={(customers) => CustomerService.getTableActions(customers, permissions)}
          getRowCommands={(customer) => CustomerService.getRowActions(customer, permissions)}
          loadingMessage="Loading customers..."
          emptyMessage="No customers found."
          emptyAction={CustomerService.getListEmptyAction(permissions)}
          errorMessage="Failed to load customers."
        />
      </section>
    </>
  )
}
