import { OrganizationType, type Organization } from '@/types/organization'

export type Customer = Pick<
  Organization,
  | 'id'
  | 'name'
  | 'slug'
  | 'email'
  | 'phone'
  | 'timezone'
  | 'currency'
  | 'address'
  | 'description'
  | 'users'
  | 'stores'
  | 'locations'
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

export type CreateCustomerPayload = Pick<
  Customer,
  'name' | 'slug' | 'email' | 'phone' | 'timezone' | 'currency' | 'description' | 'contactName' | 'contactEmail' | 'contactPhone'
>

export type { CreateStorePayload, Store } from '@/types/store'
