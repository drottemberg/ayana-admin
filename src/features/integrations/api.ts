import { apiClient } from '@/lib/api-client'
import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'

export type IntegrationProvider = 'CLASSPASS' | 'EGYM' | 'LASTSPOT'
export type CustomerIntegration = Record<string, unknown> & {
  id: string
  customerId: string
  provider: IntegrationProvider
  name: string
  username: string | null
  hasPassword: boolean
  isEnabled: boolean
  isDeleted: boolean
  setupCompletedAt: string | null
  lastSyncedAt: string | null
  setupStarted: boolean
  setupComplete: boolean
  mappedLocationsCount: number
  mappedClassesCount: number
  createdAt: string
  updatedAt: string
}
export type CustomerIntegrationInput = {
  provider: IntegrationProvider
  username: string
  password?: string
}
export type ExternalVenue = { id: string; name: string }
export type ExternalClass = { id: string; name: string }
export type IntegrationSetup = {
  id: string
  provider: IntegrationProvider
  isEnabled: boolean
  setupCompletedAt: string | null
  lastSyncedAt: string | null
  venueMappings: Array<{
    id: string
    integrationId: string
    locationId: string
    externalVenueId: string
    externalVenueName: string
    location: { id: string; name: string }
    classMappings: Array<{ id: string; externalClassId: string; externalClassName: string; classTypeId: string; classType: { id: string; name: string } }>
  }>
}
export type SyncPreview = {
  applied: boolean
  previewId?: string
  firstSync: boolean
  fullResync: boolean
  fromDate: string
  throughDate: string
  counts: { usersCreated: number; created: number; updated: number; cancelled: number; deleted: number; skipped: number; schedules: number }
  changes: Array<{ action: 'CREATE' | 'UPDATE' | 'CANCEL'; reservationId: string; name: string; location: string; className: string; date: string }>
  skippedDetails: Array<{ scheduleId: string; reason: string }>
  note: string
}

function customerQuery(customerId: string) { return `?${new URLSearchParams({ customerId })}` }
function route(customerId: string, integrationId: string, suffix = '') {
  return `/integrations/${encodeURIComponent(integrationId)}${suffix}${customerQuery(customerId)}`
}

export function listIntegrationsRequest(customerId: string) {
  return apiClient.get<CustomerIntegration[]>(`/integrations${customerQuery(customerId)}`)
}
export function createIntegrationRequest(customerId: string, input: CustomerIntegrationInput) {
  return apiClient.post<CustomerIntegration>(`/integrations${customerQuery(customerId)}`, input)
}
export function updateIntegrationRequest(customerId: string, integrationId: string, input: CustomerIntegrationInput) {
  return apiClient.patch<CustomerIntegration>(route(customerId, integrationId), input)
}
export function setIntegrationEnabledRequest(customerId: string, integrationId: string, isEnabled: boolean) {
  return apiClient.patch<CustomerIntegration>(route(customerId, integrationId, '/status'), { isEnabled })
}
export function deleteIntegrationRequest(customerId: string, integrationId: string) {
  return apiClient.delete<{ success: boolean }>(route(customerId, integrationId))
}
export function getIntegrationSetupRequest(customerId: string, integrationId: string) {
  return apiClient.get<IntegrationSetup>(route(customerId, integrationId, '/setup'))
}
export function getClassPassVenuesRequest(customerId: string, integrationId: string) {
  return apiClient.get<ExternalVenue[]>(route(customerId, integrationId, '/classpass/venues'))
}
export function getClassPassClassesRequest(customerId: string, integrationId: string, venueMappingId: string) {
  return apiClient.get<ExternalClass[]>(route(customerId, integrationId, `/classpass/venue-mappings/${encodeURIComponent(venueMappingId)}/classes`))
}
export function saveIntegrationVenuesRequest(customerId: string, integrationId: string, venues: Array<{ locationId: string; externalVenueId: string }>) {
  return apiClient.post<IntegrationSetup>(route(customerId, integrationId, '/setup/venues'), { venues })
}
export function saveIntegrationClassesRequest(customerId: string, integrationId: string, classes: Array<{ venueMappingId: string; externalClassId: string; classTypeId: string }>) {
  return apiClient.post<IntegrationSetup>(route(customerId, integrationId, '/setup/classes'), { classes })
}
export function previewIntegrationSyncRequest(customerId: string, integrationId: string, fullHistory = false) {
  return apiClient.post<SyncPreview>(route(customerId, integrationId, '/setup/sync/preview'), { fullHistory })
}
export function startIntegrationSyncRequest(customerId: string, integrationId: string, previewId: string) {
  return apiClient.post<SyncPreview>(route(customerId, integrationId, '/setup/sync'), { previewId })
}

