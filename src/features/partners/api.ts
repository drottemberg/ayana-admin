import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import type { CreatePartnerPayload, MaintenancePartner } from '@/types/partner'
import { type Organization, type OrganizationStatus } from '@/types/organization'
import { apiClient } from '@/lib/api-client'
import type { UserOrganizationPermission, UserRole } from '@/types/user'

type PermissionRecord = {
  organizationId?: string
  role?: string | null
  explicit?: boolean
}

type OrgWithPermissionRecord = {
  organization: Organization & { parentId?: string | null }
  permission?: PermissionRecord | null
}

const PARTNERS_LIST_URL = '/maintenance-partners/list'

function toPartner(organization: Organization): MaintenancePartner {
  return organization as MaintenancePartner
}

export function toPartnersTableResult(result: ApiListResult<Organization>): DataTableAsyncResult<MaintenancePartner> {
  return toDataTableResult({
    ...result,
    items: result.items.map(toPartner),
  })
}

export const partnersListConfig = {
  url: PARTNERS_LIST_URL,
  toPayload: toApiListDto<MaintenancePartner>,
  toResult: (result: ApiListResult<unknown>) => toPartnersTableResult(result as ApiListResult<Organization>),
}

async function fetchPartnerPermissions(partnerId: string): Promise<UserOrganizationPermission[]> {
  const result = await apiClient.post<ApiListResult<OrgWithPermissionRecord>>('/organizations/list', {
    limit: 200,
    includePermission: true,
    permissionObjectId: partnerId,
    permissionObjectType: 'ORGANIZATION',
    filters: {
      organizationId: partnerId,
    },
  })

  return result.items
    .filter((item) => item.permission?.explicit === true)
    .map((item) => ({
      organizationId: item.organization.id!,
      role: (item.permission?.role as UserRole | null) ?? null,
      parentId: item.organization.parentId ?? undefined,
    }))
}

export async function getPartnersRequest(
  tableState: DataTableState<MaintenancePartner>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<MaintenancePartner>> {
  const result = await apiClient.post<ApiListResult<Organization>>(
    partnersListConfig.url,
    partnersListConfig.toPayload(tableState, hiddenFilters),
  )

  return toPartnersTableResult(result)
}

export async function getPartnerRequest(partnerId: string): Promise<MaintenancePartner> {
  const [org, permissions] = await Promise.all([
    apiClient.get<Organization>(`/maintenance-partners/${partnerId}`),
    fetchPartnerPermissions(partnerId),
  ])

  return { ...toPartner(org), permissions }
}

export async function createPartnerRequest(payload: CreatePartnerPayload): Promise<MaintenancePartner> {
  const organization = await apiClient.post<Organization>('/maintenance-partners', payload)
  return toPartner(organization)
}

export async function updatePartnerRequest(
  partnerId: string,
  payload: CreatePartnerPayload,
): Promise<MaintenancePartner> {
  const organization = await apiClient.patch<Organization>(`/maintenance-partners/${partnerId}`, {
    name: payload.name,
    permissions: Array.isArray(payload.permissions)
      ? payload.permissions.map(({ organizationId, role }) => ({ organizationId, role }))
      : undefined,
  })

  return toPartner(organization)
}

// Real, guarded /maintenance-partners/* routes — not the removed generic /organizations/:id.
// No archive endpoint exists for partners yet (checked maintenance-partners.controller.ts).
export async function deletePartnerRequest(partnerId: string): Promise<void> {
  await apiClient.delete(`/maintenance-partners/${partnerId}`)
}

export async function setPartnerStatusRequest(partnerId: string, status: OrganizationStatus): Promise<void> {
  await apiClient.patch(`/maintenance-partners/${partnerId}/status`, { status })
}
