import type { UserOrganizationPermission, UserRole } from '@/types/user'

export const UserRequestStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const

export type UserRequestStatus = (typeof UserRequestStatus)[keyof typeof UserRequestStatus]

export const UserRequestType = {
  GENERIC: 'GENERIC',
  ORG_INVITE: 'ORG_INVITE',
} as const

export type UserRequestType = (typeof UserRequestType)[keyof typeof UserRequestType]

export type UserRequestRecipient = {
  type: string
  value: string
  displayName?: string | null
}

export type UserRequestOrgInviteMetadata = {
  kind?: string | null
  name?: string | null
  recipientUserId?: string | null
  orgId?: string | null
  organizationId?: string | null
  orgName?: string | null
  position?: string | null
  role?: UserRole | string | null
  orgs?: Array<{ id: string; role: UserRole | string; position?: string | null }>
}

export type UserRequest = {
  id: string
  userId?: string | null
  isSent: boolean
  isReceived?: boolean
  status: UserRequestStatus
  type: UserRequestType
  recipients: UserRequestRecipient[]
  metadata?: UserRequestOrgInviteMetadata | Record<string, unknown> | null
  reason?: string | null
  actionBy?: string | null
  actionAt?: number | null
  createdAt?: number | null
  updatedAt?: number | null
  senderName?: string | null
}

export type CheckOrgInviteUserPayload = {
  login: string
}

export type CheckOrgInviteUserResult = {
  type: string
  value: string
  user?: {
    id?: string | null
    firstName?: string | null
    lastName?: string | null
    email?: string | null
  } | null
}

export type SendOrgInvitePayload = {
  login: string
  role: UserRole
  position: string
  permissions: UserOrganizationPermission[]
}
