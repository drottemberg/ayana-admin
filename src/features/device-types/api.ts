import { apiClient } from '@/lib/api-client'
import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { SortOrder, toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'

export type VariableEntry = {
  key: string
  group?: string
  label: string
  unit?: string
  type: 'float' | 'integer' | 'string' | 'boolean'
  position?: number
  display?: boolean
  editable?: boolean
  write?: {
    topic?: string
    payloadGroup?: string
    payloadKey?: string
    payload?: unknown
    refreshCommand?: string
    confirm?: {
      source?: 'status' | 'info' | 'setup'
      group?: string
      key?: string
    }
    timeoutMs?: number
  }
}

export type DeviceTypeCommandDefinition = {
  topic: string
  payload: Record<string, unknown>
  qos?: 0 | 1
}

export type VariableMapping = {
  status?: VariableEntry[]
  info?: VariableEntry[]
  setup?: VariableEntry[]
}

export type DeviceTypeConfig = {
  id: string
  code: string
  name: string
  groupId: string
  group?: { id: string; name: string } | null
  status?: 'ACTIVE' | 'DISABLED'
  isArchived?: boolean
  isDeleted?: boolean
  hardwareVersion?: string | null
  mqttTopicPrefix?: string | null
  payloadTemplate?: Record<string, unknown> | null
  variableMapping: VariableMapping
  commands?: Record<string, DeviceTypeCommandDefinition> | null
  deviceCount?: number
  documentationCount?: number
  createdAt: string
  updatedAt: string
}

export type DeviceTypeAttachment = {
  id: string
  objectId?: string | null
  objectType?: string | null
  name?: string | null
  type?: string | null
  url?: string | null
  mimeType?: string | null
  extension?: string | null
  size?: number | string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export const DeviceTypeStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
} as const

export type DeviceTypeStatus = (typeof DeviceTypeStatus)[keyof typeof DeviceTypeStatus]

export const DeviceTypeStatusValues = [
  DeviceTypeStatus.ACTIVE,
  DeviceTypeStatus.DISABLED,
  DeviceTypeStatus.ARCHIVED,
  DeviceTypeStatus.DELETED,
] as const

export type DeviceTypeGroup = {
  id: string
  name: string
  status?: 'ACTIVE' | 'DISABLED'
  isArchived?: boolean
  isDeleted?: boolean
  defaultPayloadTemplate?: Record<string, unknown> | null
  defaultVariableMapping?: VariableMapping | null
  defaultCommands?: Record<string, DeviceTypeCommandDefinition> | null
  defaultMqttTopicPrefix?: string | null
  deviceTypeCount?: number
  createdAt: string
  updatedAt: string
}

export const DeviceTypeGroupStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
} as const

export type DeviceTypeGroupStatus = (typeof DeviceTypeGroupStatus)[keyof typeof DeviceTypeGroupStatus]

export const DeviceTypeGroupStatusValues = [
  DeviceTypeGroupStatus.ACTIVE,
  DeviceTypeGroupStatus.DISABLED,
  DeviceTypeGroupStatus.ARCHIVED,
  DeviceTypeGroupStatus.DELETED,
] as const

export type DeviceTypePayload = {
  code: string
  name: string
  groupId: string
  hardwareVersion?: string | null
  mqttTopicPrefix?: string
  payloadTemplate?: Record<string, unknown>
  variableMapping?: VariableMapping
  commands?: Record<string, DeviceTypeCommandDefinition>
}

export type DeviceTypeGroupPayload = {
  name: string
  defaultPayloadTemplate?: Record<string, unknown>
  defaultVariableMapping?: VariableMapping
  defaultCommands?: Record<string, DeviceTypeCommandDefinition>
  defaultMqttTopicPrefix?: string
}

const LIST_ALL_PAYLOAD = {
  limit: 400,
  orderBy: 'createdAt',
  order: SortOrder.desc,
}

export function getDeviceTypeCode(config: Pick<DeviceTypeConfig, 'code'>): string {
  return config.code
}

export async function getDeviceTypeConfigsRequest(): Promise<DeviceTypeConfig[]> {
  const result = await apiClient.post<ApiListResult<DeviceTypeConfig>>('/device-types/list', LIST_ALL_PAYLOAD)
  return result.items
}

