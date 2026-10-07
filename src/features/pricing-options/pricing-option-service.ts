import { toast } from 'sonner'

import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { deletePricingOptionRequest, setPricingOptionStatusRequest } from '@/features/pricing-options/api'
import { pricingOptionsQueryKeys } from '@/features/pricing-options/query-keys'
import { queryClient } from '@/lib/query-client'
import { Modals } from '@/providers/modal'
import type { PricingOption } from '@/types/pricing-option'

type PricingOptionActionOptions = {
  canEdit: boolean
  canDelete: boolean
  onEdit: (option: PricingOption) => void
}

export const PricingOptionService = {
  async setStatus(option: PricingOption, isActive: boolean) {
    try {
      await setPricingOptionStatusRequest(option.organizationId, option.id, isActive)
      await queryClient.invalidateQueries({ queryKey: pricingOptionsQueryKeys.all })
      toast.success(isActive ? 'Pricing option enabled.' : 'Pricing option disabled.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update pricing option status.')
    }
  },

  async delete(option: PricingOption) {
    const confirmed = await Modals.confirm({
      operation: `delete pricing option “${option.name}”`,
      okButtonProps: { variant: 'destructive' },
    })
    if (!confirmed) return

    try {
      await deletePricingOptionRequest(option.organizationId, option.id)
      await queryClient.invalidateQueries({ queryKey: pricingOptionsQueryKeys.all })
      toast.success('Pricing option deleted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete pricing option.')
    }
  },

  getRowActions(option: PricingOption, options: PricingOptionActionOptions): DropdownActionItem[] {
    if (option.isDeleted || option.status === 'DELETED') return []

    const actions: DropdownActionItem[] = []
    if (options.canEdit) {
      actions.push({ label: 'Edit', onClick: () => options.onEdit(option) })
      actions.push({
        label: option.isActive ? 'Disable' : 'Enable',
        onClick: () => void this.setStatus(option, !option.isActive),
      })
    }
    if (options.canDelete) {
      actions.push({ label: 'Delete', variant: 'destructive', onClick: () => void this.delete(option) })
    }
    return actions
  },
}
