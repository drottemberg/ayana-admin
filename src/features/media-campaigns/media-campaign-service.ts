import type { DataTableAsyncResult, DataTableCommand, DataTableFilter, DataTableState } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { getDevicesRequest } from '@/features/devices/api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { getMediaRequest } from '@/features/media/api'
import { mediaQueryKeys } from '@/features/media/query-keys'
import {
  addDevicesToMediaCampaignRequest,
  addMediaToCampaignRequest,
  archiveMediaCampaignRequest,
  deleteMediaCampaignRequest,
  endMediaCampaignRequest,
  getMediaCampaignsRequest,
  pauseMediaCampaignRequest,
  startMediaCampaignRequest,
  unarchiveMediaCampaignRequest,
} from '@/features/media-campaigns/api'
import { mediaCampaignQueryKeys } from '@/features/media-campaigns/query-keys'
import { NO_VALUE_STR } from '@/constants'
import { queryClient } from '@/lib/query-client'
import { Drawer, DrawerId } from '@/providers/drawer'
import { Modals } from '@/providers/modal'
import { ModalId } from '@/providers/modal-ids'
import type { SelectTableRow } from '@/providers/modal-types'
import type { MediaCampaign } from '@/types/media'
import type { ColumnDef } from '@tanstack/react-table'
import type { NavigateFunction } from 'react-router-dom'
import { toast } from 'sonner'

const selectColumns: ColumnDef<SelectTableRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'id', header: 'ID' },
]

const toSelectLoader =
  <T extends SelectTableRow>(loader: (state: DataTableState<T>) => Promise<DataTableAsyncResult<T>>) =>
  (state: DataTableState<SelectTableRow>) =>
    loader(state as DataTableState<T>) as Promise<DataTableAsyncResult<SelectTableRow>>

function getSelectedRows(selected: unknown): SelectTableRow[] {
  return Array.isArray(selected) ? selected : []
}

function isCampaignRunning(campaign: MediaCampaign) {
  return ['STARTED', 'DOWNLOADING', 'ACTIVE', 'FAILED'].includes(String(campaign.status).toUpperCase())
}

