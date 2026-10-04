import type { Customer } from '@/types/customer'

export type ProductBrand = {
  id: string
  customerId?: string | null
  name: string
}

export const ProductStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
} as const

export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus]

export const ProductStatusValues = [
  ProductStatus.ACTIVE,
  ProductStatus.DISABLED,
  ProductStatus.ARCHIVED,
  ProductStatus.DELETED,
] as const

export type Product = {
  id: string
  name: string
  customer: Customer
  brand?: ProductBrand | null
  status?: ProductStatus
  isArchived?: boolean
  isDeleted?: boolean
  createdAt: string
  updatedAt?: string
}

export type ProductDeviceHistoryPeriod = {
  id: string
  productId: string
  deviceId: string
  assignedAt: string
  unassignedAt?: string | null
}

export type ProductDeviceHistory = {
  id: string
  productId: string
  deviceId: string
  product: Product
  status: 'ACTIVE' | 'INACTIVE'
  assignedAt: string
  unassignedAt?: string | null
  history: ProductDeviceHistoryPeriod[]
}

export type CreateProductPayload = {
  name: string
  customerId: string
  brandId?: string
}

export type UpdateProductPayload = Partial<CreateProductPayload> & {
  status?: Extract<ProductStatus, 'ACTIVE' | 'DISABLED'>
}
