import { useCallback, useMemo, useState } from 'react'
import type { DataTableFilter, DataTableState } from '@/components/data-table'
import { DataTableAsync } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { Modals } from '@/providers/modal'
import { toast } from 'sonner'
import { queryClient } from '@/lib/query-client'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import {
  deleteIntegrationRequest,
  loadIntegrationRows,
  setIntegrationEnabledRequest,
  type CustomerIntegration,
} from '@/features/integrations/api'
import { getIntegrationColumns } from '@/features/integrations/integration-columns'
import { IntegrationEditDrawer } from '@/features/integrations/IntegrationEditDrawer'
import { ClassPassSetupDrawer } from '@/features/integrations/ClassPassSetupDrawer'

export default function IntegrationsPage() {
  const { session } = useConnect()
  const customerId = session?.currentOrganization?.isCustomer ? session.currentOrganization.id : ''
  const canCreate = Boolean(session?.permissions.integrations?.create)
  const canEdit = Boolean(session?.permissions.integrations?.edit)
  const canDelete = Boolean(session?.permissions.integrations?.delete)
  const [integration, setIntegration] = useState<CustomerIntegration | null>(null)
  const [setupIntegration, setSetupIntegration] = useState<CustomerIntegration | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [fullHistoryMode, setFullHistoryMode] = useState(false)
  const openSetup = useCallback((row: CustomerIntegration, preview = false, fullHistory = false) => { setSetupIntegration(row); setPreviewMode(preview); setFullHistoryMode(fullHistory); setSetupOpen(true) }, [])
  const columns = useMemo(() => getIntegrationColumns(canEdit ? (row) => openSetup(row) : undefined), [canEdit, openSetup])
  const loadData = useCallback((state: DataTableState<CustomerIntegration>) => loadIntegrationRows(customerId, state), [customerId])
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['integrations', customerId] }) }

  const toggle = async (row: CustomerIntegration) => {
    try {
      await setIntegrationEnabledRequest(customerId, row.id, !row.isEnabled)
      await refresh()
      toast.success(row.isEnabled ? 'Integration disabled.' : 'Integration enabled.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update integration.') }
  }
  const remove = async (row: CustomerIntegration) => {
    const confirmed = await Modals.confirm({ operation: `delete integration “${row.name}”`, okButtonProps: { variant: 'destructive' } })
    if (!confirmed) return
    try {
      await deleteIntegrationRequest(customerId, row.id)
      await refresh()
      toast.success('Integration deleted.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not delete integration.') }
  }
  const getRowCommands = (row: CustomerIntegration): DropdownActionItem[] => [
    ...(canEdit ? [
      { label: 'Edit', onClick: () => { setIntegration(row); setDrawerOpen(true) } },
      ...(row.setupComplete ? [{ label: 'Edit setup', onClick: () => openSetup(row) }] : []),
      ...(row.setupComplete ? [{ label: 'Preview and sync', onClick: () => openSetup(row, true) }] : []),
      ...(row.setupComplete && row.isEnabled ? [{ label: 'Resync all history', onClick: () => openSetup(row, true, true) }] : []),
      { label: row.isEnabled ? 'Disable' : 'Enable', onClick: () => void toggle(row) },
    ] : []),
    ...(canDelete ? [{ label: 'Delete', variant: 'destructive' as const, onClick: () => void remove(row) }] : []),
  ]
  const filters: DataTableFilter<CustomerIntegration>[] = [
    { id: 'status', label: 'Status', column: 'isEnabled', options: ['Enabled', 'Disabled'], getValue: (row) => row.isEnabled ? 'Enabled' : 'Disabled' },
  ]

  if (getAppMode() === 'admin') {
    return <><PageHeader title="Integrations" subtitle="Open a customer profile to manage its integrations." /></>
  }

  if (!customerId) {
    return <><PageHeader title="Integrations" subtitle="Select an active customer to manage its integrations." /></>
  }

  return <>
    <PageHeader
      title="Integrations"
      subtitle="Connect external booking services to your locations."
      primaryAction={canCreate && customerId ? { children: 'Add integration', onClick: () => { setIntegration(null); setDrawerOpen(true) } } : undefined}
    />
    <section className="space-y-4 p-4 md:p-6">
      <DataTableAsync
        key={customerId || 'integrations'}
        queryKey={['integrations', customerId]}
        loadData={loadData}
        refetchOnMount="always"
        tableKey="integrations.customer"
        columns={columns}
        searchPlaceholder="Search integrations"
        searchColumns={['name', 'provider', 'username']}
        filters={filters}
        getRowCommands={getRowCommands}
        loadingMessage="Loading integrations..."
        emptyMessage="No integrations added yet."
        errorMessage="Could not load integrations."
      />
    </section>
    {customerId ? <IntegrationEditDrawer customerId={customerId} integration={integration} open={drawerOpen} onOpenChange={setDrawerOpen} onSaved={() => { setDrawerOpen(false); void refresh() }} /> : null}
    {customerId ? <ClassPassSetupDrawer customerId={customerId} integration={setupIntegration} open={setupOpen} startAtPreview={previewMode} fullHistory={fullHistoryMode} onOpenChange={setSetupOpen} onSaved={() => { setSetupOpen(false); void refresh() }} /> : null}
  </>
}
