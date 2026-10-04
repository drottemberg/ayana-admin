import EyeIcon from '@hugeicons/core-free-icons/EyeIcon'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { NO_VALUE_STR } from '@/constants'
import { Drawer, DrawerId } from '@/providers/drawer'
import { StoreScope } from '@/types/membership'
import type { User } from '@/types/user'

function scopeLabel(scope?: StoreScope | null): string {
  if (!scope || scope === StoreScope.NONE) return NO_VALUE_STR
  return scope === StoreScope.SPECIFIC ? 'PARTIAL' : scope
}

export function UserScopeCell({
  user,
  kind,
  organizationId,
  scope,
  canEdit,
}: {
  user: User
  kind: 'customer' | 'partner'
  organizationId?: string
  scope?: StoreScope
  canEdit?: boolean
}) {
  const label = scopeLabel(scope)
  if (!organizationId || label === NO_VALUE_STR) return label

  return (
    <div className="flex items-center gap-1.5">
      <span>{label}</span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="View permission tree"
              onClick={(event) => {
                event.stopPropagation()
                Drawer.show(DrawerId.CreateUser, {
                  user,
                  mode: 'view-permissions',
                  permissionScope: { kind, organizationId, readOnly: true, canEdit },
                })
              }}
            >
              <HugeiconsIcon icon={EyeIcon} strokeWidth={2} className="size-3.5" />
            </Button>
          }
        />
        <TooltipContent>View permission tree</TooltipContent>
      </Tooltip>
    </div>
  )
}
