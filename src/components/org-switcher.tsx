'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { DropdownActionsMenu, type DropdownActionItem } from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { appQueryKeys } from '@/features/app/query-keys'
import { useConnect } from '@/features/app/use-connect'
import { saveSelectedOrgId } from '@/features/organizations/storage'
import type { OrganizationEntity } from '@/lib/entities/organization.entity'
import { HugeiconsIcon } from '@hugeicons/react'
import Building01Icon from '@hugeicons/core-free-icons/Building01Icon'
import Store01Icon from '@hugeicons/core-free-icons/Store01Icon'
import UnfoldMoreIcon from '@hugeicons/core-free-icons/UnfoldMoreIcon'
import { getInitials } from '@/utils/string-utils'

function getOrgIcon(organization: OrganizationEntity | null) {
  return organization?.isStore ? Store01Icon : Building01Icon
}

function getOrgInitials(name: string): string {
  const initials = getInitials(name)

  return initials || 'O'
}

export function OrgSwitcher() {
  const { isMobile, state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const queryClient = useQueryClient()
  const { session, isLoading } = useConnect()
  const activeOrganization = session?.currentOrganization ?? null
  const organizations = session?.organizations ?? []

  const handleSelectOrganization = React.useCallback(
    async (organizationId: string) => {
      if (!organizationId || organizationId === session?.orgId) return

      saveSelectedOrgId(organizationId)
      await queryClient.invalidateQueries()
      await queryClient.invalidateQueries({ queryKey: appQueryKeys.connect })
    },
    [queryClient, session?.orgId],
  )

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <Skeleton className="size-8 rounded-lg" />
            <div className="grid flex-1 gap-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!activeOrganization || organizations.length === 0) {
    return null
  }

  const items: DropdownActionItem[] = organizations.map((organization, index) => {
    const isCurrent = organization.id === activeOrganization.id
    const label = `${organization.name || `Organization ${index + 1}`} - ${organization.typeLabel}`

    if (isCurrent) {
      return {
        type: 'checkbox',
        label,
        checked: true,
        disabled: true,
        icon: getOrgIcon(organization),
      }
    }

    return {
      label,
      icon: getOrgIcon(organization),
      onClick: () => void handleSelectOrganization(organization.id),
    }
  })

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownActionsMenu
          items={items}
          triggerRender={
            <SidebarMenuButton
              size="lg"
              className="px-0 data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
            />
          }
          contentClassName="min-w-56 rounded-lg"
          // itemClassName="gap-2 px-0 py-2"
          align="start"
          side={isMobile ? 'bottom' : 'right'}
          sideOffset={4}
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            {activeOrganization.name ? (
              getOrgInitials(activeOrganization.name)
            ) : (
              <HugeiconsIcon icon={getOrgIcon(activeOrganization)} strokeWidth={2} />
            )}
          </div>
          {isCollapsed ? null : (
            <>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeOrganization.name || 'Organization'}</span>
                <span className="truncate text-xs">{activeOrganization.subtitle}</span>
              </div>
              <HugeiconsIcon icon={UnfoldMoreIcon} strokeWidth={2} className="ml-auto" />
            </>
          )}
        </DropdownActionsMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
