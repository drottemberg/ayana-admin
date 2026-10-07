import { apiClient } from '@/lib/api-client'
import type {
  CheckOrgInviteUserPayload,
  CheckOrgInviteUserResult,
  SendOrgInvitePayload,
  UserRequest,
} from '@/types/user-request'
import type { InviteCustomerPayload, InviteStaffPayload } from '@/types/membership'

export type InviteStaffResult =
  | { created: true; user: { id: string; email: string; firstName: string; lastName: string } }
  | { created: false; request: UserRequest }

type UserRequestsListResponse = {
  userRequests: UserRequest[]
}

type UserRequestResponse = {
  request: UserRequest
}

function toOrgInvitePayload(payload: SendOrgInvitePayload) {
  return {
    login: payload.login,
    role: payload.role,
    position: payload.position,
    permissions: payload.permissions.map((permission) => ({
      id: permission.organizationId,
      role: permission.role ?? payload.role,
    })),
  }
}

export async function getUserRequestsRequest(): Promise<UserRequest[]> {
  const result = await apiClient.post<UserRequestsListResponse>('/user-requests/list')

  return result.userRequests
}

export function checkOrgInviteUserRequest(payload: CheckOrgInviteUserPayload): Promise<CheckOrgInviteUserResult> {
  return apiClient.post<CheckOrgInviteUserResult>('/user-requests/org-invite/check-user', payload)
}

export async function sendOrgInviteRequest(payload: SendOrgInvitePayload): Promise<UserRequest> {
  const result = await apiClient.post<UserRequestResponse>(
    '/user-requests/org-invite/send',
    toOrgInvitePayload(payload),
  )

  return result.request
}

export async function inviteStaffRequest(payload: InviteStaffPayload): Promise<InviteStaffResult> {
  return apiClient.post<InviteStaffResult>('/user-requests/invite/staff', payload)
}

export async function inviteCustomerRequest(payload: InviteCustomerPayload): Promise<UserRequest[]> {
  const result = await apiClient.post<{ requests: UserRequest[] }>('/user-requests/invite/customer', payload)
  return result.requests
}

export async function acceptUserRequestRequest(requestId: string): Promise<UserRequest> {
  const result = await apiClient.post<UserRequestResponse>(`/user-requests/${requestId}/accept`)

  return result.request
}

export async function rejectUserRequestRequest(requestId: string, reason?: string): Promise<UserRequest> {
  const result = await apiClient.post<UserRequestResponse>(`/user-requests/${requestId}/reject`, { reason })

  return result.request
}

export async function cancelUserRequestRequest(requestId: string, reason?: string): Promise<UserRequest> {
  const result = await apiClient.post<UserRequestResponse>(`/user-requests/${requestId}/cancel`, { reason })

  return result.request
}
