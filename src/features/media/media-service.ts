import type { DataTableFilter } from '@/components/data-table'
import type { DataTableCommand } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { deleteMediaRequest } from '@/features/media/api'
import { MediaCampaignService } from '@/features/media-campaigns/media-campaign-service'
import { mediaQueryKeys } from '@/features/media/query-keys'
import { queryClient } from '@/lib/query-client'
import { Drawer, DrawerId } from '@/providers/drawer'
import { Modals } from '@/providers/modal'
import { ModalId } from '@/providers/modal-ids'
import type { Media } from '@/types/media'
import { NO_VALUE_STR } from '@/constants'
import type { NavigateFunction } from 'react-router-dom'

export const MediaService = {
  getMediaFilters({ showCustomer = true }: { showCustomer?: boolean } = {}): DataTableFilter<Media>[] {
    return [
      {
        id: 'status',
        label: 'Status',
        column: 'status',
        getValue: (media) => media.status ?? 'active',
      },
      ...(showCustomer
        ? [
            {
              id: 'customerId',
              label: 'Customer',
              column: 'customer',
              getValue: (media: Media) => media.customer?.name || NO_VALUE_STR,
            } satisfies DataTableFilter<Media>,
          ]
        : []),
      {
        id: 'type',
        label: 'Type',
        column: 'type',
        getValue: (media) => this.getMediaType(media),
      },
    ]
  },

  openCreateMedia(customerId?: string) {
    Drawer.show(DrawerId.CreateMedia, { customerId })
  },

  openEditMedia(media: Media) {
    Drawer.show(DrawerId.EditMedia, { media })
  },

  openPreview(media: Media) {
    Modals.show(ModalId.MediaPreview, { media })
  },

  getMediaType(media: Media) {
    if (media.type) return media.type
    return media.mimeType?.split('/')[0] || NO_VALUE_STR
  },

  getMediaStatus(media: Media) {
    return media.status ?? 'active'
  },

  async deleteMediaItems(mediaItems: Media[]) {
    if (!mediaItems.length) return false

    const confirmed = await Modals.confirm({
      operation:
        mediaItems.length === 1 ? `delete media "${mediaItems[0].name}"` : `delete ${mediaItems.length} media item(s)`,
      okButtonProps: { variant: 'destructive' },
    })
    if (!confirmed) return false

    await deleteMediaRequest(mediaItems.map((m) => String(m.id)))
    await queryClient.invalidateQueries({ queryKey: mediaQueryKeys.all })
    return true
  },

  getMediaTableActions(media: Media[]): DataTableCommand<Media>[] {
    return [
      {
        label: 'Delete',
        disabled: !media.length,
        variant: 'destructive',
        onClick: (selectedMedia) => void this.deleteMediaItems(selectedMedia),
      },
    ]
  },

  getMediaActions(media: Media): DropdownActionItem[] {
    return [
      {
        label: 'Edit',
        onClick: () => this.openEditMedia(media),
      },
      {
        label: 'Delete',
        variant: 'destructive',
        onClick: () => void this.deleteMediaItems([media]),
      },
    ]
  },

  getMediaDetailActions(media: Media, navigate?: NavigateFunction): DropdownActionItem[] {
    return [
      {
        label: 'Create campaign',
        onClick: () =>
          MediaCampaignService.openCreateCampaign({
            customerId: media.customer?.id ? String(media.customer.id) : undefined,
            mediaId: String(media.id),
          }),
      },
      {
        label: 'Assign to campaign',
        onClick: () => void MediaCampaignService.assignMediaToCampaign(media),
      },
      { type: 'separator', key: 'media-campaign-separator' },
      {
        label: 'Edit',
        onClick: () => this.openEditMedia(media),
      },
      {
        label: 'Delete',
        variant: 'destructive',
        onClick: () => {
          void this.deleteMediaItems([media]).then((deleted) => {
            if (deleted) navigate?.('/media')
          })
        },
      },
    ]
  },
}