export type ClassPassScheduleUpdate = {
  scheduleMappingId: string
  scheduleId: string
  networkReservations: number | string | null
  networkReservationsCap: number | string | null
  totalRevenue: unknown
  isFull: boolean | null
  isCancelled: boolean | null
  isDisabled: boolean | null
}

export type ClassPassScheduleCancelReason =
  | 'INSTRUCTOR_UNWELL_NO_SHOW' | 'OVERBOOKED_CLASS' | 'LOW_ATTENDANCE' | 'SCHEDULE_INCORRECT'
  | 'VENUE_TECHNICAL_ISSUE' | 'WEATHER_CONDITIONS' | 'OTHER'
  | 'POST_INSTRUCTOR_UNWELL_NO_SHOW' | 'POST_OVERBOOKED_CLASS' | 'POST_LOW_ATTENDANCE' | 'POST_SCHEDULE_INCORRECT'
  | 'POST_VENUE_TECHNICAL_ISSUE' | 'POST_WEATHER_CONDITIONS' | 'POST_OTHER'

function classPassScheduleRoute(customerId: string, integrationId: string, scheduleMappingId: string, action: string) {
  return route(customerId, integrationId, `/classpass/schedules/${encodeURIComponent(scheduleMappingId)}/${action}`)
}

export function updateClassPassScheduleSpotsRequest(customerId: string, integrationId: string, scheduleMappingId: string, change: 'ADD' | 'REMOVE', count: number) {
  return apiClient.post<ClassPassScheduleUpdate>(classPassScheduleRoute(customerId, integrationId, scheduleMappingId, 'spots'), { change, count })
}

export function setClassPassScheduleFullRequest(customerId: string, integrationId: string, scheduleMappingId: string, isFull: boolean) {
  return apiClient.post<ClassPassScheduleUpdate>(classPassScheduleRoute(customerId, integrationId, scheduleMappingId, 'full'), { isFull })
}

export function enableClassPassScheduleRequest(customerId: string, integrationId: string, scheduleMappingId: string) {
  return apiClient.post<ClassPassScheduleUpdate>(classPassScheduleRoute(customerId, integrationId, scheduleMappingId, 'enable'), {})
}

export function cancelClassPassScheduleRequest(customerId: string, integrationId: string, scheduleMappingId: string, reason: ClassPassScheduleCancelReason, message?: string) {
  return apiClient.post<ClassPassScheduleUpdate>(classPassScheduleRoute(customerId, integrationId, scheduleMappingId, 'cancel'), { reason, message, internalMessage: 'Cancelled through Ayana.' })
}

export function refreshClassPassScheduleInsightsRequest(customerId: string, integrationId: string, scheduleMappingId: string) {
  return apiClient.post<ClassPassScheduleUpdate>(classPassScheduleRoute(customerId, integrationId, scheduleMappingId, 'refresh-insights'), {})
}

export async function loadIntegrationRows(customerId: string, state: DataTableState<CustomerIntegration>): Promise<DataTableAsyncResult<CustomerIntegration>> {
  const all = await listIntegrationsRequest(customerId)
  const terms = state.search.trim().toLocaleLowerCase()
  const statuses = state.filters.isEnabled ?? []
  const filtered = all.filter((item) => {
    const matchesSearch = !terms || [item.name, item.provider, item.username].some((value) => value?.toLocaleLowerCase().includes(terms))
    const status = item.isEnabled ? 'Enabled' : 'Disabled'
    return matchesSearch && (!statuses.length || statuses.includes(status))
  })
  const pageSize = state.pagination.pageSize
  const start = state.pagination.pageIndex * pageSize
  return { items: filtered.slice(start, start + pageSize), count: filtered.length, pageCount: Math.ceil(filtered.length / pageSize) }
}

export function getIntegrationProviderLabel(provider: IntegrationProvider) {
  return ({ CLASSPASS: 'ClassPass', EGYM: 'EGYM', LASTSPOT: 'LastSpot' })[provider]
}
