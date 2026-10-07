import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { CreatePricingOptionDialog } from '@/features/pricing-options/CreatePricingOptionDialog'
import { getPricingOptionsRequest } from '@/features/pricing-options/api'
import { getPricingOptionColumns } from '@/features/pricing-options/pricing-option-columns'
import { pricingOptionsQueryKeys } from '@/features/pricing-options/query-keys'
import { PricingOptionService } from '@/features/pricing-options/pricing-option-service'
import { getCustomersListRequest } from '@/features/customers/api'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import type { PricingOption } from '@/types/pricing-option'

const statusOptions = ['ACTIVE', 'DISABLED', 'DELETED']

export default function PricingOptionsPage() {
  const [searchParams] = useSearchParams()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingOption, setEditingOption] = useState<PricingOption | null>(null)
  const { session } = useConnect()
  const isAdminContext = getAppMode() === 'admin'
  const filterCustomerId = searchParams.get('filterCustomerId')
  const activeOrganization = session?.currentOrganization
  const initialCustomerId = activeOrganization?.isCustomer
    ? activeOrganization.id
    : activeOrganization?.parentId ?? activeOrganization?.parent?.id ?? undefined
  const columns = useMemo(() => getPricingOptionColumns({ showCustomer: isAdminContext }), [isAdminContext])

  const openCreate = () => {
    setEditingOption(null)
    setIsDialogOpen(true)
  }

  const openEdit = (option: PricingOption) => {
    setEditingOption(option)
    setIsDialogOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Pricing options"
        subtitle="Manage pricing options across customers."
        primaryAction={session?.permissions.customers?.create
          ? { children: 'Create pricing option', onClick: openCreate }
          : undefined}
      />

      <section className="p-4 md:p-6">
        <DataTableAsync
          queryKey={[...pricingOptionsQueryKeys.all, 'table']}
          loadData={(state: DataTableState<PricingOption>) => getPricingOptionsRequest(state, !isAdminContext && initialCustomerId ? { customerId: initialCustomerId } : undefined)}
          refetchOnMount="always"
          tableKey="pricing-options.root"
          initialFilters={isAdminContext && filterCustomerId ? { customerId: [filterCustomerId] } : undefined}
          columns={columns}
          disabledSelection
          searchPlaceholder="Search by name or ID"
          searchColumns={['id', 'name']}
          filters={[
            ...(!isAdminContext ? [] : [{
              id: 'customerId',
              label: 'Customer',
              column: 'customerId' as const,
              selectionMode: 'single' as const,
              queryFn: async (search: string) => {
                const result = await getCustomersListRequest(undefined, search)
                return { items: result.map((customer) => ({ id: customer.id, label: customer.name })), total: result.length }
              },
              getValue: (option: PricingOption) => option.organizationId,
            }]),
            {
              id: 'status',
              label: 'Status',
              column: 'status' as const,
              options: statusOptions,
              getValue: (option: PricingOption) => option.status ?? (option.isDeleted ? 'DELETED' : option.isActive ? 'ACTIVE' : 'DISABLED'),
            },
          ]}
          getRowCommands={(option) => PricingOptionService.getRowActions(option, {
            canEdit: Boolean(session?.permissions.customers?.edit),
            canDelete: Boolean(session?.permissions.customers?.delete),
            onEdit: openEdit,
          })}
          loadingMessage="Loading pricing options..."
          emptyMessage="No pricing options found."
          errorMessage="Failed to load pricing options."
        />
      </section>

      <CreatePricingOptionDialog
        customerId={editingOption?.organizationId}
        initialCustomerId={initialCustomerId}
          allowCustomerSelection={isAdminContext && !editingOption}
        currency={editingOption?.currency ?? 'EUR'}
        option={editingOption ?? undefined}
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) setEditingOption(null)
        }}
      />
    </>
  )
}
