import { toast } from 'sonner'

import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { setAyanaProductStatusRequest, updateProductManagementRequest } from '@/features/products/api'
import { productsQueryKeys } from '@/features/products/query-keys'
import { queryClient } from '@/lib/query-client'
import type { Product } from '@/types/product'

export const ProductManagementService = {
  async setActive(product: Product, isActive: boolean) {
    try {
      await setAyanaProductStatusRequest(product, isActive)
      await queryClient.invalidateQueries({ queryKey: productsQueryKeys.all })
      toast.success(isActive ? 'Product enabled.' : 'Product disabled.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update product status.')
    }
  },

  async setVariantActive(product: Product, variantId: string, isActive: boolean) {
    try {
      const variants = (product.variants ?? []).map((variant) =>
        variant.id === variantId ? { ...variant, isActive } : variant,
      )
      await updateProductManagementRequest(product, { variants })
      await queryClient.invalidateQueries({ queryKey: productsQueryKeys.detail(product.id) })
      toast.success(isActive ? 'Variant enabled.' : 'Variant disabled.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update variant status.')
    }
  },

  async removeModifierGroup(product: Product, groupId: string) {
    try {
      await updateProductManagementRequest(product, {
        modifierGroups: (product.modifierGroups ?? []).filter((group) => group.id !== groupId),
      })
      await queryClient.invalidateQueries({ queryKey: productsQueryKeys.detail(product.id) })
      toast.success('Option group removed from this product.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the option group.')
    }
  },

  getRowActions(
    product: Product,
    options: {
      canEdit: boolean
      onEdit: (product: Product) => void
      onEditScope: (product: Product) => void
    },
  ): DropdownActionItem[] {
    if (!options.canEdit) return []
    return [
      { label: 'Edit product', onClick: () => options.onEdit(product) },
      { label: 'Edit visibility', onClick: () => options.onEditScope(product) },
      {
        label: product.status === 'ACTIVE' ? 'Disable' : 'Enable',
        onClick: () => void this.setActive(product, product.status !== 'ACTIVE'),
      },
    ]
  },
}
