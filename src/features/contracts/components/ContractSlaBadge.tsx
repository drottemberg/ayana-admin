import { Badge } from '@/components/ui/badge'
import { ContractService } from '@/features/contracts/contract-service'
import { ContractSlaType, type ContractSlaType as ContractSlaTypeValue } from '@/types/contract'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import ShieldBanIcon from '@hugeicons/core-free-icons/ShieldBanIcon'
import ShieldPlusIcon from '@hugeicons/core-free-icons/ShieldPlusIcon'
import ShieldEnergyIcon from '@hugeicons/core-free-icons/ShieldEnergyIcon'
import ShieldHalfIcon from '@hugeicons/core-free-icons/ShieldHalfIcon'

type ContractSlaBadgeProps = {
  slaType: ContractSlaTypeValue
}

export function ContractSlaBadge({ slaType }: ContractSlaBadgeProps) {
  const className =
    slaType === ContractSlaType.ClassAAA
      ? 'border-orange-200 bg-orange-50 text-orange-700'
      : slaType === ContractSlaType.ClassAA
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : slaType === ContractSlaType.ClassA
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'bg-muted text-foreground'
  const icon: IconSvgElement =
    slaType === ContractSlaType.ClassAAA
      ? ShieldEnergyIcon
      : slaType === ContractSlaType.ClassAA
        ? ShieldPlusIcon
        : slaType === ContractSlaType.ClassA
          ? ShieldHalfIcon
          : ShieldBanIcon

  return (
    <Badge variant="outline" className={className}>
      <HugeiconsIcon icon={icon} strokeWidth={2} size={18} />
      <span className="font-semibold text-foreground">{ContractService.slaTypeToString(slaType)}</span>
    </Badge>
  )
}
