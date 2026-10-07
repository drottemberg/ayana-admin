import type { Organization, OrganizationStatus } from '@/types/organization'

export type Location = Omit<Organization, 'type'> & {
  type: 'LOCATION'
  status?: OrganizationStatus
  parentId?: string
  customerName?: string
}
