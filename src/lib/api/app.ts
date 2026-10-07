import { apiClient } from '@/lib/api-client'
import type { AppConnectDto } from '@/lib/entities/app-connect.entity'
import { getAppMode } from '@/features/app/app-mode'
import { readSelectedOrgId } from '@/features/organizations/storage'

export function connectAppRequest(): Promise<AppConnectDto> {
  const selectedOrganizationId = readSelectedOrgId()
  const headers = selectedOrganizationId && getAppMode() === 'customer'
    ? { 'x-org-id': selectedOrganizationId }
    : undefined
  return apiClient.get<AppConnectDto>('/app/connect', { headers })
}