export const MediaCampaignService = {
  getFilters({ showCustomer = true }: { showCustomer?: boolean } = {}): DataTableFilter<MediaCampaign>[] {
    return [
      {
        id: 'status',
        label: 'Status',
        column: 'status',
        getValue: (campaign) => campaign.status ?? 'draft',
      },
      ...(showCustomer
        ? [
            {
              id: 'customerId',
              label: 'Customer',
              column: 'customer',
              getValue: (campaign: MediaCampaign) => campaign.customer?.name || NO_VALUE_STR,
            } satisfies DataTableFilter<MediaCampaign>,
          ]
        : []),
    ]
  },

  openCreateCampaign(props: { customerId?: string; mediaId?: string } = {}) {
    Drawer.show(DrawerId.MediaCampaign, props)
  },

  openEditCampaign(campaign: MediaCampaign) {
    Drawer.show(DrawerId.MediaCampaign, { campaign })
  },

  async refresh(campaignId?: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: mediaCampaignQueryKeys.all }),
      campaignId
        ? queryClient.invalidateQueries({ queryKey: mediaCampaignQueryKeys.detail(campaignId) })
        : Promise.resolve(),
    ])
  },

  async deleteCampaigns(campaigns: MediaCampaign[], options: { onDeleted?: () => Promise<void> | void } = {}) {
    if (!campaigns.length) return false

    const confirmed = await Modals.confirm({
      operation:
        campaigns.length === 1 ? `delete campaign "${campaigns[0].name}"` : `delete ${campaigns.length} campaign(s)`,
      okButtonProps: { variant: 'destructive' },
    })
    if (!confirmed) return false

    await Promise.all(campaigns.map((campaign) => deleteMediaCampaignRequest(campaign.id)))
    await this.refresh()
    await options.onDeleted?.()
    return true
  },

  async setArchived(campaign: MediaCampaign, isArchived: boolean) {
    if (isArchived) {
      await archiveMediaCampaignRequest(campaign.id)
    } else {
      await unarchiveMediaCampaignRequest(campaign.id)
    }
    await this.refresh(campaign.id)
  },

  async setRunning(campaign: MediaCampaign, running: boolean) {
    if (running) {
      await startMediaCampaignRequest(campaign.id)
    } else {
      await pauseMediaCampaignRequest(campaign.id)
    }
    await this.refresh(campaign.id)
  },

  async end(campaign: MediaCampaign) {
    await endMediaCampaignRequest(campaign.id)
    await this.refresh(campaign.id)
  },

  async addDevices(campaign: MediaCampaign) {
    const selected = await Modals.show(ModalId.SelectTableData, {
      title: 'Add devices',
      queryKey: [...devicesQueryKeys.all, 'select-for-media-campaign', campaign.id],
      loadData: toSelectLoader((state) => getDevicesRequest(state)),
      columns: selectColumns,
      searchPlaceholder: 'Search by ID, name...',
      searchColumns: ['id', 'name'],
      tableKey: 'media-campaigns.add-devices',
      loadingMessage: 'Loading devices...',
      emptyMessage: 'No devices found.',
      submitLabel: 'Add',
    })
    const deviceIds = getSelectedRows(selected)
      .map((device) => device.id)
      .filter((id): id is string => typeof id === 'string')
    if (!deviceIds.length) return

    await addDevicesToMediaCampaignRequest(campaign.id, deviceIds)
    await this.refresh(campaign.id)
    toast.success(deviceIds.length === 1 ? 'Device added to campaign.' : 'Devices added to campaign.')
  },

  async addMedia(campaign: MediaCampaign) {
    const selected = await Modals.show(ModalId.SelectTableData, {
      title: 'Add media',
      queryKey: [...mediaQueryKeys.all, 'select-for-media-campaign', campaign.id],
      loadData: toSelectLoader((state) => getMediaRequest(state)),
      columns: selectColumns,
      searchPlaceholder: 'Search by ID, name...',
      searchColumns: ['id', 'name'],
      tableKey: 'media-campaigns.add-media',
      loadingMessage: 'Loading media...',
      emptyMessage: 'No media found.',
      submitLabel: 'Add',
    })
    const mediaIds = getSelectedRows(selected)
      .map((media) => media.id)
      .filter((id): id is string => typeof id === 'string')
    if (!mediaIds.length) return

    await Promise.all(mediaIds.map((mediaId) => addMediaToCampaignRequest(campaign.id, mediaId)))
    await this.refresh(campaign.id)
    toast.success(mediaIds.length === 1 ? 'Media added to campaign.' : 'Media added to campaign.')
  },

  async assignMediaToCampaign(media: { id: string; customer?: { id?: string | number | null } | null }) {
    const selected = await Modals.show(ModalId.SelectTableData, {
      title: 'Assign to campaign',
      queryKey: [...mediaCampaignQueryKeys.all, 'select-for-media', media.id],
      loadData: toSelectLoader((state) =>
        getMediaCampaignsRequest(state, media.customer?.id ? { customerId: String(media.customer.id) } : undefined),
      ),
      columns: selectColumns,
      searchPlaceholder: 'Search by ID, name...',
      searchColumns: ['id', 'name'],
      tableKey: 'media-campaigns.assign-media',
      loadingMessage: 'Loading campaigns...',
      emptyMessage: 'No campaigns found.',
      submitLabel: 'Assign',
    })
    const campaignIds = getSelectedRows(selected)
      .map((campaign) => campaign.id)
      .filter((id): id is string => typeof id === 'string')
    if (!campaignIds.length) return

    await Promise.all(campaignIds.map((campaignId) => addMediaToCampaignRequest(campaignId, media.id)))
    await this.refresh()
    toast.success(campaignIds.length === 1 ? 'Media assigned to campaign.' : 'Media assigned to campaigns.')
  },

  getTableActions(campaigns: MediaCampaign[]): DataTableCommand<MediaCampaign>[] {
    return [
      {
        label: 'Destroy',
        disabled: !campaigns.length,
        variant: 'destructive',
        onClick: (selectedCampaigns) => void this.deleteCampaigns(selectedCampaigns),
      },
    ]
  },

  getActions(campaign: MediaCampaign, navigate?: NavigateFunction): DropdownActionItem[] {
    const isRunning = isCampaignRunning(campaign)

    return [
      {
        label: 'Edit',
        onClick: () => this.openEditCampaign(campaign),
      },
      {
        label: campaign.isArchived ? 'Unarchive' : 'Archive',
        onClick: () => void this.setArchived(campaign, !campaign.isArchived),
      },
      {
        label: 'Destroy',
        variant: 'destructive',
        onClick: () => {
          void this.deleteCampaigns([campaign], { onDeleted: () => navigate?.('/media-campaigns') })
        },
      },
      {
        label: isRunning ? 'Disable' : 'Enable',
        onClick: () => void this.setRunning(campaign, !isRunning),
      },
    ]
  },

  getDetailActions(campaign: MediaCampaign, navigate?: NavigateFunction): DropdownActionItem[] {
    const isRunning = isCampaignRunning(campaign)

    return [
      {
        label: isRunning ? 'Pause' : 'Start',
        onClick: () => void this.setRunning(campaign, !isRunning),
      },
      {
        label: 'Add devices',
        onClick: () => void this.addDevices(campaign),
      },
      {
        label: 'Add media',
        onClick: () => void this.addMedia(campaign),
      },
      { type: 'separator', key: 'campaign-separator' },
      ...this.getActions(campaign, navigate),
      {
        label: 'End',
        onClick: () => void this.end(campaign),
      },
    ]
  },
}
