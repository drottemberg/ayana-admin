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
  customerName?: string | null
  customerId?: string
  organizationId?: string
  productType?: { id: string; name: string; vatRate?: number | string } | null
  productTypes?: { id: string; name: string; vatRate?: number | string }[]
  /** null inherits the selected product category rate; values are fractions (0.20 = 20%). */
  vatRate?: number | string | null
  description?: string | null
  isOnline?: boolean
  isInStore?: boolean
  isActive?: boolean
  isSellable?: boolean
  currency?: string | null
  scope?: 'ALL' | 'SPECIFIC'
  locations?: ProductLocationAssignment[]
  variants?: ProductVariant[]
  modifierGroups?: ProductModifierGroup[]
  brand?: ProductBrand | null
  status?: ProductStatus
  isArchived?: boolean
  isDeleted?: boolean
  createdAt: string
  updatedAt?: string
}

export type ProductAttribute = { name: string; value: string }

export type ProductVariant = {
  id?: string
  sku?: string | null
  price: number
  stock: number
  barcode?: string | null
  isActive: boolean
  attributes?: ProductAttribute[]
}

export type ProductModifier = {
  id?: string
  name: string
  price: number
  isDefault: boolean
  isActive: boolean
  priceOverride: number | null
  isAvailable: boolean
}

export type ProductModifierGroup = {
  id?: string
  name: string
  isRequired: boolean
  minSelect: number
  maxSelect: number
  isActive: boolean
  modifiers: ProductModifier[]
}

export type ProductLocationAssignment = {
  locationId: string
  isInScope: boolean
  isAvailable: boolean
  hasOverrides?: boolean
  variantOverrides?: { variantId: string; isAvailable: boolean; priceOverride: number | null; stockOverride: number | null }[]
  location?: { id: string; name: string | null } | null
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

export type UpdateProductManagementPayload = {
  name?: string
  description?: string | null
  productTypeId?: string
  vatRate?: number | null
  isOnline?: boolean
  isInStore?: boolean
  isSellable?: boolean
  variants?: ProductVariant[]
  modifierGroups?: ProductModifierGroup[]
}
