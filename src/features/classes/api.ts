import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import type { ClassBooking, ClassSchedule, ClassSession, ClassType } from '@/types/class-type'

const CLASS_TYPES_LIST_URL = '/class-types/list'

export const classTypesListConfig = {
  url: CLASS_TYPES_LIST_URL,
  toPayload: (tableState: DataTableState<ClassType>, filters?: Record<string, unknown>) =>
    toApiListDto(tableState, filters),
  toResult: (result: ApiListResult<unknown>): DataTableAsyncResult<ClassType> =>
    toDataTableResult(result as ApiListResult<ClassType>),
}

export async function getClassTypesRequest(
  tableState: DataTableState<ClassType>,
  filters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<ClassType>> {
  const result = await apiClient.post<ApiListResult<ClassType>>(
    CLASS_TYPES_LIST_URL,
    classTypesListConfig.toPayload(tableState, filters),
  )
  return toDataTableResult(result)
}

export async function getClassCategoryOptions(search: string, page = 1) {
  const result = await apiClient.post<ApiListResult<ClassType>>(CLASS_TYPES_LIST_URL, {
    page,
    limit: 100,
    search: search.trim() || undefined,
    orderBy: 'category',
    order: 'asc',
  })
  const categories = [...new Set(result.items.map((item) => item.category?.trim()).filter((value): value is string => Boolean(value)))]
  return {
    items: categories.map((category) => ({ id: category, label: category })),
    total: categories.length,
  }
}

export type UpdateClassTypePayload = {
  name: string
  category?: string
  description?: string
  conditions: string | null
  type: ClassType['type']
  duration: number
  maxCapacity: number
  creditCost: number
}

export async function updateClassTypeRequest(classType: ClassType, payload: UpdateClassTypePayload) {
  return apiClient.patch<ClassType>(`/class-types/${classType.id}?locationId=${encodeURIComponent(classType.locationId)}`, payload)
}

export async function setClassTypeStatusRequest(classType: ClassType, isActive: boolean) {
  return apiClient.patch<ClassType>(
    `/class-types/${classType.id}/status?locationId=${encodeURIComponent(classType.locationId)}`,
    { isActive },
  )
}

export async function getClassTypeLocationOptions(search: string, page = 1) {
  const result = await apiClient.post<ApiListResult<{ id: string; name: string }>>('/locations/list', {
    search: search.trim() || undefined,
    page,
    limit: 20,
    orderBy: 'name',
    order: 'asc',
  })

  return { items: result.items.map((location) => ({ id: location.id, label: location.name })), total: result.total }
}

export async function getClassSessionRequest(id: string, locationId: string) {
  return apiClient.get<ClassSession>(`/class-sessions/${encodeURIComponent(id)}/management`, {
    headers: { 'x-org-id': locationId },
  })
}

export type UpdateClassSessionPayload = {
  startTime: string
  endTime: string
  capacity: number
  coachId: string | null
}

export type LocationCoach = { userId: string; coachName: string }

export async function getLocationCoachesRequest(locationId: string): Promise<LocationCoach[]> {
  return apiClient.get<LocationCoach[]>('/coaches', { headers: { 'x-org-id': locationId } })
}

export async function updateClassSessionRequest(id: string, locationId: string, payload: UpdateClassSessionPayload) {
  return apiClient.patch<ClassSession>(`/class-sessions/${encodeURIComponent(id)}`, payload, {
    headers: { 'x-org-id': locationId },
  })
}

export async function cancelClassSessionRequest(id: string, locationId: string) {
  return apiClient.patch<{ sessionId: string; status: 'CANCELLED'; bookingCount: number; emailsAttempted: number; creditsReturned: number }>(
    `/bookings/session/${encodeURIComponent(id)}/cancel`,
    {},
    { headers: { 'x-org-id': locationId } },
  )
}

export async function getClassSessionsRequest(
  tableState: DataTableState<ClassSession>,
  filters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<ClassSession>> {
  const { from, to, ...queryFilters } = filters ?? {}
  const payload = {
    ...classSessionsListConfig.toPayload(tableState, queryFilters),
    ...(typeof from === 'string' ? { from } : {}),
    ...(typeof to === 'string' ? { to } : {}),
  }
  const result = await apiClient.post<ApiListResult<ClassSession>>('/class-sessions/list', payload)
  return toDataTableResult(result)
}

export const classSessionsListConfig = {
  url: '/class-sessions/list',
  toPayload: (tableState: DataTableState<ClassSession>, filters?: Record<string, unknown>) =>
    toApiListDto(tableState, filters),
  toResult: (result: ApiListResult<unknown>) => toDataTableResult(result as ApiListResult<ClassSession>),
}

export async function getClassSchedulesRequest(locationId: string): Promise<ClassSchedule[]> {
  return apiClient.get<ClassSchedule[]>('/class-schedules', { headers: { 'x-org-id': locationId } })
}

export type CreateClassSchedulePayload = {
  classTypeId: string
  coachId?: string | null
  dayOfWeek: NonNullable<ClassSchedule['dayOfWeek']>
  startHour: number
  startMinute: number
  capacity?: number
  validFrom?: string
  validUntil?: string
}

export async function createClassScheduleRequest(locationId: string, payload: CreateClassSchedulePayload) {
  return apiClient.post<ClassSchedule>('/class-schedules', payload, { headers: { 'x-org-id': locationId } })
}

export type UpdateClassSchedulePayload = {
  coachId: string | null
  dayOfWeek: NonNullable<ClassSchedule['dayOfWeek']>
  startHour: number
  startMinute: number
  capacity: number | null
  validFrom: string | null
  validUntil: string | null
  isActive: boolean
  pauseFrom: string | null
  pauseUntil: string | null
}

export async function updateClassScheduleRequest(locationId: string, scheduleId: string, payload: Partial<UpdateClassSchedulePayload>) {
  return apiClient.patch<ClassSchedule>(`/class-schedules/${encodeURIComponent(scheduleId)}`, payload, {
    headers: { 'x-org-id': locationId },
  })
}

export async function deleteClassScheduleRequest(locationId: string, scheduleId: string) {
  return apiClient.delete(`/class-schedules/${encodeURIComponent(scheduleId)}`, undefined, { headers: { 'x-org-id': locationId } })
}

export async function generateClassScheduleSessionsRequest(locationId: string, scheduleId: string) {
  return apiClient.post<{ created: number }>(`/class-schedules/${encodeURIComponent(scheduleId)}/generate`, undefined, {
    headers: { 'x-org-id': locationId },
  })
}

export async function getClassBookingsRequest(locationId: string, sessionId: string): Promise<ClassBooking[]> {
  return apiClient.get<ClassBooking[]>(`/bookings/management/session/${encodeURIComponent(sessionId)}`, {
    headers: { 'x-org-id': locationId },
  })
}

export async function getClassTypeRequest(id: string, locationId: string) {
  return apiClient.get<ClassType>(`/class-types/${encodeURIComponent(id)}`, {
    headers: { 'x-org-id': locationId },
  })
}

export type ClassTypeProductKind = 'REQUIRED' | 'RECOMMENDED'
export type ClassTypeProduct = {
  classTypeId: string
  productId: string
  kind: ClassTypeProductKind
  productName: string
  productTypeName: string | null
  isActive: boolean
  isSellable: boolean
  createdAt: string
  updatedAt: string
}
export type ClassTypeProductOption = { id: string; name: string; productTypeName: string | null }

export async function getClassTypeProductsRequest(classTypeId: string, locationId: string) {
  return apiClient.get<ClassTypeProduct[]>(`/class-types/${encodeURIComponent(classTypeId)}/products`, {
    headers: { 'x-org-id': locationId },
  })
}

export async function getClassTypeProductOptionsRequest(classTypeId: string, locationId: string, search: string) {
  return apiClient.get<ClassTypeProductOption[]>(
    `/class-types/${encodeURIComponent(classTypeId)}/product-options?${new URLSearchParams({ locationId, search })}`,
    { headers: { 'x-org-id': locationId } },
  )
}

export async function addClassTypeProductRequest(classTypeId: string, locationId: string, productId: string, kind: ClassTypeProductKind) {
  return apiClient.post(`/class-types/${encodeURIComponent(classTypeId)}/products?locationId=${encodeURIComponent(locationId)}`, { productId, kind }, {
    headers: { 'x-org-id': locationId },
  })
}

export async function updateClassTypeProductRequest(classTypeId: string, locationId: string, productId: string, kind: ClassTypeProductKind) {
  return apiClient.patch(`/class-types/${encodeURIComponent(classTypeId)}/products/${encodeURIComponent(productId)}?locationId=${encodeURIComponent(locationId)}`, { kind }, {
    headers: { 'x-org-id': locationId },
  })
}

export async function removeClassTypeProductRequest(classTypeId: string, locationId: string, productId: string) {
  return apiClient.delete(`/class-types/${encodeURIComponent(classTypeId)}/products/${encodeURIComponent(productId)}?locationId=${encodeURIComponent(locationId)}`, undefined, {
    headers: { 'x-org-id': locationId },
  })
}
