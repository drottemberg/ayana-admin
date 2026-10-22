import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { apiClient } from '@/lib/api-client'
import type { ApiListResult } from '@/lib/api-types'
import type { ClassType } from '@/types/class-type'
import type { CoachCandidate, CoachProfile } from './types'
import type { ClassSession } from '@/types/class-type'

const customerHeaders = (customerId: string, locationId?: string) => ({
  headers: { 'x-org-id': locationId || customerId },
})

export async function getCoachProfilesRequest(
  customerId: string,
  state: DataTableState<CoachProfile>,
  locationId?: string,
): Promise<DataTableAsyncResult<CoachProfile>> {
  const response = await apiClient.get<CoachProfile[]>('/coaches', customerHeaders(customerId, locationId))
  const search = state.search.trim().toLowerCase()
  const filtered = search
    ? response.filter((coach) => [coach.coachName, coach.email, coach.userId, coach.specialties.join(' ')]
      .some((value) => value?.toLowerCase().includes(search)))
    : response
  const sorted = [...filtered]
  const sort = state.sorting[0]
  if (sort) sorted.sort((a, b) => String(a[sort.id as keyof CoachProfile] ?? '').localeCompare(String(b[sort.id as keyof CoachProfile] ?? '')) * (sort.desc ? -1 : 1))
  const start = state.pagination.pageIndex * state.pagination.pageSize
  return {
    items: sorted.slice(start, start + state.pagination.pageSize),
    count: filtered.length,
    pageCount: Math.ceil(filtered.length / state.pagination.pageSize),
  }
}

export async function getCoachFilterOptionsRequest(search: string, _page = 1) {
  const result = await apiClient.get<Array<{ id: string; userId: string; label: string }>>('/coaches/options', {
    params: { search: search.trim() || undefined },
  })
  return { items: result.map((coach) => ({ id: coach.userId, label: coach.label })), total: result.length }
}

export type CoachCoverageRequest = {
  id: string
  kind: 'COVER_REQUEST' | 'UNASSIGNED'
  reason?: string | null
  session: ClassSession
}

export type CoachAttendanceBooking = {
  bookingId: string
  userId: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  status: 'CONFIRMED' | 'ATTENDED' | 'NO_SHOW'
  checkInAt?: string | null
}

export function getCoachSessionAttendanceRequest(sessionId: string): Promise<{ sessionId: string; bookings: CoachAttendanceBooking[] }> {
  return apiClient.get<{ sessionId: string; bookings: CoachAttendanceBooking[] }>(`/coaches/me/sessions/${encodeURIComponent(sessionId)}/attendance`)
}

export function saveCoachSessionAttendanceRequest(sessionId: string, records: Array<{ bookingId: string; present: boolean }>) {
  return apiClient.post<{ updated: number }>(`/coaches/me/sessions/${encodeURIComponent(sessionId)}/attendance`, { records })
}

export function getMyCoachSessionsRequest(): Promise<ClassSession[]> {
  return apiClient.get<ClassSession[]>('/coaches/me/sessions')
}

export function getMyCoachCoverageRequestsRequest(): Promise<CoachCoverageRequest[]> {
  return apiClient.get<CoachCoverageRequest[]>('/coaches/me/substitutions')
}

export function claimCoachSessionRequest(sessionId: string) {
  return apiClient.post<{ success: boolean; message: string }>(`/coaches/me/sessions/${encodeURIComponent(sessionId)}/claim`)
}

export function releaseCoachSessionRequest(sessionId: string, reason?: string) {
  return apiClient.post(`/coaches/me/sessions/${encodeURIComponent(sessionId)}/release`, { reason })
}

export async function getCoachProfileRequest(customerId: string, userId: string): Promise<CoachProfile> {
  return apiClient.get<CoachProfile>(`/coaches/${encodeURIComponent(userId)}`, customerHeaders(customerId))
}

export async function updateMyCoachProfileRequest(customerId: string, payload: {
  bio?: string | null
  specialties?: string[]
  languages?: string[]
}): Promise<CoachProfile> {
  return apiClient.patch<CoachProfile>('/coaches/me/profile', payload, customerHeaders(customerId))
}

export async function getCoachCandidatesRequest(customerId: string): Promise<CoachCandidate[]> {
  return apiClient.get<CoachCandidate[]>('/coaches/candidates', customerHeaders(customerId))
}

export async function getCustomerClassTypesRequest(customerId: string): Promise<ClassType[]> {
  const response = await apiClient.post<ApiListResult<ClassType>>('/class-types/list', {
    page: 1,
    limit: 200,
    filters: { customerId: [customerId] },
    orderBy: 'name',
    order: 'asc',
  }, customerHeaders(customerId))
  return response.items
}

export async function createCoachProfileRequest(customerId: string, payload: {
  userId: string
  bio?: string
  specialties: string[]
  languages: string[]
  classTypeIds: string[]
}) {
  return apiClient.post<CoachProfile>('/coaches', payload, customerHeaders(customerId))
}

export async function updateCoachProfileRequest(customerId: string, userId: string, payload: {
  bio?: string
  specialties?: string[]
  languages?: string[]
  classTypeIds?: string[]
}) {
  return apiClient.patch<CoachProfile>(`/coaches/${encodeURIComponent(userId)}`, payload, customerHeaders(customerId))
}

export async function deleteCoachProfileRequest(customerId: string, userId: string) {
  return apiClient.delete(`/coaches/${encodeURIComponent(userId)}`, undefined, customerHeaders(customerId))
}
