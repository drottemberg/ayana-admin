import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'

import { DetailPageLayout, DetailSidePanel, RelatedEntityModule, type DetailPageModule } from '@/components/app/detail-page-layout'
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
import { CustomerService } from '@/features/customers/customer-service'
import { getOrganizationBrandingPreviewRequest, type BrandingKind } from '@/features/organizations/organization-branding-api'

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
        header={{
          title: 'Settings',
          subtitle: customer?.name,
          primaryAction: canManageSettings ? {
            icon: PencilEdit02Icon,
            iconOnly: true,
            'aria-label': 'Edit customer branding',
            onClick: () => customer && CustomerService.showEditDrawer(customer.toCustomer()),
          } : undefined,
        }}
        modules={modules}
        aside={<DetailSidePanel sections={[{
          title: 'Customer details',
          fields: [
            { label: 'Name', value: customer?.name ?? '—' },
            { label: 'Logo', value: <BrandingPreview organizationId={customerId} kind="logo" configured={Boolean(customer?.dto.logoAttachmentId)} /> },
            { label: 'Logo icon', value: <BrandingPreview organizationId={customerId} kind="logo-icon" configured={Boolean(customer?.dto.logoIconAttachmentId)} /> },
          ],
        }]} />}
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

function BrandingPreview({ organizationId, kind, configured }: { organizationId: string; kind: BrandingKind; configured: boolean }) {
  const [url, setUrl] = useState<string>()
  const [loading, setLoading] = useState(configured)

  useEffect(() => {
    if (!configured) {
      setUrl(undefined)
      setLoading(false)
      return
    }
    let active = true
    let objectUrl: string | undefined
    setLoading(true)
    void getOrganizationBrandingPreviewRequest(organizationId, kind)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        if (active) {
          setUrl(objectUrl)
          setLoading(false)
        } else URL.revokeObjectURL(objectUrl)
      })
      .catch(() => { if (active) { setUrl(undefined); setLoading(false) } })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [configured, kind, organizationId])

  if (!configured) return <span className="text-muted-foreground">Not set</span>
  if (!url) return <span className="text-muted-foreground">{loading ? 'Loading…' : 'Preview unavailable'}</span>

  return (
    <img
      src={url}
      alt={kind === 'logo' ? 'Customer logo' : 'Customer logo icon'}
      className={kind === 'logo' ? 'ml-auto block h-10 max-w-28 rounded border bg-white object-contain p-1' : 'ml-auto block size-10 rounded border bg-white object-contain p-1'}
    />
  )
}
