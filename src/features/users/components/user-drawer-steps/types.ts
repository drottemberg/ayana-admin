import type { CreateUserPayload, InviteUserPayload, User, UserRole } from '@/types/user'

export type UserFlowAction = 'invite' | 'invite-staff' | 'create'

export type UserDrawerStep =
  | 'action'
  | 'invite'
  | 'invite-staff'
  | 'create'
  | 'success'
  | 'permissions'
  | 'edit-details'
  | 'edit-permissions'

export type UserDrawerData = {
  action?: UserFlowAction
  role?: UserRole
  permissions?: User['permissions']
  savedUser?: User
  savedPayload?: CreateUserPayload | InviteUserPayload
  formValues?: {
    firstName?: string
    lastName?: string
    email: string
    password?: string
    phone?: string
    position?: string
  }
}
