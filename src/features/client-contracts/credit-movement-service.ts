import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import type { ClientContractCreditMovement } from '@/types/client-contract'
import { Drawer, DrawerId } from '@/providers/drawer'

export function getCreditMovementRowActions(
  movement: ClientContractCreditMovement,
  canManage: boolean,
): DropdownActionItem[] {
  if (!canManage) return []
  return [{
    label: 'Edit credit transaction',
    onClick: () => { void Drawer.show(DrawerId.CreditExpiration, { kind: 'movement', movement }) },
  }]
}
