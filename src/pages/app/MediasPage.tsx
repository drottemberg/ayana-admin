import { useCallback } from 'react'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { getMediaRequest } from '@/features/media/api'
import { getMediaColumns } from '@/features/media/media-columns'
import { MediaService } from '@/features/media/media-service'
import { mediaQueryKeys } from '@/features/media/query-keys'
import { NotFoundPage } from '@/pages/NotFoundPage'
import type { Media } from '@/types/media'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

export default function MediasPage() {
  const portal = getPortalSafe()

  if (portal === Portal.OPS) {
    return <NotFoundPage />
  }

  return (
    <>
      <PageHeader
        title="Media"
        primaryAction={{
          children: '+ Add Media',
          onClick: () => MediaService.openCreateMedia(),
        }}
      />
      <section className="space-y-5 p-4 md:p-6">
        <MediaList />
      </section>
    </>
  )
}

export function MediaList({
  hiddenFilters,
  tableKey = 'media.root',
}: {
  hiddenFilters?: Record<string, unknown>
  tableKey?: string
}) {
  const portal = getPortalSafe()
  const showCustomer = portal !== Portal.CUSTOMER
  const loadMedia = useCallback(
    (tableState: DataTableState<Media>) => getMediaRequest(tableState, hiddenFilters),
    [hiddenFilters],
  )

  return (
    <DataTableAsync
      queryKey={[...mediaQueryKeys.list(), 'table', hiddenFilters, showCustomer]}
      loadData={loadMedia}
      tableKey={tableKey}
      columns={getMediaColumns({ showCustomer })}
      searchPlaceholder="Search by ID, name..."
      searchColumns={['id', 'name']}
      filters={MediaService.getMediaFilters({ showCustomer })}
      getCommands={(media) => MediaService.getMediaTableActions(media)}
      getRowCommands={(media) => MediaService.getMediaActions(media)}
      loadingMessage="Loading media..."
      emptyMessage="No media found."
      errorMessage="Failed to load media."
    />
  )
}
