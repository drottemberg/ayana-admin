import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { DetailPageLayout, RelatedEntityModule, type DetailPageModule } from '@/components/app/detail-page-layout'
import { PageHeader } from '@/components/ui/page-header'
import type { DataTableState } from '@/components/data-table'
import { EntityIcon } from '@/components/app/entity-icons'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import {
  customerSettingsQueryKeys,
  loadCustomerMessagingConfigRow,
  loadCustomerPromptProfileRow,
  type CustomerMessagingConfigRow,
  type CustomerPromptProfileRow,
  type CustomerSettingKind,
} from '@/features/customers/customer-settings-api'
import {
  customerMessagingConfigColumns,
  customerPromptProfileColumns,
} from '@/features/customers/customer-settings-columns'
import { CustomerSettingsEditDrawer } from '@/features/customers/CustomerSettingsEditDrawer'

const modules: DetailPageModule[] = [
  { key: 'messaging-config', label: 'Messaging configuration' },
  { key: 'prompt-profile', label: 'Customer prompt profile' },
]

export default function SettingsPage() {
  const { session, isLoading } = useConnect()
  const [editing, setEditing] = useState<CustomerSettingKind | null>(null)
  const customer = session?.currentOrganization
  const customerId = customer?.id ?? ''
  const canManageSettings = getAppMode() === 'customer' && Boolean(session?.permissions.organization?.editSelf)
  const editTarget = useMemo(() => editing ? { kind: editing } : null, [editing])

  if (isLoading) {
    return <PageHeader title="Settings" subtitle="Loading organization settings…" />
  }
  if (!canManageSettings || !customerId) return <Navigate to="/" replace />

  return (
    <>
      <DetailPageLayout
        header={{ title: 'Settings', subtitle: customer?.name }}
        modules={modules}
        aside={null}
      >
        <RelatedEntityModule
          id="module-messaging-config"
          title="Messaging configuration"
          icon={EntityIcon.mediaCampaigns}
          action={{ label: 'Edit configuration', onClick: () => setEditing('messaging-config') }}
          queryKey={[...customerSettingsQueryKeys.customer(customerId), 'messaging-config']}
          loadData={(state: DataTableState<CustomerMessagingConfigRow>) => loadCustomerMessagingConfigRow(customerId, state)}
          tableKey="customer.settings.messaging-config"
          columns={customerMessagingConfigColumns}
          getRowCommands={() => [{ label: 'Edit', onClick: () => setEditing('messaging-config') }]}
          pageSize={1}
          loadingMessage="Loading messaging configuration..."
          emptyMessage="No messaging configuration found."
          refetchOnMount="always"
        />
        <RelatedEntityModule
          id="module-prompt-profile"
          title="Customer prompt profile"
          icon={EntityIcon.aiSupportIssues}
          action={{ label: 'Edit profile', onClick: () => setEditing('prompt-profile') }}
          queryKey={[...customerSettingsQueryKeys.customer(customerId), 'prompt-profile']}
          loadData={(state: DataTableState<CustomerPromptProfileRow>) => loadCustomerPromptProfileRow(customerId, state)}
          tableKey="customer.settings.prompt-profile"
          columns={customerPromptProfileColumns}
          getRowCommands={() => [{ label: 'Edit', onClick: () => setEditing('prompt-profile') }]}
          pageSize={1}
          loadingMessage="Loading customer prompt profile..."
          emptyMessage="No customer prompt profile found."
          refetchOnMount="always"
        />
      </DetailPageLayout>
      <CustomerSettingsEditDrawer
        open={Boolean(editing)}
        onOpenChange={(open) => { if (!open) setEditing(null) }}
        customerId={customerId}
        customerName={customer?.name ?? 'Customer'}
        target={editTarget}
      />
    </>
  )
}
