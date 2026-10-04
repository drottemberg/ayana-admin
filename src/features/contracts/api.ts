import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { SortOrder, toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import {
  ContractSlaType,
  ContractStatus,
  ContractType,
  type Contract,
  type ContractDeviceAssignment,
  type ContractDeviceHistory,
  type ContractDeviceHistoryPeriod,
  type CreateContractPayload,
} from '@/types/contract'
import { OrganizationType } from '@/types/organization'
import { apiClient } from '@/lib/api-client'
import type { ActivityFeedItem } from '@/components/app/ActivityFeedCard'

type ContractDocumentRecord = {
  id: string
  name?: string | null
  size?: number | string | null
  url?: string | null
}

type ContractRecord = {
  id: string
  organizationId: string | null
  name: string | null
  type: string | null
  status: string
  startDate: string | null
  endDate: string | null
  slaHours?: number | null
  notes?: string | null
  devices?: { id?: string; deviceId?: string; name?: string | null; serialNumber?: string | null }[]
  customer?: Contract['customer'] | null
  isArchived?: boolean
  isDeleted?: boolean
  createdAt?: string
  updatedAt?: string
}

type ContractEventRecord = {
  id: string
  type?: string | null
  description?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
}

type ContractDeviceAssignmentRecord = {
  id: string
  contractId: string | null
  deviceId: string | null
  assignedAt?: string | null
  unassignedAt?: string | null
  assignedBy?: string | null
  unassignedBy?: string | null
  deliveryDate?: string | null
  pickupDate?: string | null
}

type ContractDeviceHistoryPeriodRecord = {
  id: string
  contractId: string
  deviceId: string
  assignedAt: string
  unassignedAt?: string | null
}

type ContractDeviceHistoryRecord = {
  id: string
  contractId: string
  deviceId: string
  contract: ContractRecord
  status: ContractDeviceHistory['status']
  assignedAt: string
  unassignedAt?: string | null
  history?: ContractDeviceHistoryPeriodRecord[]
}

const CONTRACTS_LIST_URL = '/contracts/list'

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return null
}

function toContractDocument(record: ContractDocumentRecord): NonNullable<Contract['documents']>[number] {
  const sizeInBytes = toNumber(record.size)

  return {
    id: record.id,
    name: record.name ?? '',
    size: typeof sizeInBytes === 'number' && Number.isFinite(sizeInBytes) ? sizeInBytes / 1024 : 0,
    url: record.url,
  }
}

function toContractStatus(record: Pick<ContractRecord, 'status' | 'isArchived' | 'isDeleted'>): ContractStatus {
  if (record.isDeleted) return ContractStatus.Deleted
  if (record.isArchived) return ContractStatus.Archived
  const { status } = record
  if (status === 'SUSPENDED') return ContractStatus.Suspended
  if (status === 'CANCELLED') return ContractStatus.Cancelled
  if (status === 'ENDED') return ContractStatus.Completed
  if (status === 'ACTIVE') return ContractStatus.Active
  return ContractStatus.Created
}

function toBackendContractStatus(status?: ContractStatus): string | undefined {
  if (status === ContractStatus.Completed) return 'ENDED'
  if (status === ContractStatus.Active) return 'ACTIVE'
  if (status === ContractStatus.Suspended) return 'SUSPENDED'
  if (status === ContractStatus.Cancelled) return 'CANCELLED'
  if (status === ContractStatus.Archived) return 'ARCHIVED'
  if (status === ContractStatus.Deleted) return 'DELETED'
  return undefined
}

function toContractType(type: string | null): ContractType {
  if (type === 'PURCHASE') return ContractType.Purchase
  return ContractType.Rental
}

