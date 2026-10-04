import { Link, useNavigate, useParams } from 'react-router-dom'
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'

import type { DataTableState } from '@/components/data-table'
import {
  type DetailPanelSection,
  DetailPageLayout,
  DetailSidePanel,
  EmptyRelatedEntityModule,
  RelatedEntityModule,
  type DetailPageModule,
} from '@/components/app/detail-page-layout'
import { EntityIcon } from '@/components/app/entity-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { NO_VALUE_STR } from '@/constants'
import {
  getMediaCampaignDetailRequest,
  getMediaCampaignDevicesRequest,
  getMediaCampaignMediaRequest,
} from '@/features/media-campaigns/api'
import { renderCampaignStatus } from '@/features/media-campaigns/media-campaign-columns'
import { MediaCampaignService } from '@/features/media-campaigns/media-campaign-service'
import { mediaCampaignQueryKeys } from '@/features/media-campaigns/query-keys'
import { getMediaColumns } from '@/features/media/media-columns'
import { MediaService } from '@/features/media/media-service'
import { useDetailQuery } from '@/lib/query-hooks'
import { NotFoundPage } from '@/pages/NotFoundPage'
import type { Media, MediaCampaign, MediaCampaignDevice } from '@/types/media'
import { DateUtils } from '@/utils'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

const MODULE_ANCHOR_PREFIX = 'module'
const modules: DetailPageModule[] = [
  { key: 'media', label: 'Media' },
  { key: 'devices', label: 'Devices' },
]

const campaignDeviceColumns: ColumnDef<MediaCampaignDevice>[] = [
  {
    accessorKey: 'deviceId',
    header: 'Device',
    cell: ({ row }) => row.original.deviceId || NO_VALUE_STR,
  },
  {
    accessorKey: 'syncStatus',
    header: 'Sync status',
    cell: ({ row }) => {
      const status = row.original.syncStatus ?? 'pending'

      return (
        <Badge variant="outline" className="bg-muted text-foreground">
          <span className="capitalize">{status.replaceAll('_', ' ')}</span>
        </Badge>
      )
    },
  },
  {
    accessorKey: 'progress',
    header: 'Progress',
    cell: ({ row }) => `${row.original.progress ?? 0}%`,
  },
  {
    accessorKey: 'assignedAt',
    header: 'Assigned at',
    cell: ({ row }) => DateUtils.formatDateTime(row.original.assignedAt, NO_VALUE_STR),
  },
]

function CustomerLink({ campaign }: { campaign?: MediaCampaign }) {
  if (!campaign?.customer?.name) return NO_VALUE_STR

  return (
    <Link to={`/customers/${campaign.customer.id}`} className="font-medium underline-offset-2 hover:underline">
      {campaign.customer.name}
    </Link>
  )
}

function getCampaignDetailSections(campaign?: MediaCampaign): DetailPanelSection[] {
  return [
    {
      title: 'Details',
      icon: EntityIcon.mediaCampaigns,
      actions: campaign ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit media campaign details"
          onClick={() => MediaCampaignService.openEditCampaign(campaign)}
        >
          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
        </Button>
      ) : null,
      fields: [
        { label: 'Status', value: campaign ? renderCampaignStatus(campaign) : NO_VALUE_STR },
        { label: 'ID', value: campaign?.id ?? NO_VALUE_STR },
        { label: 'Name', value: campaign?.name ?? NO_VALUE_STR },
        { label: 'Customer', value: <CustomerLink campaign={campaign} /> },
        { label: 'Priority', value: campaign?.priority ?? 0 },
        { label: 'Start at', value: DateUtils.formatDateTime(campaign?.startAt, NO_VALUE_STR) },
        { label: 'End at', value: DateUtils.formatDateTime(campaign?.endAt, NO_VALUE_STR) },
        { label: 'Created at', value: DateUtils.formatDateTime(campaign?.createdAt, NO_VALUE_STR) },
        { label: 'Updated at', value: DateUtils.formatDateTime(campaign?.updatedAt, NO_VALUE_STR) },
      ],
    },
  ]
}

function CampaignModulesLoading() {
  return (
    <>
      <EmptyRelatedEntityModule id={`${MODULE_ANCHOR_PREFIX}-media`} title="Media" description="Loading..." />
      <EmptyRelatedEntityModule id={`${MODULE_ANCHOR_PREFIX}-devices`} title="Devices" description="Loading..." />
    </>
  )
}

export default function MediaCampaignPage() {
  const { campaignId = '' } = useParams()
  const navigate = useNavigate()
  const portal = getPortalSafe()
  const {
    data: campaign,
    isLoading,
    isError,
  } = useDetailQuery({
    queryKey: mediaCampaignQueryKeys.detail(campaignId),
    queryFn: () => getMediaCampaignDetailRequest(campaignId),
    enabled: Boolean(campaignId) && portal !== Portal.OPS,
  })

  if (portal === Portal.OPS) {
    return <NotFoundPage />
  }

  if (isLoading) {
    return (
      <DetailPageLayout
        header={{ title: 'Media campaign', subtitle: 'Loading...', backTo: '/media-campaigns' }}
        modules={modules}
        aside={<DetailSidePanel sections={getCampaignDetailSections()} isLoading />}
      >
        <CampaignModulesLoading />
      </DetailPageLayout>
    )
  }

  if (isError || !campaign) {
    return (
      <>
        <PageHeader title="Media campaign not found" subtitle={campaignId} backTo="/media-campaigns" />
        <section className="p-4 md:p-6">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Failed to load this media campaign.
          </div>
        </section>
      </>
    )
  }

  return (
    <DetailPageLayout
      header={{
        title: campaign.name,
        subtitle: <CustomerLink campaign={campaign} />,
        backTo: '/media-campaigns',
        options: MediaCampaignService.getDetailActions(campaign, navigate),
      }}
      modules={modules}
      aside={<DetailSidePanel sections={getCampaignDetailSections(campaign)} />}
    >
      <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-media`}
        title="Media"
        icon={EntityIcon.media}
        action={{ label: 'Add media', onClick: () => void MediaCampaignService.addMedia(campaign) }}
        queryKey={[...mediaCampaignQueryKeys.detail(campaign.id), 'media']}
        loadData={(state: DataTableState<Media>) => getMediaCampaignMediaRequest(campaign.id, state)}
        tableKey="media-campaigns.detail.media"
        columns={getMediaColumns({ showCustomer: false })}
        getRowCommands={(media) => MediaService.getMediaActions(media)}
        loadingMessage="Loading media..."
        emptyMessage="No media found."
        refetchOnMount={false}
      />
      <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-devices`}
        title="Devices"
        icon={EntityIcon.devices}
        action={{ label: 'Add devices', onClick: () => void MediaCampaignService.addDevices(campaign) }}
        queryKey={[...mediaCampaignQueryKeys.detail(campaign.id), 'devices']}
        loadData={(state: DataTableState<MediaCampaignDevice>) => getMediaCampaignDevicesRequest(campaign.id, state)}
        tableKey="media-campaigns.detail.devices"
        columns={campaignDeviceColumns}
        loadingMessage="Loading devices..."
        emptyMessage="No devices found."
        refetchOnMount={false}
      />
    </DetailPageLayout>
  )
}
