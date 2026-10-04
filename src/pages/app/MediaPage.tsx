import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PlayCircleIcon from '@hugeicons/core-free-icons/PlayCircleIcon'
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'
import { HugeiconsIcon } from '@hugeicons/react'

import {
  type DetailPanelSection,
  DetailPageLayout,
  DetailSidePanel,
  EmptyRelatedEntityModule,
  RelatedEntityModule,
  type DetailPageModule,
} from '@/components/app/detail-page-layout'
import type { DataTableState } from '@/components/data-table'
import { EntityIcon } from '@/components/app/entity-icons'
import { InfoCard } from '@/components/app/InfoCard'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { NO_VALUE_STR } from '@/constants'
import { getMediaDetailRequest } from '@/features/media/api'
import { getMediaCampaignsRequest } from '@/features/media-campaigns/api'
import { mediaCampaignColumns } from '@/features/media-campaigns/media-campaign-columns'
import { MediaCampaignService } from '@/features/media-campaigns/media-campaign-service'
import { mediaCampaignQueryKeys } from '@/features/media-campaigns/query-keys'
import { renderMediaStatusBadge } from '@/features/media/media-columns'
import {
  MediaTags,
  formatDateTime,
  formatDuration,
  formatResolution,
  formatSizeBytes,
} from '@/features/media/components/media-ui'
import { MediaService } from '@/features/media/media-service'
import { mediaQueryKeys } from '@/features/media/query-keys'
import { useDetailQuery } from '@/lib/query-hooks'
import type { Media, MediaCampaign } from '@/types/media'

const MODULE_ANCHOR_PREFIX = 'module'
const modules: DetailPageModule[] = [{ key: 'mediaCampaigns', label: 'Media campaigns' }]

function CustomerLink({ media }: { media?: Media }) {
  if (!media?.customer?.name) return NO_VALUE_STR

  return (
    <Link to={`/customers/${media.customer.id}`} className="font-medium underline-offset-2 hover:underline">
      {media.customer.name}
    </Link>
  )
}

function getMediaDetailSections(media?: Media): DetailPanelSection[] {
  return [
    {
      title: 'Details',
      icon: EntityIcon.media,
      actions: media ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit media details"
          onClick={() => MediaService.openEditMedia(media)}
        >
          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
        </Button>
      ) : null,
      fields: [
        { label: 'Status', value: media ? renderMediaStatusBadge(media) : NO_VALUE_STR },
        { label: 'ID', value: media?.id ?? NO_VALUE_STR },
        { label: 'Name', value: media?.name ?? NO_VALUE_STR },
        { label: 'Customer', value: <CustomerLink media={media} /> },
        { label: 'Type', value: media ? MediaService.getMediaType(media) : NO_VALUE_STR },
        { label: 'Tags', value: media ? <MediaTags tags={media.tags} /> : NO_VALUE_STR },
        { label: 'File name', value: media?.fileName ?? NO_VALUE_STR },
        { label: 'Duration', value: formatDuration(media?.durationSeconds) },
        { label: 'Resolution', value: formatResolution(media?.width, media?.height) },
        { label: 'Size', value: formatSizeBytes(media?.sizeBytes) },
        { label: 'Sound track', value: media?.hasSound ? 'Yes' : 'No' },
        { label: 'Created at', value: formatDateTime(media?.createdAt) },
        { label: 'Updated at', value: formatDateTime(media?.updatedAt) },
      ],
    },
  ]
}

function MediaModulesLoading() {
  return (
    <EmptyRelatedEntityModule
      id={`${MODULE_ANCHOR_PREFIX}-mediaCampaigns`}
      title="Media campaigns"
      description="Loading..."
    />
  )
}

export default function MediaPage() {
  const { mediaId = '' } = useParams()
  const navigate = useNavigate()
  const {
    data: media,
    isLoading,
    isError,
  } = useDetailQuery({
    queryKey: mediaQueryKeys.detail(mediaId),
    queryFn: () => getMediaDetailRequest(mediaId),
    enabled: Boolean(mediaId),
  })

  if (isLoading) {
    return (
      <DetailPageLayout
        header={{ title: 'Media', subtitle: 'Loading...', backTo: '/media' }}
        modules={modules}
        aside={<DetailSidePanel sections={getMediaDetailSections()} isLoading />}
      >
        <MediaModulesLoading />
      </DetailPageLayout>
    )
  }

  if (isError || !media) {
    return (
      <>
        <PageHeader title="Media not found" subtitle={mediaId} backTo="/media" />
        <section className="p-4 md:p-6">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Failed to load this media.
          </div>
        </section>
      </>
    )
  }

  return (
    <DetailPageLayout
      header={{
        title: media.name,
        subtitle: <CustomerLink media={media} />,
        backTo: '/media',
        options: MediaService.getMediaDetailActions(media, navigate),
      }}
      modules={modules}
      aside={<DetailSidePanel sections={getMediaDetailSections(media)} />}
    >
      <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-mediaCampaigns`}
        title="Media campaigns"
        icon={EntityIcon.mediaCampaigns}
        action={{
          label: 'Create campaign',
          onClick: () =>
            MediaCampaignService.openCreateCampaign({
              customerId: media.customer?.id ? String(media.customer.id) : undefined,
              mediaId: String(media.id),
            }),
        }}
        queryKey={[...mediaCampaignQueryKeys.list(), 'media-module', media.id]}
        // Backend MediaCampaignListDto needs to honor mediaId for this module to be fully scoped.
        loadData={(state: DataTableState<MediaCampaign>) => getMediaCampaignsRequest(state, { mediaId: media.id })}
        tableKey="media.detail.modules.media-campaigns"
        columns={mediaCampaignColumns}
        loadingMessage="Loading media campaigns..."
        emptyMessage="No media campaigns found."
        refetchOnMount={false}
      />
    </DetailPageLayout>
  )
}

export function MediaDetails({ media, footerAction }: { media: Media; footerAction?: ReactNode }) {
  const rows = [
    { label: 'Name', value: media.fileName },
    { label: 'Created', value: formatDateTime(media.createdAt) },
    { label: 'Duration', value: formatDuration(media.durationSeconds) },
    { label: 'Aspect', value: media.aspectRatio ?? NO_VALUE_STR },
    { label: 'Resolution', value: formatResolution(media.width, media.height) },
    { label: 'Size', value: formatSizeBytes(media.sizeBytes) },
    { label: 'Sound track', value: media.hasSound ? 'Yes' : 'No' },
    { label: 'File URI', value: media.fileUrl, truncate: true },
  ]

  return (
    <InfoCard
      title="Media details"
      isSpaceBeetween={false}
      rows={rows}
      footerAction={footerAction}
      headerAction={
        <Button variant="outline" size="lg" onClick={() => MediaService.openPreview(media)}>
          Preview
          <HugeiconsIcon icon={PlayCircleIcon} strokeWidth={2} className="size-4" />
        </Button>
      }
    />
  )
}
