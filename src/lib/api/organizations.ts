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

export function setOrganizationStatusRequest(organizationId: string, status: 'ACTIVE' | 'PENDING' | 'DELETED'): Promise<void> {
  return apiClient.patch(`/organizations/${organizationId}/status`, { status })
}

export const organizationTreeQueryKeys = {
  full: () => ['organization-tree', 'full'] as const,
  lazyRoot: ['organization-tree', 'lazy', 1] as const,
}

// NOTE: the generic /organizations/* controller these two used to call was removed from the
// backend (see gkManager-backend/src/organizations/organizations.module.ts's comment — it
// bypassed every per-type permission model). Rebuilt on the real, guarded /customers/*,
// /stores/* endpoints instead — same OrganizationPermissionNode shape, so every caller of
// these functions (Customer invite, Create/Edit user, Create partner) keeps working unchanged.
const TREE_PAGE_SIZE = 50

type OrganizationListItem = { id?: string | null; name?: string | null; email?: string | null; phone?: string | null; stores?: number }

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
    hasChildren: (item.stores ?? 0) > 0,
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
  const result = await apiClient.post<ApiListResult<OrganizationListItem>>(`/customers/${node.id}/stores`, {
    page,
    limit: TREE_PAGE_SIZE,
    orderBy: 'name',
    order: SortOrder.asc,
  })
  const directChildren = result.items.map((item) => ({
    id: item.id!,
    name: item.name!,
    type: OrganizationType.STORE,
    parentId: node.id,
    hasChildren: false,
    children: [] as OrganizationPermissionNode[],
  }))

  return { ...node, children: directChildren, hasChildren: directChildren.length > 0, hasMore: hasMorePages(result) }
}

export const partnerTreeQueryKeys = {
  full: () => ['partner-tree', 'full'] as const,
  lazyRoot: ['partner-tree', 'lazy', 1] as const,
}

function orgListItemToPartnerNode(item: OrganizationListItem): OrganizationPermissionNode {
  return {
    id: item.id!,
    name: item.name!,
    type: OrganizationType.MAINTENANCE,
    email: item.email ?? undefined,
    phone: item.phone ?? undefined,
    hasChildren: true,
    children: [],
  }
}

export async function getPartnersPermissionTreeRequest(page = 1): Promise<OrganizationPermissionNode | null> {
  const result = await apiClient.post<ApiListResult<OrganizationListItem>>('/maintenance-partners/list', {
    page,
    limit: TREE_PAGE_SIZE,
    orderBy: 'name',
    order: SortOrder.asc,
  })
  if (!result.items.length) return null

  return {
    id: 'root',
    name: 'All partners',
    type: OrganizationType.MASTER,
    hasMore: hasMorePages(result),
    children: result.items.map(orgListItemToPartnerNode),
  }
}

// Customers within this partner's MaintenanceScope grant — POST /customers/list filtered by
// partnerId (not every customer in the system). NOT YET AVAILABLE ON BACKEND: /customers/list's
// filters don't support partnerId yet (checked customers/dto.ts's CustomerListDto and
// customers.repository.ts's filter handling — no partnerId there). Flagged for the backend team;
// this 400/500s (silently ignored filter, or a validation error, depending on how the DTO
// rejects unknown keys) until that filter is added.
export async function getPartnerScopedCustomersPermissionNode(
  node: OrganizationPermissionNode,
  page = 1,
): Promise<OrganizationPermissionNode | null> {
  const partnerId = node.entityId ?? node.id
  const result = await apiClient.post<ApiListResult<OrganizationListItem>>('/customers/list', {
    filters: { partnerId },
    page,
    limit: TREE_PAGE_SIZE,
    orderBy: 'name',
    order: SortOrder.asc,
  })
  // id is namespaced per-partner (not the bare customer id) — the same customer can be
  // scoped to more than one partner, and expand/select state is a plain Set<string> keyed
  // by id, so a shared id would make expanding/selecting it under one partner affect every
  // partner it's scoped to. entityId carries the real customer id for API/payload use.
  const directChildren = result.items.map((item) => ({
    id: `${partnerId}::${item.id}`,
    entityId: item.id!,
    name: item.name!,
    type: OrganizationType.CUSTOMER,
    parentId: node.id,
    hasChildren: true,
    children: [] as OrganizationPermissionNode[],
  }))

  return { ...node, children: directChildren, hasChildren: directChildren.length > 0, hasMore: hasMorePages(result) }
}

// Stores within this customer AND within the given partner's scope over that customer —
// POST /stores/list filtered by customerId + partnerId. NOT YET AVAILABLE ON BACKEND:
// /stores/list's filters only support customerId today (checked stores/dto.ts and
// stores.repository.ts — no partnerId in the destructured filter list). Flagged for the
// backend team; until it's added this returns every store on the customer, not just the
// partner-scoped subset.
export async function getPartnerScopedStoresPermissionNode(
  node: OrganizationPermissionNode,
  partnerId: string,
  page = 1,
): Promise<OrganizationPermissionNode | null> {
  const customerId = node.entityId ?? node.id
  const result = await apiClient.post<ApiListResult<OrganizationListItem>>('/stores/list', {
    filters: { customerId, partnerId },
    page,
    limit: TREE_PAGE_SIZE,
    orderBy: 'name',
    order: SortOrder.asc,
  })
  // Same reasoning as getPartnerScopedCustomersPermissionNode: the same store can be scoped
  // via more than one partner (its customer scoped to partner A and partner B both), so id
  // is namespaced under this node's (already-namespaced) id, not the bare store id.
  const directChildren = result.items.map((item) => ({
    id: `${node.id}::${item.id}`,
    entityId: item.id!,
    name: item.name!,
    type: OrganizationType.STORE,
    parentId: node.id,
    hasChildren: false,
    children: [] as OrganizationPermissionNode[],
  }))

  return { ...node, children: directChildren, hasChildren: directChildren.length > 0, hasMore: hasMorePages(result) }
}
