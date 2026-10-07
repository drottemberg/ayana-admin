import { toast } from 'sonner'

import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { setClassTypeStatusRequest } from '@/features/classes/api'
import { classTypesQueryKeys } from '@/features/classes/query-keys'
import { queryClient } from '@/lib/query-client'
import type { ClassType } from '@/types/class-type'

export const ClassTypeService = {
  async setStatus(classType: ClassType, isActive: boolean) {
    try {
      await setClassTypeStatusRequest(classType, isActive)
      await queryClient.invalidateQueries({ queryKey: classTypesQueryKeys.all })
      toast.success(isActive ? 'Class enabled.' : 'Class disabled.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update class status.')
    }
  },

  getRowActions(
    classType: ClassType,
    options: { canEdit: boolean; onEdit: (classType: ClassType) => void },
  ): DropdownActionItem[] {
    if (!options.canEdit) return []

    return [
      { label: 'Edit', onClick: () => options.onEdit(classType) },
      {
        label: classType.isActive ? 'Disable' : 'Enable',
        onClick: () => void this.setStatus(classType, !classType.isActive),
      },
    ]
  },
}
