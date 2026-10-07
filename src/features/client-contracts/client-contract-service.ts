import { toast } from 'sonner'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import type { ClientContract } from '@/types/client-contract'
import { cancelClientContractRequest, resumeClientContractRequest } from './api'
import { clientContractsQueryKeys } from './query-keys'
import { queryClient } from '@/lib/query-client'
import { Modals } from '@/providers/modal'

export const ClientContractService = {
  async cancel(contract: ClientContract) {
    const confirmed = await Modals.confirm({ operation: `cancel client contract “${contract.pricingOption?.name ?? contract.id}”`, okButtonProps: { variant: 'destructive' } })
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
  getRowActions(contract: ClientContract, canManage: boolean): DropdownActionItem[] {
    if (!canManage) return []
    if (contract.status === 'PAUSED') return [{ label: 'Resume', onClick: () => void this.resume(contract) }]
    if (contract.status === 'ACTIVE' || contract.status === 'PENDING') {
      return [{ label: 'Cancel', variant: 'destructive', onClick: () => void this.cancel(contract) }]
    }
    return []
  },
}
