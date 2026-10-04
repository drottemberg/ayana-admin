import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import type {
  CreateMediaPayload,
  Media,
  UpdateMediaPayload,
} from '@/types/media'

type TagRecord = string | { name?: string | null; id?: string | null }
export type MediaRecord = Partial<Omit<Media, 'tags'>> & {
  id: string
  name: string
  tags?: TagRecord[] | null
  url?: string | null
  thumbUrl?: string | null
  size?: number | string | null
  duration?: number | string | null
  ratio?: number | string | null
}

const MEDIA_LIST_URL = '/media/list'

type MediaPayloadDto = {
  name: string
  customerId?: string
  tags?: string[]
  fileName?: string
  fileUrl?: string
  mimeType?: string
  sizeBytes?: number
  hasSound: boolean
}

function toMediaPayloadDto(payload: CreateMediaPayload | UpdateMediaPayload): MediaPayloadDto {
  const file = 'file' in payload ? payload.file : undefined

  return {
    name: payload.name,
    customerId: payload.customerId,
    tags: payload.tags,
    fileName: file?.name,
    fileUrl: undefined,
    mimeType: file?.type || undefined,
    sizeBytes: file?.size,
    hasSound: payload.hasSound ?? false,
  }
}

function toTagName(tag: TagRecord): string {
  return typeof tag === 'string' ? tag : (tag.name ?? tag.id ?? '')
}

function toTagNames(tags?: TagRecord[] | null): string[] {
  return tags?.map(toTagName).filter(Boolean) ?? []
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return undefined
}

export function toMedia(record: MediaRecord): Media {
  const ratio = toNumber(record.ratio)

  return {
    id: record.id,
    name: record.name,
    status: record.status,
    type: record.type,
    customer: record.customer,
    tags: toTagNames(record.tags),
    fileName: record.fileName ?? record.name,
    fileUrl: record.fileUrl ?? record.url ?? '',
    mimeType: record.mimeType ?? '',
    sizeBytes: record.sizeBytes ?? toNumber(record.size) ?? 0,
    durationSeconds: record.durationSeconds ?? toNumber(record.duration),
    width: record.width,
    height: record.height,
    aspectRatio: record.aspectRatio ?? (ratio ? String(ratio) : undefined),
    hasSound: record.hasSound,
    thumbnailUrl: record.thumbnailUrl ?? record.thumbUrl,
    createdAt: record.createdAt ?? '',
    updatedAt: record.updatedAt,
  }
}

export function toMediaTableResult(result: ApiListResult<MediaRecord>): DataTableAsyncResult<Media> {
  return toDataTableResult({
    ...result,
    items: result.items.map(toMedia),
  })
}

export const mediaListConfig = {
  url: MEDIA_LIST_URL,
  toPayload: toApiListDto<Media>,
  toResult: (result: ApiListResult<unknown>) => toMediaTableResult(result as ApiListResult<MediaRecord>),
}

export async function getMediaRequest(
  tableState: DataTableState<Media>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<Media>> {
  const result = await apiClient.post<ApiListResult<MediaRecord>>(
    mediaListConfig.url,
    mediaListConfig.toPayload(tableState, hiddenFilters),
  )
  return toMediaTableResult(result)
}

export async function getMediaDetailRequest(mediaId: string): Promise<Media> {
  return toMedia(await apiClient.get<MediaRecord>(`/media/${mediaId}`))
}

export async function getMediaTagsRequest(): Promise<string[]> {
  return apiClient.get<string[]>('/media/tags')
}

export async function createMediaRequest(payload: CreateMediaPayload): Promise<Media> {
  return toMedia(await apiClient.post<MediaRecord>('/media', toMediaPayloadDto(payload)))
}

export async function updateMediaRequest(mediaId: string, payload: UpdateMediaPayload): Promise<Media> {
  return toMedia(await apiClient.patch<MediaRecord>(`/media/${mediaId}`, toMediaPayloadDto(payload)))
}

export async function deleteMediaRequest(mediaIds: string[]): Promise<void> {
  await Promise.all(mediaIds.map((mediaId) => apiClient.delete(`/media/${mediaId}`)))
}
