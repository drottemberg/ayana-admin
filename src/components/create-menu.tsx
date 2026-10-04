'use client'

import * as React from 'react'

import { DropdownActionsMenu, type DropdownActionItem } from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { useConnect } from '@/features/app/use-connect'
import { Drawer, DrawerId } from '@/providers/drawer'
import { Feature, type Feature as FeatureType } from '@/types/feature'
import { HugeiconsIcon } from '@hugeicons/react'
import PlusSignIcon from '@hugeicons/core-free-icons/PlusSignIcon'
import FolderAddIcon from '@hugeicons/core-free-icons/FolderAddIcon'
import UserAdd01Icon from '@hugeicons/core-free-icons/UserAdd01Icon'
import Store01Icon from '@hugeicons/core-free-icons/Store01Icon'
import { Button } from './ui/button'

type CreateMenuItem = DropdownActionItem & {
  feature: FeatureType
}

export function CreateMenu() {
  const { state } = useSidebar()
  const { session } = useConnect()
  const isCollapsed = state === 'collapsed'
  const hasFeature = React.useCallback((feature: FeatureType) => Boolean(session?.hasFeature(feature)), [session])

  const items: DropdownActionItem[] = React.useMemo(() => {
    const createItems: CreateMenuItem[] = [
      {
        label: 'New device',
        icon: FolderAddIcon,
        feature: Feature.DEVICES,
        onClick: () => Drawer.show(DrawerId.CreateDevice, {}),
      },
      {
        label: 'New store',
        icon: Store01Icon,
        feature: Feature.STORES,
        onClick: () => Drawer.show(DrawerId.CreateStore, {}),
      },
      {
        label: 'New user',
        icon: UserAdd01Icon,
        feature: Feature.USERS,
        onClick: () => Drawer.show(DrawerId.CreateUser, {}),
      },
    ]

    return createItems.filter((item) => hasFeature(item.feature))
  }, [hasFeature])

  if (!items.length) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownActionsMenu items={items} align="end" triggerRender={<Button size="lg" />} showChevron={!isCollapsed}>
          {isCollapsed ? <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} /> : <span>Create</span>}
        </DropdownActionsMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
