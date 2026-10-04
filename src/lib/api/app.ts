import { apiClient } from '@/lib/api-client'
import type { AppConnectDto } from '@/lib/entities/app-connect.entity'

export function connectAppRequest(): Promise<AppConnectDto> {
  return apiClient.get<AppConnectDto>('/app/connect')
}
