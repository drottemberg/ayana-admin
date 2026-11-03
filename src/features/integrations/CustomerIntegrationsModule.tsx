import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { DataTableState } from '@/components/data-table'
import { RelatedEntityModule } from '@/components/app/detail-page-layout'
import { EntityIcon } from '@/components/app/entity-icons'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { Modals } from '@/providers/modal'
import { queryClient } from '@/lib/query-client'
import { deleteIntegrationRequest, loadIntegrationRows, setIntegrationEnabledRequest, type CustomerIntegration } from './api'
import { getIntegrationColumns } from './integration-columns'
import { IntegrationEditDrawer } from './IntegrationEditDrawer'
import { ClassPassSetupDrawer } from './ClassPassSetupDrawer'

export function CustomerIntegrationsModule({ customerId, canCreate, canEdit, canDelete }: { customerId: string; canCreate: boolean; canEdit: boolean; canDelete: boolean }) {
  const [integration, setIntegration] = useState<CustomerIntegration | null>(null)
  const [setupIntegration, setSetupIntegration] = useState<CustomerIntegration | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [fullHistoryMode, setFullHistoryMode] = useState(false)
  const openSetup = useCallback((row: CustomerIntegration, preview = false, fullHistory = false) => { setSetupIntegration(row); setPreviewMode(preview); setFullHistoryMode(fullHistory); setSetupOpen(true) }, [])
  const openCreate = () => { setIntegration(null); setDrawerOpen(true) }
  const openEdit = (row: CustomerIntegration) => { setIntegration(row); setDrawerOpen(true) }
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
      { label: 'Edit', onClick: () => openEdit(row) },
      ...(row.setupComplete ? [{ label: 'Edit setup', onClick: () => openSetup(row) }] : []),
      ...(row.setupComplete ? [{ label: 'Preview and sync', onClick: () => openSetup(row, true) }] : []),
      ...(row.setupComplete && row.isEnabled ? [{ label: 'Resync all history', onClick: () => openSetup(row, true, true) }] : []),
      { label: row.isEnabled ? 'Disable' : 'Enable', onClick: () => void toggle(row) },
    ] : []),
    ...(canDelete ? [{ label: 'Delete', variant: 'destructive' as const, onClick: () => void remove(row) }] : []),
  ]
  const columns = useMemo(() => getIntegrationColumns(canEdit ? (row) => openSetup(row) : undefined), [canEdit, openSetup])
  const loadData = async (state: DataTableState<CustomerIntegration>) => loadIntegrationRows(customerId, state)

  return <>
    <RelatedEntityModule
      id="module-integrations"
      title="Integrations"
      icon={EntityIcon.devices}
      action={canCreate ? { label: 'Add integration', onClick: openCreate } : undefined}
      queryKey={['integrations', customerId]}
      loadData={loadData}
      tableKey="customers.detail.modules.integrations"
      columns={columns}
      getRowCommands={getRowCommands}
      loadingMessage="Loading integrations..."
      emptyMessage="No integrations added yet."
      refetchOnMount={false}
      showPagination
    />
    <IntegrationEditDrawer customerId={customerId} integration={integration} open={drawerOpen} onOpenChange={setDrawerOpen} onSaved={() => { setDrawerOpen(false); void refresh() }} />
    <ClassPassSetupDrawer customerId={customerId} integration={setupIntegration} open={setupOpen} startAtPreview={previewMode} fullHistory={fullHistoryMode} onOpenChange={setSetupOpen} onSaved={() => { setSetupOpen(false); void refresh() }} />
  </>
}
