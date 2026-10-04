import { OrganizationType, type Organization } from '@/types/organization'
import type { UserOrganizationPermission, UserRole } from '@/types/user'

export type MaintenancePartner = Pick<Organization, 'id' | 'name' | 'email' | 'phone' | 'users'> & {
  type: typeof OrganizationType.MAINTENANCE
  permissions?: UserOrganizationPermission[]
}

export type CreatePartnerPayload = {
  name: string
  role?: UserRole
  permissions?: UserOrganizationPermission[]
}
