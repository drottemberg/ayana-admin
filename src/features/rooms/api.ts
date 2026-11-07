import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { apiClient } from '@/lib/api-client'

export type Room = {
  id: string
  organizationId: string
  name: string
  isDefault: boolean
  isEnabled: boolean
  capacity?: number | null
  resourceId?: string | null
}

export async function getLocationRoomsRequest(locationId: string): Promise<Room[]> {
  return apiClient.get<Room[]>('/rooms', { headers: { 'x-org-id': locationId } })
}

export async function loadLocationRoomsRequest(locationId: string, state: DataTableState<Room>): Promise<DataTableAsyncResult<Room>> {
  const allRooms = await getLocationRoomsRequest(locationId)
  const query = state.search.trim().toLocaleLowerCase()
  const filtered = allRooms.filter((room) => !query || room.name.toLocaleLowerCase().includes(query))
  const start = state.pagination.pageIndex * state.pagination.pageSize
  return {
    items: filtered.slice(start, start + state.pagination.pageSize),
    count: filtered.length,
    pageCount: Math.max(1, Math.ceil(filtered.length / state.pagination.pageSize)),
  }
}

export function createRoomRequest(locationId: string, name: string) {
  return apiClient.post<Room>('/rooms', { name }, { headers: { 'x-org-id': locationId } })
}

export function updateRoomRequest(locationId: string, roomId: string, payload: { name?: string; isEnabled?: boolean }) {
  return apiClient.patch<Room>(`/rooms/${encodeURIComponent(roomId)}`, payload, { headers: { 'x-org-id': locationId } })
}
