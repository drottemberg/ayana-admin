'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DropdownActionsMenu, type DropdownActionItem } from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { appQueryKeys } from '@/features/app/query-keys'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import { getAllLocationsForCustomerRequest } from '@/features/locations/api'
import { locationsQueryKeys } from '@/features/locations/query-keys'
import {
  ALL_LOCATIONS_SCOPE,
  clearSelectedLocationScope,
  readSelectedLocationScope,
  saveSelectedLocationScope,
  saveSelectedOrgId,
} from '@/features/organizations/storage'
import type { OrganizationEntity } from '@/lib/entities/organization.entity'
import type { Location } from '@/types/location'
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
  const { isMobile, state, setOpenMobile } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const queryClient = useQueryClient()
  const { session, isLoading } = useConnect()
  const activeOrganization = session?.currentOrganization ?? null
  const organizations = session?.organizations ?? []
  const customerId = getAppMode() === 'customer' && activeOrganization?.isCustomer ? activeOrganization.id : ''
  const membership = session?.user.customerMemberships.find((item) => item.customerId === customerId)
  const locationScope = membership?.locationScope ?? membership?.storeScope ?? 'ALL'
  const canSelectAllLocations = locationScope === 'ALL'
  const locationsQuery = useQuery({
    queryKey: locationsQueryKeys.customer(customerId),
    queryFn: () => getAllLocationsForCustomerRequest(customerId),
    enabled: Boolean(customerId && membership),
  })
  // The API also scopes this list, but keep the switcher constrained by the
  // membership itself so a stale or overly broad response cannot expose other locations.
  const allowedLocationIds = React.useMemo(
    () => new Set((membership?.locations ?? []).map(({ locationId }) => locationId)),
    [membership?.locations],
  )
  const locations = React.useMemo(() => {
    const fetchedLocations = locationsQuery.data ?? []
    if (locationScope === 'ALL') return fetchedLocations
    if (locationScope !== 'SPECIFIC') return []
    return fetchedLocations.filter((location) => allowedLocationIds.has(location.id))
  }, [allowedLocationIds, locationScope, locationsQuery.data])
  const scopeOptions = React.useMemo(() => [
    ...(canSelectAllLocations ? [{ value: ALL_LOCATIONS_SCOPE, label: 'All locations' }] : []),
    ...locations.map((location) => ({ value: location.id, label: location.name || location.id })),
  ], [canSelectAllLocations, locations])
  const [selectionOverride, setSelectionOverride] = React.useState<{ customerId: string; value: string } | null>(null)
  const savedScope = customerId ? readSelectedLocationScope(customerId) : null
  const savedScopeIsValid = savedScope === ALL_LOCATIONS_SCOPE
    ? canSelectAllLocations
    : Boolean(savedScope && locations.some((location) => location.id === savedScope))
  const defaultScope = canSelectAllLocations ? ALL_LOCATIONS_SCOPE : locations[0]?.id ?? ''
  const selectedScope = selectionOverride?.customerId === customerId
    ? selectionOverride.value
    : savedScopeIsValid
      ? savedScope!
      : defaultScope

  React.useEffect(() => {
    if (!customerId || !membership || !locationsQuery.isSuccess) return

    const validSavedScope = savedScope === ALL_LOCATIONS_SCOPE
      ? canSelectAllLocations
      : Boolean(savedScope && locations.some((location) => location.id === savedScope))
    const nextScope = validSavedScope ? savedScope! : defaultScope
    if (nextScope) {
      if (savedScope !== nextScope) {
        saveSelectedLocationScope(customerId, nextScope)
        setSelectionOverride({ customerId, value: nextScope })
        // A restored location can change the x-org-id used by every subsequent request.
        if (nextScope !== ALL_LOCATIONS_SCOPE || (savedScope && savedScope !== ALL_LOCATIONS_SCOPE)) {
          void queryClient.invalidateQueries()
        }
      }
    } else if (savedScope) {
      clearSelectedLocationScope(customerId)
      setSelectionOverride(null)
      void queryClient.invalidateQueries()
    }
  }, [
    canSelectAllLocations,
    customerId,
    defaultScope,
    locations,
    locationsQuery.isSuccess,
    membership,
    queryClient,
    savedScope,
  ])

  const handleSelectOrganization = React.useCallback(
    async (organizationId: string) => {
      if (!organizationId || organizationId === session?.orgId) return

      saveSelectedOrgId(organizationId)
      await queryClient.invalidateQueries()
      await queryClient.invalidateQueries({ queryKey: appQueryKeys.connect })
    },
    [queryClient, session?.orgId],
  )

  const handleSelectLocationScope = React.useCallback((value: string | null) => {
    if (!customerId || !value || value === selectedScope) return
    saveSelectedLocationScope(customerId, value)
    setSelectionOverride({ customerId, value })
    void queryClient.invalidateQueries()
    if (isMobile) setOpenMobile(false)
  }, [customerId, isMobile, queryClient, selectedScope, setOpenMobile])

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
    <>
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

      {customerId && membership ? (
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="w-full space-y-1 px-1 group-data-[collapsible=icon]:px-0">
              <span className="px-1 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">Location scope</span>
              {locationsQuery.isLoading ? (
                <Skeleton className="h-8" />
              ) : (
                <Select
                  items={scopeOptions}
                  itemToStringLabel={(value) => scopeOptions.find((option) => option.value === value)?.label ?? String(value)}
                  value={selectedScope || undefined}
                  onValueChange={handleSelectLocationScope}
                >
                  <SelectTrigger
                    size="sm"
                    disabled={!canSelectAllLocations && locations.length <= 1}
                    className="h-8 w-full min-w-0 border-sidebar-border bg-sidebar-accent/50 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                    aria-label="Location scope"
                  >
                    <HugeiconsIcon icon={Store01Icon} strokeWidth={2} className="size-4 shrink-0" />
                    <SelectValue className="truncate group-data-[collapsible=icon]:hidden" placeholder="Location scope" />
                  </SelectTrigger>
                  <SelectContent align="start" side={isMobile ? 'bottom' : 'right'}>
                    {canSelectAllLocations ? <SelectItem value={ALL_LOCATIONS_SCOPE}>All locations</SelectItem> : null}
                    {locations.map((location: Location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name || location.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      ) : null}
    </>
  )
}
