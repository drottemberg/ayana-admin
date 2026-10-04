import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { SortOrder, toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'
import type { CreateCustomerPayload, Customer } from '@/types/customer'
import { type Organization, type OrganizationStatus } from '@/types/organization'
import { apiClient } from '@/lib/api-client'

export function toCustomer(organization: Organization): Customer {
  return organization
}

export async function getCustomersListRequest(filters?: Record<string, unknown>, search?: string): Promise<Customer[]> {
  const result = await apiClient.post<ApiListResult<Organization>>('/customers/list', {
    filters: { contractId: null, ...filters },
    search: search?.trim() || undefined,
    limit: 100,
    orderBy: 'name',
    order: SortOrder.asc,
  })

  return result.items.map(toCustomer)
}

export async function getCustomersRequest(
  tableState: DataTableState<Customer>,
  hiddenFilters?: Record<string, unknown>,
): Promise<DataTableAsyncResult<Customer>> {
  // Sent as an array (checked Active + Archived → both), matching the Users status filter —
  // organizations.repository.ts's status filter needs to OR multiple values the same way
  // UsersRepository's does, not the old single-value `=` equality.
  const result = await apiClient.post<ApiListResult<Organization>>(
    '/customers/list',
    toApiListDto(tableState, hiddenFilters),
  )

  return toDataTableResult({
    ...result,
    items: result.items.map(toCustomer),
  })
}

export async function getCustomerRequest(customerId: string): Promise<Customer> {
  return toCustomer(await apiClient.get<Organization>(`/customers/${customerId}`))
}

export async function createCustomerRequest(payload: CreateCustomerPayload): Promise<Customer> {
  const organization = await apiClient.post<Organization>('/customers', payload)
  return toCustomer(organization)
}

export async function updateCustomerRequest(customerId: string, payload: CreateCustomerPayload): Promise<Customer> {
  const organization = await apiClient.patch<Organization>(`/customers/${customerId}`, payload)
  return toCustomer(organization)
}

// These use the real, guarded /customers/* routes — NOT /organizations/:id, which was removed
// from the backend (see gkManager-backend/src/organizations/organizations.module.ts's comment).
// OrganizationService used to call that dead endpoint for delete/status/archive on customers.
export async function deleteCustomerRequest(customerId: string): Promise<void> {
  await apiClient.delete(`/customers/${customerId}`)
}

export async function setCustomerStatusRequest(customerId: string, status: OrganizationStatus): Promise<void> {
  await apiClient.patch(`/customers/${customerId}/status`, { status })
}

export async function archiveCustomerRequest(customerId: string): Promise<void> {
  await apiClient.post(`/customers/${customerId}/archive`)
}

export async function unarchiveCustomerRequest(customerId: string): Promise<void> {
  await apiClient.post(`/customers/${customerId}/unarchive`)
}
