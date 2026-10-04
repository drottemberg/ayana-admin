import { ApiError } from '@/lib/api'
import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { SortOrder, toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import type { Device, CreateDevicePayload, DeviceConfiguration, DeviceTypeOption } from '@/types/device'
import { DeviceEntityStatus, DeviceStatus } from '@/types/device'
import { ContractSlaType, ContractStatus, ContractType } from '@/types/contract'
import { OrganizationType } from '@/types/organization'
import { apiClient } from '@/lib/api-client'
import { getDeviceTypeLabel } from '@/features/device-types/utils'

type DeviceRecord = {
  id: string
  serialNumber: string | null
  name: string | null
  note?: string | null
  type: string | null
  status: string
  isArchived?: boolean
  isDeleted?: boolean
  condition?: Device['condition']
  isSet?: boolean
  devicesCount?: number
  parentId?: string | null
  parentSet?: Device['parentSet']
  storeId?: string | null
  isOnline?: boolean
  isRebooting?: boolean
  lastSeen?: string | null
  customer?: Device['customer'] | null
  store?: Device['store'] | null
  contract?: Device['contract'] | null
  deviceType?: {
    id: string
    code: string
    name: string
    hardwareVersion?: string | null
    group?: { id: string; name: string } | null
  } | null
  activeProduct?: Device['activeProduct']
  activeCampaign?: Device['activeCampaign']
  tags?: string[]
  deviceItems?: DeviceRecord[]
  devices?: Record<string, DeviceRecord>
  configuration?: DeviceConfiguration
  rawStatus?: Record<string, unknown> | null
  rawInfo?: Record<string, unknown> | null
  rawSetup?: Record<string, unknown> | null
  raw?: {
    status?: Record<string, unknown> | null
    info?: Record<string, unknown> | null
    setup?: Record<string, unknown> | null
  } | null
  activeIssue?: Device['activeIssue']
  maintenanceDocuments?: Device['maintenanceDocuments']
  activityFeed?: Device['activityFeed']
  data?: Device['data']
}

type DeviceEventRecord = {
  id: string
  type?: string | null
  description?: string | null
  createdAt: string
}

const DEVICES_LIST_URL = '/devices/list'

export type DeviceCommandResponse = {
  topic: string
}

export type DeviceDownloadMediaPayload = {
  contentId: string
  fileName: string
  url: string
  timestamp?: number
}

export type DeviceFirmwareUpdatePayload = {
  url: string
  version: string
  machine: string
  checksum: string
}

export type DeviceRawCommandPayload = {
  command: Record<string, unknown>
}

export type DeviceRawConfigPayload = {
  config: Record<string, unknown>
}

export type DeviceVariablePayload = {
  key: string
  group?: string
  source?: 'status' | 'info' | 'setup'
  value: unknown
}

function toDeviceStatus(record: DeviceRecord): Device['status'] {
  if (record.isRebooting) return DeviceStatus.Rebooting
  if (record.isOnline && !isLastSeenStale(record.lastSeen)) return DeviceStatus.Online
  if (record.status === 'ACTIVE') return DeviceStatus.Disconnected
  return DeviceStatus.NotConnected
}

function toDeviceActivityMessage(event: DeviceEventRecord): string {
  if (event.description) return event.description
  if (event.type === 'device.reboot_requested') return 'Reboot requested'
  if (event.type === 'device.reboot_completed') return 'Device back online after reboot'
  if (event.type === 'device.config_requested') return 'Configuration requested'
  if (event.type === 'device.config_sent') return 'Configuration sent'
  if (event.type === 'device.variable_updated') return 'Device variable updated'
  if (event.type === 'device.command_requested') return 'Device command requested'
  return event.type ?? 'Activity'
}

function toDeviceActivity(event: DeviceEventRecord) {
  return {
    id: event.id,
    message: toDeviceActivityMessage(event),
    createdAt: event.createdAt,
    type: 'intervention' as const,
  }
}

function isLastSeenStale(lastSeen?: string | null): boolean {
  if (!lastSeen) return true
  const timestamp = new Date(lastSeen).getTime()
  if (Number.isNaN(timestamp)) return true
  return Date.now() - timestamp > 10 * 60 * 1000
}

function toDeviceEntityStatus(record: DeviceRecord): Device['entityStatus'] {
  if (record.isDeleted) return DeviceEntityStatus.Deleted
  if (record.isArchived) return DeviceEntityStatus.Archived
  if (record.status === 'ACTIVE') return DeviceEntityStatus.Active
  if (record.status === 'MAINTENANCE') return DeviceEntityStatus.Maintenance
  if (record.status === 'PROVISIONING') return DeviceEntityStatus.Provisioning
  return DeviceEntityStatus.Disabled
}

function toDeviceTypeOption(type: string | null): DeviceTypeOption {
  const id = type ?? ''
  return {
    id,
    name: getDeviceTypeLabel(id),
  }
}

function toDeviceConfiguration(record: DeviceRecord): DeviceConfiguration | undefined {
  const configuration: DeviceConfiguration = { ...(record.configuration ?? {}) }

  return Object.keys(configuration).length ? configuration : undefined
}

export function toDevice(record: DeviceRecord): Device {
  return {
    id: record.id,
    name: record.name ?? '',
    serialNumber: record.serialNumber ?? '',
    type: record.deviceType
      ? {
          id: record.deviceType.code,
          code: record.deviceType.code,
          name: record.deviceType.name || getDeviceTypeLabel(record.deviceType.code),
          group: record.deviceType.group ?? null,
        }
      : toDeviceTypeOption(record.type),
    typeGroupId: record.deviceType?.group?.id,
    isSet: record.isSet,
    devicesCount: record.devicesCount,
    parentId: record.parentId ?? undefined,
    parentSet: record.parentSet ?? null,
    deviceItems:
      record.deviceItems?.map(toDevice) ?? (record.devices ? Object.values(record.devices).map(toDevice) : undefined),
    status: toDeviceStatus(record),
    entityStatus: toDeviceEntityStatus(record),
    condition: record.condition,
    tags: record.tags,
    customer: record.customer ?? { id: '', name: '', type: OrganizationType.CUSTOMER },
    store: record.store ?? {
      id: record.storeId ?? '',
      name: '',
      type: OrganizationType.STORE,
    },
    contract: record.contract ?? {
      id: '',
      name: '',
      type: ContractType.Rental,
      status: ContractStatus.Active,
      slaType: ContractSlaType.None,
      customer: { id: '', name: '', type: OrganizationType.CUSTOMER },
      stores: [],
      devices: [],
      startDate: '',
      endDate: '',
    },
    activeProduct: record.activeProduct ?? null,
    activeCampaign: record.activeCampaign ?? null,
    configuration: toDeviceConfiguration(record),
    activeIssue: record.activeIssue,
    rawStatus: record.raw?.status ?? record.rawStatus ?? null,
    rawInfo: record.raw?.info ?? record.rawInfo ?? null,
    rawSetup: record.raw?.setup ?? record.rawSetup ?? null,
    lastSeen: record.lastSeen ?? undefined,
    maintenanceDocuments: record.maintenanceDocuments,
    activityFeed: record.activityFeed,
    data: record.data,
  }
}

export function toDevicesTableResult(result: ApiListResult<DeviceRecord>): DataTableAsyncResult<Device> {
  return toDataTableResult({
    ...result,
    items: result.items.map(toDevice),
  })
}

export function toDevicesListPayload(tableState: DataTableState<Device>, hiddenFilters?: Record<string, unknown>) {
  const f = tableState.filters as Record<string, string[] | undefined>
  const single = (key: string) => f[key]?.[0]

  return toApiListDto(tableState, {
    type: single('type'),
    typeGroupId: single('typeGroupId'),
    status: f.status,
    customerId: single('customerId'),
    storeId: single('storeId'),
    productId: single('productId'),
    contractId: single('contractId'),
    ...hiddenFilters,
  })
}

export const devicesListConfig = {
  url: DEVICES_LIST_URL,
  toPayload: toDevicesListPayload,
  toResult: (result: ApiListResult<unknown>) => toDevicesTableResult(result as ApiListResult<DeviceRecord>),
}

function getDeviceTypeId(type: CreateDevicePayload['type'] | undefined) {
  if (type === undefined) return undefined
  return typeof type === 'object' ? type.id : type
}

export async function getDevicesListRequest(filters?: Record<string, unknown>, search?: string): Promise<Device[]> {
  const result = await apiClient.post<ApiListResult<DeviceRecord>>(DEVICES_LIST_URL, {
    filters: { ...filters },
    search: search?.trim() || undefined,
    limit: 100,
    orderBy: 'createdAt',
    order: SortOrder.desc,
  })

  return result.items.map(toDevice)
}

export async function getDeviceRequest(deviceId: string): Promise<Device> {
  return toDevice(await apiClient.get<DeviceRecord>(`/devices/${deviceId}`))
}

export async function getDeviceTypesRequest(): Promise<DeviceTypeOption[]> {
  const result = await apiClient.post<ApiListResult<{ code: string; name?: string | null }>>('/device-types/list', {
    limit: 400,
    orderBy: 'code',
    order: SortOrder.asc,
  })
  return result.items.map((c) => ({ id: c.code, name: c.name || getDeviceTypeLabel(c.code) }))
}

export async function getDeviceTagsRequest(): Promise<string[]> {
  return apiClient.get<string[]>('/devices/tags')
}

export async function getDeviceBySerialNumberRequest(serialNumber: string): Promise<Device | null> {
  try {
    return toDevice(await apiClient.get<DeviceRecord>(`/devices/serial/${encodeURIComponent(serialNumber)}`))
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function createDeviceRequest(payload: CreateDevicePayload): Promise<Device> {
  const params: Record<string, unknown> = {
    serialNumber: payload.serialNumber,
    name: payload.name,
    status: payload.status,
    isSet: payload.isSet,
    parentId: payload.parentId,
  }
  if (!payload.isSet) {
    params['type'] = getDeviceTypeId(payload.type)
  }
  const device = await apiClient.post<DeviceRecord>('/devices', params)

  return toDevice(device)
}

export async function assignDeviceToSetRequest(deviceId: string, parentId: string): Promise<Device> {
  const device = await apiClient.patch<DeviceRecord>(`/devices/${deviceId}`, { parentId })
  return toDevice(device)
}

export async function assignDevicesToSetRequest(deviceIds: string[], parentId: string): Promise<void> {
  await apiClient.post('/devices/assign-to-set', { parentId, deviceIds })
}

export async function assignDeviceToStoreRequest(deviceId: string, storeId: string): Promise<Device> {
  return toDevice(await apiClient.post<DeviceRecord>(`/devices/${deviceId}/assign-to-store`, { storeId }))
}

export async function unassignDeviceFromStoreRequest(deviceId: string, storeId: string): Promise<Device> {
  return toDevice(await apiClient.delete<DeviceRecord>(`/devices/${deviceId}/stores/${storeId}`))
}

export async function removeDeviceFromSetRequest(deviceId: string): Promise<Device> {
  const device = await apiClient.patch<DeviceRecord>(`/devices/${deviceId}`, { parentId: null })
  return toDevice(device)
}

export async function updateDeviceRequest(
  deviceId: string,
  payload: Partial<CreateDevicePayload> & { status?: string },
): Promise<Device> {
  const device = await apiClient.patch<DeviceRecord>(`/devices/${deviceId}`, {
    serialNumber: payload.serialNumber,
    name: payload.name,
    isSet: payload.isSet,
    type: getDeviceTypeId(payload.type),
    parentId: payload.parentId,
    status: payload.status,
  })

  return toDevice(device)
}

export async function archiveDeviceRequest(deviceId: string): Promise<Device> {
  return toDevice(await apiClient.post<DeviceRecord>(`/devices/${deviceId}/archive`))
}

export async function unarchiveDeviceRequest(deviceId: string): Promise<Device> {
  return toDevice(await apiClient.post<DeviceRecord>(`/devices/${deviceId}/unarchive`))
}

export async function deleteDevicesRequest(deviceIds: string[]): Promise<void> {
  await Promise.all(deviceIds.map((deviceId) => apiClient.delete(`/devices/${deviceId}`)))
}

export async function getDeviceEventsRequest(
  deviceId: string,
  params?: { page?: number; limit?: number },
): Promise<Device['activityFeed']> {
  const result = await apiClient.get<ApiListResult<DeviceEventRecord> | DeviceEventRecord[]>(`/devices/${deviceId}/events`, {
    params,
  })
  const items = Array.isArray(result) ? result : result.items
  return items.map(toDeviceActivity)
}

export async function getDeviceConfigCommandRequest(deviceId: string): Promise<DeviceCommandResponse> {
  return apiClient.post<DeviceCommandResponse>(`/devices/${deviceId}/commands/get-config`)
}

export async function distributeDeviceCommandRequest(deviceId: string): Promise<DeviceCommandResponse> {
  return apiClient.post<DeviceCommandResponse>(`/devices/${deviceId}/commands/distribute`)
}

export async function rebootDeviceCommandRequest(deviceId: string): Promise<DeviceCommandResponse> {
  return apiClient.post<DeviceCommandResponse>(`/devices/${deviceId}/commands/reboot`)
}

export async function downloadDeviceMediaCommandRequest(
  deviceId: string,
  payload: DeviceDownloadMediaPayload,
): Promise<DeviceCommandResponse> {
  return apiClient.post<DeviceCommandResponse>(`/devices/${deviceId}/commands/download-media`, payload)
}

export async function enableDeviceAccessPointCommandRequest(deviceId: string): Promise<DeviceCommandResponse> {
  return apiClient.post<DeviceCommandResponse>(`/devices/${deviceId}/commands/enable-access-point`)
}

export async function factoryResetDeviceCommandRequest(deviceId: string): Promise<DeviceCommandResponse> {
  return apiClient.post<DeviceCommandResponse>(`/devices/${deviceId}/commands/factory-reset`)
}

export async function updateDeviceFirmwareCommandRequest(
  deviceId: string,
  payload: DeviceFirmwareUpdatePayload,
): Promise<DeviceCommandResponse> {
  return apiClient.post<DeviceCommandResponse>(`/devices/${deviceId}/commands/update-firmware`, payload)
}

export async function rollbackDeviceFirmwareCommandRequest(deviceId: string): Promise<DeviceCommandResponse> {
  return apiClient.post<DeviceCommandResponse>(`/devices/${deviceId}/commands/rollback-firmware`)
}

export async function sendDeviceRawCommandRequest(
  deviceId: string,
  payload: DeviceRawCommandPayload,
): Promise<DeviceCommandResponse> {
  return apiClient.post<DeviceCommandResponse>(`/devices/${deviceId}/commands/raw`, payload)
}

export async function sendDeviceConfigCommandRequest(
  deviceId: string,
  payload: DeviceRawConfigPayload,
): Promise<DeviceCommandResponse> {
  return apiClient.post<DeviceCommandResponse>(`/devices/${deviceId}/commands/config`, payload)
}

export async function updateDeviceVariableRequest(
  deviceId: string,
  payload: DeviceVariablePayload,
): Promise<DeviceCommandResponse & { confirmed?: boolean; value?: unknown }> {
  return apiClient.post<DeviceCommandResponse & { confirmed?: boolean; value?: unknown }>(
    `/devices/${deviceId}/commands/variables`,
    payload,
  )
}

export async function runDeviceTypeCommandRequest(
  deviceId: string,
  command: string,
): Promise<DeviceCommandResponse> {
  return apiClient.post<DeviceCommandResponse>(`/devices/${deviceId}/commands/device-type-command`, { command })
}

export async function getDevicesRequest(
  tableState: DataTableState<Device>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<Device>> {
  const result = await apiClient.post<ApiListResult<DeviceRecord>>(
    devicesListConfig.url,
    devicesListConfig.toPayload(tableState, hiddenFilters),
  )

  return toDevicesTableResult(result)
}
