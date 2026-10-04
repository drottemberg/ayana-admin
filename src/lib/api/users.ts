import { apiClient } from '@/lib/api-client'
import { SortOrder, type ApiListResult } from '@/lib/api-types'
import type { UserDto } from '@/lib/entities/user.entity'

export function getUsersListDtoRequest(): Promise<ApiListResult<UserDto>> {
  return apiClient.post<ApiListResult<UserDto>>('/users/list', {
    limit: 100,
    orderBy: 'createdAt',
    order: SortOrder.desc,
  })
}

export function getUserDtoRequest(userId: string): Promise<UserDto> {
  return apiClient.get<UserDto>(`/users/${userId}`)
}

export function createUserDtoRequest(payload: UserDto): Promise<UserDto> {
  return apiClient.post<UserDto>('/users', payload)
}

export function updateUserDtoRequest(userId: string, payload: UserDto): Promise<UserDto> {
  return apiClient.patch<UserDto>(`/users/${userId}`, payload)
}
