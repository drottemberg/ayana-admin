import { apiClient } from '@/lib/api-client'

export type BatchRequestItemDto = {
  url: string
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  payload?: Record<string, unknown>
  query?: Record<string, unknown>
}

export type BatchRequestDto = Record<string, BatchRequestItemDto>

export async function batchListRequest<T extends Record<string, unknown> = Record<string, unknown>>(
  dto: BatchRequestDto,
): Promise<T> {
  return apiClient.post<T>('/app/batch/list', dto)
}
