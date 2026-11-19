import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/page-header'
import { SelectInputAsync } from '@/components/ui/select-input'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { getCustomersListRequest } from '@/features/customers/api'
import { listIntegrationsRequest } from '@/features/integrations/api'
import { PartnerSettlementManager } from '@/features/integrations/PartnerSettlementManager'
import type { Customer } from '@/types/customer'
import { useState } from 'react'

export default function PartnerSettlementsPage() {
  const { session } = useConnect()
  const isAdmin = getAppMode() === 'admin'
  const activeOrg = session?.currentOrganization
  const fixedCustomerId = activeOrg?.isCustomer ? activeOrg.id : activeOrg?.parentId ?? activeOrg?.parent?.id ?? undefined
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const customerId = isAdmin ? selectedCustomerId : fixedCustomerId
  const integrationsQuery = useQuery({
    queryKey: ['partner-settlements', 'integrations', customerId],
    queryFn: () => listIntegrationsRequest(customerId!),
    enabled: Boolean(customerId),
    staleTime: 30_000,
  })
  const integrations = (integrationsQuery.data ?? []).filter((integration) =>
    !integration.isDeleted && integration.setupComplete
    && ['EGYM', 'EGYM2', 'CLASSPASS'].includes(integration.provider))

  return <>
    <PageHeader title="Partner transfers" subtitle="Record incoming partner payments and reconcile them with completed sessions." />
    <section className="space-y-5 p-4 md:p-6">
      {isAdmin ? <div className="max-w-sm">
        <SelectInputAsync<Customer>
          label="Customer"
          placeholder="Select customer"
          queryKey={customersQueryKeys.all}
          queryFn={(search) => getCustomersListRequest(undefined, search)}
          getOption={(customer) => ({ value: customer.id, label: customer.name })}
          selectedItems={selectedCustomer ? [selectedCustomer] : []}
          value={selectedCustomerId}
          onValueChange={(value) => setSelectedCustomerId(String(value))}
          onSelectedItemsChange={(items) => setSelectedCustomer(items[0] ?? null)}
        />
      </div> : null}
      {!customerId && !isAdmin ? <p className="text-sm text-muted-foreground">Select a customer organization to manage partner transfers.</p> : null}
      {isAdmin && !customerId ? <p className="text-sm text-muted-foreground">Select a customer to view its partner transfers.</p> : null}
      {integrationsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading partner integrations…</p> : null}
      {integrationsQuery.isError ? <p className="text-sm text-destructive">Could not load partner integrations.</p> : null}
      {customerId && !integrationsQuery.isLoading && !integrationsQuery.isError && !integrations.length ? <p className="text-sm text-muted-foreground">No configured EGYM or ClassPass integrations found for this customer.</p> : null}
      {integrations.map((integration) => <PartnerSettlementManager key={integration.id} customerId={integration.customerId} integrationId={integration.id} integrationName={integration.name || integration.provider} />)}
    </section>
  </>
}
