import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { apiClient } from '@/lib/api-client'
import type { ApiListResult } from '@/lib/api-types'
import type { ClassType } from '@/types/class-type'
import type { CoachCandidate, CoachProfile } from './types'

const customerHeaders = (customerId: string, locationId?: string) => ({
  headers: { 'x-org-id': locationId || customerId },
})

export async function getCoachProfilesRequest(
  customerId: string,
  state: DataTableState<CoachProfile>,
): Promise<DataTableAsyncResult<CoachProfile>> {
  const response = await apiClient.get<CoachProfile[]>('/coaches', customerHeaders(customerId))
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

export async function getLocationCoachesRequest(locationId: string, classTypeId?: string): Promise<CoachProfile[]> {
  const query = classTypeId ? `?classTypeId=${encodeURIComponent(classTypeId)}` : ''
  return apiClient.get<CoachProfile[]>(`/coaches${query}`, customerHeaders('', locationId))
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
  classTypeIds: string[]
}) {
  return apiClient.post<CoachProfile>('/coaches', payload, customerHeaders(customerId))
}

export async function updateCoachProfileRequest(customerId: string, userId: string, payload: {
  bio?: string
  specialties?: string[]
  classTypeIds?: string[]
}) {
  return apiClient.patch<CoachProfile>(`/coaches/${encodeURIComponent(userId)}`, payload, customerHeaders(customerId))
}

export async function deleteCoachProfileRequest(customerId: string, userId: string) {
  return apiClient.delete(`/coaches/${encodeURIComponent(userId)}`, undefined, customerHeaders(customerId))
}
