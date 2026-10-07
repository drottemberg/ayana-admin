import { apiClient } from '@/lib/api-client'
import { SortOrder, type ApiListResult } from '@/lib/api-types'
import type { OrganizationDto } from '@/lib/entities/organization.entity'
import { OrganizationType } from '@/types/organization'
import type { OrganizationPermissionNode } from '@/features/users/components/user-drawer-steps/organization-permissions'

export function getOrganizationsListDtoRequest(
  filters?: Record<string, unknown>,
): Promise<ApiListResult<OrganizationDto>> {
  return apiClient.post<ApiListResult<OrganizationDto>>('/organizations/list', {
    filters,
    limit: 100,
    orderBy: 'name',
    order: SortOrder.asc,
  })
}

export function getOrganizationDtoRequest(organizationId: string): Promise<OrganizationDto> {
  return apiClient.get<OrganizationDto>(`/organizations/${organizationId}`)
}

export function createOrganizationDtoRequest(payload: OrganizationDto): Promise<OrganizationDto> {
  return apiClient.post<OrganizationDto>('/organizations', payload)
}

export function updateOrganizationDtoRequest(
  organizationId: string,
  payload: OrganizationDto,
): Promise<OrganizationDto> {
  return apiClient.patch<OrganizationDto>(`/organizations/${organizationId}`, payload)
}

export function deleteOrganizationRequest(organizationId: string): Promise<void> {
  return apiClient.delete(`/organizations/${organizationId}`)
}

export function setOrganizationStatusRequest(
  organizationId: string,
  status: 'ACTIVE' | 'PENDING' | 'DELETED',
): Promise<void> {
  return apiClient.patch(`/organizations/${organizationId}/status`, { status })
}

export const organizationTreeQueryKeys = {
  full: () => ['organization-tree', 'full'] as const,
  lazyRoot: ['organization-tree', 'lazy', 1] as const,
}

// NOTE: the generic /organizations/* controller these two used to call was removed from the
// backend because it bypassed the per-type permission model. These permission trees use the
// guarded /customers/* and /locations/* endpoints.
const TREE_PAGE_SIZE = 50

type OrganizationListItem = {
  id?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  locations?: number
}

function hasMorePages(result: ApiListResult<unknown>): boolean {
  return result.page * result.limit < result.total
}

function orgListItemToCustomerNode(item: OrganizationListItem): OrganizationPermissionNode {
  return {
    id: item.id!,
    name: item.name!,
    type: OrganizationType.CUSTOMER,
    email: item.email ?? undefined,
    phone: item.phone ?? undefined,
    hasChildren: (item.locations ?? 0) > 0,
    children: [],
  }
}

export async function getOrganizationsPermissionTreeRequest(page = 1): Promise<OrganizationPermissionNode | null> {
  const result = await apiClient.post<ApiListResult<OrganizationListItem>>('/customers/list', {
    page,
    limit: TREE_PAGE_SIZE,
    orderBy: 'name',
    order: SortOrder.asc,
  })
  if (!result.items.length) return null

  return {
    id: 'root',
    name: 'All organizations',
    type: OrganizationType.MASTER,
    hasMore: hasMorePages(result),
    children: result.items.map(orgListItemToCustomerNode),
  }
}

export async function getOrganizationChildrenPermissionNode(
  node: OrganizationPermissionNode,
  page = 1,
): Promise<OrganizationPermissionNode | null> {
  const result = await apiClient.post<ApiListResult<OrganizationListItem>>('/locations/list', {
    filters: { customerId: node.id },
    page,
    limit: TREE_PAGE_SIZE,
    orderBy: 'name',
    order: SortOrder.asc,
  })
  const directChildren = result.items.map((item) => ({
    id: item.id!,
    name: item.name!,
    type: OrganizationType.LOCATION,
    parentId: node.id,
    hasChildren: false,
    children: [] as OrganizationPermissionNode[],
  }))

  return { ...node, children: directChildren, hasChildren: directChildren.length > 0, hasMore: hasMorePages(result) }
}
