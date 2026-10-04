import { useCallback } from 'react'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { getMediaCampaignsRequest } from '@/features/media-campaigns/api'
import { getMediaCampaignColumns } from '@/features/media-campaigns/media-campaign-columns'
import { MediaCampaignService } from '@/features/media-campaigns/media-campaign-service'
import { mediaCampaignQueryKeys } from '@/features/media-campaigns/query-keys'
import type { MediaCampaign } from '@/types/media'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

export default function MediaCampaignsPage() {
  return (
    <>
      <PageHeader
        title="Media campaigns"
        primaryAction={{
          children: '+ Add Campaign',
          onClick: () => MediaCampaignService.openCreateCampaign(),
        }}
      />
      <section className="space-y-5 p-4 md:p-6">
        <MediaCampaignsList />
      </section>
    </>
  )
}

function MediaCampaignsList() {
  const portal = getPortalSafe()
  const showCustomer = portal !== Portal.CUSTOMER
  const loadCampaigns = useCallback(
    (tableState: DataTableState<MediaCampaign>) => getMediaCampaignsRequest(tableState),
    [],
  )

  return (
    <DataTableAsync
      queryKey={[...mediaCampaignQueryKeys.list(), 'table', showCustomer]}
      loadData={loadCampaigns}
      tableKey="media-campaigns.root"
      columns={getMediaCampaignColumns({ showCustomer })}
      searchPlaceholder="Search by ID, name..."
      searchColumns={['id', 'name']}
      filters={MediaCampaignService.getFilters({ showCustomer })}
      getCommands={(campaigns) => MediaCampaignService.getTableActions(campaigns)}
      getRowCommands={(campaign) => MediaCampaignService.getActions(campaign)}
      loadingMessage="Loading media campaigns..."
      emptyMessage="No media campaigns found."
      errorMessage="Failed to load media campaigns."
    />
  )
}
