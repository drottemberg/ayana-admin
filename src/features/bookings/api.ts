import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import type { ApiListResult } from '@/lib/api-types'
import { toApiListDto, toDataTableResult } from '@/lib/api-types'
import { apiClient } from '@/lib/api-client'
import type { Booking, BookingManagementDetails } from '@/types/booking'

export const bookingsListConfig = {
  url: '/bookings/list',
  toPayload: (state: DataTableState<Booking>, filters?: Record<string, unknown>) => toApiListDto(state, filters),
  toResult: (result: ApiListResult<unknown>): DataTableAsyncResult<Booking> => toDataTableResult(result as ApiListResult<Booking>),
}

export async function getBookingsRequest(state: DataTableState<Booking>, filters?: Record<string, unknown>) {
  const result = await apiClient.post<ApiListResult<Booking>>(bookingsListConfig.url, bookingsListConfig.toPayload(state, filters))
  return toDataTableResult(result)
}

export function getBookingManagementDetailsRequest(bookingId: string) {
  return apiClient.get<BookingManagementDetails>(`/bookings/manage/${encodeURIComponent(bookingId)}`)
}
