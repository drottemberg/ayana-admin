import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import { toMedia, type MediaRecord } from '@/features/media/api'
import type {
  CreateMediaCampaignPayload,
  Media,
  MediaCampaign,
  MediaCampaignDevice,
  UpdateMediaCampaignPayload,
} from '@/types/media'

type MediaCampaignRecord = MediaCampaign
type MediaCampaignDeviceRecord = MediaCampaignDevice

const MEDIA_CAMPAIGNS_LIST_URL = '/media-campaigns/list'

function arrayToDataTableResult<T>(items: T[]): DataTableAsyncResult<T> {
  return { items, count: items.length, pageCount: 1 }
}

export async function getMediaCampaignsRequest(
  tableState: DataTableState<MediaCampaign>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<MediaCampaign>> {
  const result = await apiClient.post<ApiListResult<MediaCampaignRecord>>(
    MEDIA_CAMPAIGNS_LIST_URL,
    toApiListDto(tableState, hiddenFilters),
  )
  return toDataTableResult(result)
}

export async function getMediaCampaignDetailRequest(campaignId: string): Promise<MediaCampaign> {
  return apiClient.get<MediaCampaignRecord>(`/media-campaigns/${campaignId}`)
}

export async function getMediaCampaignMediaRequest(
  campaignId: string,
  tableState: DataTableState<Media>,
): Promise<DataTableAsyncResult<Media>> {
  void tableState
  const media = await apiClient.get<MediaRecord[]>(`/media-campaigns/${campaignId}/media`)
  return arrayToDataTableResult(media.map(toMedia))
}

export async function getMediaCampaignDevicesRequest(
  campaignId: string,
  tableState: DataTableState<MediaCampaignDevice>,
): Promise<DataTableAsyncResult<MediaCampaignDevice>> {
  void tableState
  const devices = await apiClient.get<MediaCampaignDeviceRecord[]>(`/media-campaigns/${campaignId}/devices`)
  return arrayToDataTableResult(devices)
}

export async function createMediaCampaignRequest(payload: CreateMediaCampaignPayload): Promise<MediaCampaign> {
  return apiClient.post<MediaCampaignRecord>('/media-campaigns', payload)
}

export async function updateMediaCampaignRequest(
  campaignId: string,
  payload: UpdateMediaCampaignPayload,
): Promise<MediaCampaign> {
  return apiClient.patch<MediaCampaignRecord>(`/media-campaigns/${campaignId}`, payload)
}

export async function archiveMediaCampaignRequest(campaignId: string): Promise<MediaCampaign> {
  return apiClient.post<MediaCampaignRecord>(`/media-campaigns/${campaignId}/archive`)
}

export async function unarchiveMediaCampaignRequest(campaignId: string): Promise<MediaCampaign> {
  return apiClient.post<MediaCampaignRecord>(`/media-campaigns/${campaignId}/unarchive`)
}

export async function startMediaCampaignRequest(campaignId: string): Promise<MediaCampaign> {
  return apiClient.post<MediaCampaignRecord>(`/media-campaigns/${campaignId}/start`)
}

export async function pauseMediaCampaignRequest(campaignId: string): Promise<MediaCampaign> {
  return apiClient.post<MediaCampaignRecord>(`/media-campaigns/${campaignId}/pause`)
}

export async function endMediaCampaignRequest(campaignId: string): Promise<MediaCampaign> {
  return apiClient.post<MediaCampaignRecord>(`/media-campaigns/${campaignId}/end`)
}

export async function addMediaToCampaignRequest(campaignId: string, mediaId: string): Promise<void> {
  await apiClient.post(`/media-campaigns/${campaignId}/media`, { attachmentId: mediaId })
}

export async function addDevicesToMediaCampaignRequest(campaignId: string, deviceIds: string[]): Promise<void> {
  await apiClient.post(`/media-campaigns/${campaignId}/devices`, { deviceIds })
}

export async function removeDeviceFromMediaCampaignRequest(campaignId: string, deviceId: string): Promise<void> {
  await apiClient.delete(`/media-campaigns/${campaignId}/devices/${deviceId}`)
}

export async function removeMediaFromCampaignRequest(campaignId: string, mediaId: string): Promise<void> {
  await apiClient.delete(`/media-campaigns/${campaignId}/media/${mediaId}`)
}

export async function deleteMediaCampaignRequest(campaignId: string): Promise<void> {
  await apiClient.delete(`/media-campaigns/${campaignId}`)
}