export async function getDeviceTypesTableRequest(
  tableState: DataTableState<DeviceTypeConfig>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<DeviceTypeConfig>> {
  const payload = toApiListDto(tableState, hiddenFilters)
  const groupId = payload.filters?.groupId
  if (Array.isArray(groupId)) {
    payload.filters = { ...payload.filters, groupId: groupId[0] }
  }

  const result = await apiClient.post<ApiListResult<DeviceTypeConfig>>('/device-types/list', payload)
  return toDataTableResult(result)
}

export async function getDeviceTypeConfigRequest(id: string): Promise<DeviceTypeConfig> {
  return apiClient.get<DeviceTypeConfig>(`/device-types/${id}`)
}

export async function createDeviceTypeConfigRequest(payload: DeviceTypePayload): Promise<DeviceTypeConfig> {
  return apiClient.post<DeviceTypeConfig>('/device-types', payload)
}

export async function updateDeviceTypeConfigRequest(
  id: string,
  payload: Partial<Omit<DeviceTypePayload, 'code'>>,
): Promise<DeviceTypeConfig> {
  return apiClient.patch<DeviceTypeConfig>(`/device-types/${id}`, payload)
}

export async function deleteDeviceTypeConfigRequest(id: string): Promise<void> {
  return apiClient.delete(`/device-types/${id}`)
}

export async function setDeviceTypeConfigStatusRequest(
  id: string,
  status: NonNullable<DeviceTypeConfig['status']>,
): Promise<DeviceTypeConfig> {
  return apiClient.patch<DeviceTypeConfig>(`/device-types/${id}/status`, { status })
}

export async function archiveDeviceTypeConfigRequest(id: string): Promise<DeviceTypeConfig> {
  return apiClient.post<DeviceTypeConfig>(`/device-types/${id}/archive`)
}

export async function unarchiveDeviceTypeConfigRequest(id: string): Promise<DeviceTypeConfig> {
  return apiClient.post<DeviceTypeConfig>(`/device-types/${id}/unarchive`)
}

export async function getDeviceTypeDocumentationRequest(id: string): Promise<DeviceTypeAttachment[]> {
  return apiClient.get<DeviceTypeAttachment[]>(`/device-types/${id}/attachments?category=documentation`)
}

export async function uploadDeviceTypeDocumentationRequest(id: string, files: File[]): Promise<DeviceTypeAttachment[]> {
  const formData = new FormData()
  formData.append('category', 'documentation')
  files.forEach((file) => formData.append('files', file))

  return apiClient.post<DeviceTypeAttachment[]>(`/device-types/${id}/attachments`, formData)
}

export async function deleteDeviceTypeDocumentationRequest(id: string, attachmentId: string): Promise<void> {
  return apiClient.delete(`/device-types/${id}/attachments/${attachmentId}`)
}

export async function getDeviceTypeGroupsRequest(): Promise<DeviceTypeGroup[]> {
  const result = await apiClient.post<ApiListResult<DeviceTypeGroup>>('/device-type-groups/list', LIST_ALL_PAYLOAD)
  return result.items
}

export async function getDeviceTypeGroupsTableRequest(
  tableState: DataTableState<DeviceTypeGroup>,
): Promise<DataTableAsyncResult<DeviceTypeGroup>> {
  const result = await apiClient.post<ApiListResult<DeviceTypeGroup>>(
    '/device-type-groups/list',
    toApiListDto(tableState),
  )
  return toDataTableResult(result)
}

export async function getDeviceTypeGroupRequest(id: string): Promise<DeviceTypeGroup> {
  return apiClient.get<DeviceTypeGroup>(`/device-type-groups/${id}`)
}

export async function getDeviceTypeGroupFilterOptions(search: string, page: number) {
  const result = await apiClient.post<ApiListResult<DeviceTypeGroup>>('/device-type-groups/list', {
    search: search.trim() || undefined,
    page,
    limit: 20,
    orderBy: 'name',
    order: SortOrder.asc,
  })

  return {
    items: result.items.map((group) => ({ id: group.id, label: group.name })),
    total: result.total,
  }
}

export async function createDeviceTypeGroupRequest(payload: DeviceTypeGroupPayload): Promise<DeviceTypeGroup> {
  return apiClient.post<DeviceTypeGroup>('/device-type-groups', payload)
}

export async function updateDeviceTypeGroupRequest(
  id: string,
  payload: Partial<DeviceTypeGroupPayload>,
): Promise<DeviceTypeGroup> {
  return apiClient.patch<DeviceTypeGroup>(`/device-type-groups/${id}`, payload)
}

export async function deleteDeviceTypeGroupRequest(id: string): Promise<void> {
  return apiClient.delete(`/device-type-groups/${id}`)
}

export async function setDeviceTypeGroupStatusRequest(
  id: string,
  status: NonNullable<DeviceTypeGroup['status']>,
): Promise<DeviceTypeGroup> {
  return apiClient.patch<DeviceTypeGroup>(`/device-type-groups/${id}/status`, { status })
}

export async function archiveDeviceTypeGroupRequest(id: string): Promise<DeviceTypeGroup> {
  return apiClient.post<DeviceTypeGroup>(`/device-type-groups/${id}/archive`)
}

export async function unarchiveDeviceTypeGroupRequest(id: string): Promise<DeviceTypeGroup> {
  return apiClient.post<DeviceTypeGroup>(`/device-type-groups/${id}/unarchive`)
}
