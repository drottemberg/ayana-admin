import { toast } from 'sonner'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import type { ClientContract } from '@/types/client-contract'
import { cancelClientContractRequest, resumeClientContractRequest } from './api'
import { clientContractsQueryKeys } from './query-keys'
import { queryClient } from '@/lib/query-client'
import { Modals } from '@/providers/modal'

export const ClientContractService = {
  async cancel(contract: ClientContract) {
    const confirmed = await Modals.confirm({ operation: `cancel client contract “${contract.pricingOption?.name ?? 'complimentary credits'}”`, okButtonProps: { variant: 'destructive' } })
    if (!confirmed) return
    try {
      await cancelClientContractRequest(contract.id)
      await queryClient.invalidateQueries({ queryKey: clientContractsQueryKeys.all })
      toast.success('Client contract cancelled.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cancel client contract.')
    }
  },
  async resume(contract: ClientContract) {
    try {
      await resumeClientContractRequest(contract.id)
      await queryClient.invalidateQueries({ queryKey: clientContractsQueryKeys.all })
      toast.success('Client contract resumed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not resume client contract.')
    }
  },
  getRowActions(
    contract: ClientContract,
    canManage: boolean,
    creditActions?: {
      onGrant?: (contract: ClientContract) => void
      onRemove?: (contract: ClientContract) => void
      onHistory?: (contract: ClientContract) => void
    },
  ): DropdownActionItem[] {
    const actions: DropdownActionItem[] = []
    if (creditActions?.onHistory) actions.push({ label: 'Credit history', onClick: () => creditActions.onHistory!(contract) })
    if (canManage && creditActions?.onGrant && contract.status === 'ACTIVE' && contract.creditsRemaining !== null) {
      actions.push({ label: 'Grant credits', onClick: () => creditActions.onGrant!(contract) })
    }
    if (canManage && creditActions?.onRemove && contract.status === 'ACTIVE' && contract.creditsRemaining !== null && contract.creditsRemaining > 0) {
      actions.push({ label: 'Remove credits', variant: 'destructive', onClick: () => creditActions.onRemove!(contract) })
    }
    if (!canManage) return actions
    if (contract.status === 'PAUSED') actions.push({ label: 'Resume', onClick: () => void this.resume(contract) })
    else if (contract.status === 'ACTIVE' || contract.status === 'PENDING') {
      actions.push({ label: 'Cancel', variant: 'destructive', onClick: () => void this.cancel(contract) })
    }
    return actions
  },
}
