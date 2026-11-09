import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import type { ApiListResult } from '@/lib/api-types'
import { toApiListDto, toDataTableResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import type { Booking, BookingCancellationQuote, BookingManagementDetails, ManualBookingRecipient } from '@/types/booking'

export const bookingsListConfig = {
  url: '/bookings/list',
  toPayload: (state: DataTableState<Booking>, filters?: Record<string, unknown>) => toApiListDto(state, filters),
  toResult: (result: ApiListResult<unknown>): DataTableAsyncResult<Booking> => toDataTableResult(result as ApiListResult<Booking>),
}

export async function getBookingsRequest(state: DataTableState<Booking>, filters?: Record<string, unknown>) {
  const { userId, ...tableFilters } = state.filters
  const requestState = { ...state, filters: tableFilters }
  const payload = bookingsListConfig.toPayload(requestState, filters)
  const selectedUsers = userId?.filter(Boolean) ?? []
  const result = await apiClient.post<ApiListResult<Booking>>(bookingsListConfig.url, {
    ...payload,
    ...(selectedUsers.length === 1 ? { userId: selectedUsers[0] } : {}),
    ...(selectedUsers.length > 1 ? { filters: { ...payload.filters, userId: selectedUsers } } : {}),
  })
  return toDataTableResult(result)
}

export function getBookingManagementDetailsRequest(bookingId: string) {
  return apiClient.get<BookingManagementDetails>(`/bookings/manage/${encodeURIComponent(bookingId)}`)
}

export async function searchManualBookingRecipientsRequest(customerId: string, locationId: string, search: string) {
  return apiClient.post<ManualBookingRecipient[]>(
    '/bookings/manage/recipients',
    { customerId, locationId, search: search.trim() || undefined },
    { headers: { 'x-org-id': locationId } },
  )
}

export function getBookingCancellationQuoteRequest(bookingId: string, locationId: string) {
  return apiClient.get<BookingCancellationQuote>(
    `/bookings/manage/${encodeURIComponent(bookingId)}/cancellation-quote`,
    { headers: { 'x-org-id': locationId } },
  )
}

export function cancelBookingForManagementRequest(bookingId: string, locationId: string, applyPenalty: boolean) {
  return apiClient.patch<Booking>(
    `/bookings/manage/${encodeURIComponent(bookingId)}/cancel`,
    { applyPenalty },
    { headers: { 'x-org-id': locationId } },
  )
}

export function updateBookingAttendanceRequest(bookingId: string, locationId: string, attended: boolean | null) {
  return apiClient.patch<Booking>(
    `/bookings/manage/${encodeURIComponent(bookingId)}/attendance`,
    { attended },
    { headers: { 'x-org-id': locationId } },
  )
}

export function cancelClassPassBookingForManagementRequest(bookingId: string, locationId: string) {
  return apiClient.patch<Booking>(
    `/bookings/manage/${encodeURIComponent(bookingId)}/cancel-external`,
    {},
    { headers: { 'x-org-id': locationId } },
  )
}

export function updateEgym2BookingDecisionRequest(bookingId: string, locationId: string, action: 'ACCEPT' | 'REJECT') {
  return apiClient.patch<Booking>(
    `/bookings/manage/${encodeURIComponent(bookingId)}/egym2-decision`,
    { action },
    { headers: { 'x-org-id': locationId } },
  )
}

export function createManualBookingRequest(payload: {
  customerId: string
  locationId: string
  userId: string
  sessionId: string
}) {
  return apiClient.post<Booking>('/bookings/manage', payload, { headers: { 'x-org-id': payload.locationId } })
}