function toContract(record: ContractRecord): Contract {
  return {
    id: record.id,
    name: record.name ?? '',
    type: toContractType(record.type),
    status: toContractStatus(record),
    slaType: ContractSlaType.None,
    slaHours: record.slaHours ?? null,
    notes: record.notes ?? null,
    customer: record.customer ?? {
      id: record.organizationId ?? '',
      name: '',
      type: OrganizationType.CUSTOMER,
    },
    stores: [],
    devices:
      record.devices?.map((d) => ({
        id: d.id ?? d.deviceId ?? '',
        name: d.name ?? '',
        serialNumber: d.serialNumber ?? '',
      })) ?? [],
    startDate: record.startDate ?? '',
    endDate: record.endDate ?? '',
    documents: [],
    isArchived: record.isArchived,
    isDeleted: record.isDeleted,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function toContractDeviceAssignment(record: ContractDeviceAssignmentRecord): ContractDeviceAssignment {
  return {
    id: record.id,
    contractId: record.contractId ?? '',
    deviceId: record.deviceId ?? '',
    assignedAt: record.assignedAt,
    unassignedAt: record.unassignedAt,
    assignedBy: record.assignedBy,
    unassignedBy: record.unassignedBy,
    deliveryDate: record.deliveryDate,
    pickupDate: record.pickupDate,
  }
}

function toContractDeviceHistoryPeriod(record: ContractDeviceHistoryPeriodRecord): ContractDeviceHistoryPeriod {
  return {
    id: record.id,
    contractId: record.contractId,
    deviceId: record.deviceId,
    assignedAt: record.assignedAt,
    unassignedAt: record.unassignedAt ?? null,
  }
}

function toContractDeviceHistory(record: ContractDeviceHistoryRecord): ContractDeviceHistory {
  return {
    id: record.id,
    contractId: record.contractId,
    deviceId: record.deviceId,
    contract: toContract(record.contract),
    status: record.status,
    assignedAt: record.assignedAt,
    unassignedAt: record.unassignedAt ?? null,
    history: (record.history ?? []).map(toContractDeviceHistoryPeriod),
  }
}

export function toContractsTableResult(result: ApiListResult<ContractRecord>): DataTableAsyncResult<Contract> {
  return toDataTableResult({
    ...result,
    items: result.items.map(toContract),
  })
}

export function toContractsListPayload(tableState: DataTableState<Contract>, hiddenFilters?: Record<string, unknown>) {
  const f = tableState.filters as Record<string, string[] | undefined>
  const single = (key: string) => f[key]?.[0]

  return toApiListDto(tableState, {
    status: f.status?.map((status) => toBackendContractStatus(status as ContractStatus)).filter(Boolean),
    organizationId: single('customerId'),
    deviceId: single('deviceId'),
    ...hiddenFilters,
  })
}

export const contractsListConfig = {
  url: CONTRACTS_LIST_URL,
  toPayload: toContractsListPayload,
  toResult: (result: ApiListResult<unknown>) => toContractsTableResult(result as ApiListResult<ContractRecord>),
}

export const deviceContractHistoryListConfig = {
  url: (deviceId: string) => `/devices/${deviceId}/contracts/history/list`,
  toPayload: (tableState: DataTableState<ContractDeviceHistory>, hiddenFilters?: Record<string, unknown>) =>
    toApiListDto(tableState, hiddenFilters),
  toResult: (result: ApiListResult<unknown>) =>
    toContractDeviceHistoryTableResult(result as ApiListResult<ContractDeviceHistoryRecord>),
}

export async function getContractsListRequest(): Promise<Contract[]> {
  const result = await apiClient.post<ApiListResult<ContractRecord>>(CONTRACTS_LIST_URL, {
    limit: 100,
    orderBy: 'createdAt',
    order: SortOrder.desc,
  })

  return result.items.map(toContract)
}

export async function getContractsRequest(
  tableState: DataTableState<Contract>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<Contract>> {
  const result = await apiClient.post<ApiListResult<ContractRecord>>(
    contractsListConfig.url,
    contractsListConfig.toPayload(tableState, hiddenFilters),
  )

  return toContractsTableResult(result)
}

export function toContractDeviceHistoryTableResult(
  result: ApiListResult<ContractDeviceHistoryRecord>,
): DataTableAsyncResult<ContractDeviceHistory> {
  return toDataTableResult({ ...result, items: result.items.map(toContractDeviceHistory) })
}

export async function getDeviceContractHistoryRequest(
  deviceId: string,
  tableState: DataTableState<ContractDeviceHistory>,
): Promise<DataTableAsyncResult<ContractDeviceHistory>> {
  const result = await apiClient.post<ApiListResult<ContractDeviceHistoryRecord>>(
    deviceContractHistoryListConfig.url(deviceId),
    deviceContractHistoryListConfig.toPayload(tableState),
  )
  return toContractDeviceHistoryTableResult(result)
}

export async function getContractFilterOptionsRequest(
  filter: 'customer' | 'device',
  search: string,
  page: number,
  filters?: Record<string, unknown>,
) {
  return apiClient.post<{ items: { id: string; label: string }[]; total: number }>('/contracts/list/filters', {
    filter,
    filters,
    search: search.trim() || undefined,
    page,
    limit: 20,
    order: SortOrder.asc,
  })
}

export async function getContractRequest(contractId: string): Promise<Contract> {
  const [contract, documents] = await Promise.all([
    apiClient.get<ContractRecord>(`/contracts/${contractId}`),
    getContractDocumentsRequest(contractId),
  ])

  return { ...toContract(contract), documents }
}

export async function getContractDocumentsRequest(contractId: string): Promise<NonNullable<Contract['documents']>> {
  const documents = await apiClient.get<ContractDocumentRecord[]>(`/contracts/${contractId}/files`)
  return documents.map(toContractDocument)
}

export async function getContractDevicesRequest(contractId: string): Promise<ContractDeviceAssignment[]> {
  const devices = await apiClient.get<ContractDeviceAssignmentRecord[]>(`/contracts/${contractId}/devices`)
  return devices.map(toContractDeviceAssignment)
}

function toActivityMessage(event: ContractEventRecord) {
  if (event.description) return event.description

  const deviceId = typeof event.metadata?.deviceId === 'string' ? event.metadata.deviceId : undefined
  if (event.type === 'contract.device_assigned') return deviceId ? `Device ${deviceId} assigned` : 'Device assigned'
  if (event.type === 'contract.device_unassigned')
    return deviceId ? `Device ${deviceId} unassigned` : 'Device unassigned'
  if (event.type === 'contract.device_swapped') return 'Device swapped'
  if (event.type === 'contract.created') return 'Contract created'

  return event.type ?? 'Activity'
}

export async function getContractEventsRequest(contractId: string): Promise<ActivityFeedItem[]> {
  const result = await apiClient.get<ApiListResult<ContractEventRecord>>(`/contracts/${contractId}/events`)

  return result.items.map((event) => ({
    id: event.id,
    message: toActivityMessage(event),
    createdAt: event.createdAt,
    type: event.type?.includes('comment') ? 'comment' : 'intervention',
  }))
}

export async function createContractRequest(payload: CreateContractPayload): Promise<Contract> {
  const contract = await apiClient.post<ContractRecord>('/contracts', {
    organizationId: payload.customer.id,
    name: payload.name,
    type: payload.type,
    deviceIds: payload.devices?.map((d) => d.id) ?? [],
    startDate: payload.startDate,
    endDate: payload.endDate,
    slaHours: payload.slaHours,
    notes: payload.notes,
    reassignConflictingDevices: payload.reassignConflictingDevices,
  })

  const created = toContract(contract)
  if (payload.documentFiles?.length) {
    await uploadContractDocumentsRequest(created.id, payload.documentFiles)
  }

  return created
}

export async function updateContractRequest(
  contractId: string,
  payload: Partial<CreateContractPayload>,
): Promise<Contract> {
  const contract = await apiClient.patch<ContractRecord>(`/contracts/${contractId}`, {
    name: payload.name,
    status: toBackendContractStatus(payload.status),
    endDate: payload.endDate,
    slaHours: payload.slaHours,
    notes: payload.notes,
    deviceIds: payload.devices?.map((d) => d.id),
    reassignConflictingDevices: payload.reassignConflictingDevices,
  })

  if (payload.documentFiles?.length) {
    await uploadContractDocumentsRequest(contractId, payload.documentFiles)
  }

  return toContract(contract)
}

export async function assignContractDeviceRequest(contractId: string, deviceId: string): Promise<void> {
  await apiClient.post(`/contracts/${contractId}/devices`, { deviceId })
}

export async function unassignContractDeviceRequest(contractId: string, deviceId: string): Promise<void> {
  await apiClient.delete(`/contracts/${contractId}/devices/${deviceId}`)
}

export async function swapContractDeviceRequest(
  contractId: string,
  deviceId: string,
  newDeviceId: string,
): Promise<ContractDeviceAssignment> {
  const assignment = await apiClient.post<ContractDeviceAssignmentRecord>(
    `/contracts/${contractId}/devices/${deviceId}/swap`,
    {
      newDeviceId,
    },
  )
  return toContractDeviceAssignment(assignment)
}

export async function updateContractDeviceDatesRequest(
  contractId: string,
  deviceId: string,
  payload: Pick<ContractDeviceAssignment, 'deliveryDate' | 'pickupDate'>,
): Promise<ContractDeviceAssignment> {
  const assignment = await apiClient.patch<ContractDeviceAssignmentRecord>(
    `/contracts/${contractId}/devices/${deviceId}/dates`,
    payload,
  )
  return toContractDeviceAssignment(assignment)
}

export async function uploadContractDocumentsRequest(
  contractId: string,
  files: File[],
): Promise<NonNullable<Contract['documents']>> {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))

  const documents = await apiClient.post<ContractDocumentRecord[]>(`/contracts/${contractId}/files`, formData)
  return documents.map(toContractDocument)
}

export async function deleteContractDocumentRequest(contractId: string, attachmentId: string): Promise<void> {
  return apiClient.delete(`/contracts/${contractId}/files/${attachmentId}`)
}

export async function setContractStatusRequest(contractId: string, status: ContractStatus): Promise<Contract> {
  const contract = await apiClient.patch<ContractRecord>(`/contracts/${contractId}`, {
    status: toBackendContractStatus(status),
  })
  return toContract(contract)
}

export async function endContractRequest(contractId: string): Promise<Contract> {
  return toContract(await apiClient.post<ContractRecord>(`/contracts/${contractId}/end`))
}

export async function archiveContractRequest(contractId: string): Promise<Contract> {
  return toContract(await apiClient.post<ContractRecord>(`/contracts/${contractId}/archive`))
}

export async function unarchiveContractRequest(contractId: string): Promise<Contract> {
  return toContract(await apiClient.post<ContractRecord>(`/contracts/${contractId}/unarchive`))
}

export async function deleteContractsRequest(contractIds: string[]): Promise<void> {
  await Promise.all(contractIds.map((contractId) => apiClient.delete(`/contracts/${contractId}`)))
}
