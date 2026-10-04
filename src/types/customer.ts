import { OrganizationType, type Organization } from '@/types/organization'

export type Customer = Pick<
  Organization,
  | 'id'
  | 'name'
  | 'email'
  | 'phone'
  | 'timezone'
  | 'users'
  | 'stores'
  | 'status'
  | 'isDeleted'
  | 'isArchived'
  | 'contactName'
  | 'contactPhone'
  | 'contactEmail'
  | 'createdAt'
> & {
  type: typeof OrganizationType.CUSTOMER
}

export type CreateCustomerPayload = Pick<Customer, 'name' | 'contactName' | 'contactEmail' | 'contactPhone'>

export type { CreateStorePayload, Store } from '@/types/store'
