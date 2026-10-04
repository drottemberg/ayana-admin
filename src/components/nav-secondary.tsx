'use client'

import * as React from 'react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { HugeiconsIcon } from '@hugeicons/react'
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon'
import { Link, useLocation } from 'react-router-dom'

type NavSecondaryItem = {
  title: string
  url?: string
  icon: React.ReactNode
  items?: {
    title: string
    url: string
    activeUrls?: string[]
  }[]
}

export function NavSecondary({
  items,
  ...props
}: {
  items: NavSecondaryItem[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const { setOpenMobile } = useSidebar()
  const { pathname } = useLocation()

  const isPathActive = (url: string) => {
    if (url === '/') {
      return pathname === '/'
    }

    return pathname === url || pathname.startsWith(`${url}/`)
  }

  const isItemActive = (item: { url?: string; activeUrls?: string[]; items?: { url: string; activeUrls?: string[] }[] }) => {
    const urls = [item.url, ...(item.activeUrls ?? [])].filter(Boolean) as string[]
    const childUrls = item.items?.flatMap((child) => [child.url, ...(child.activeUrls ?? [])]) ?? []

    return [...urls, ...childUrls].some(isPathActive)
  }

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = isItemActive(item)
            const isOwnUrlActive = item.url ? isPathActive(item.url) : false

            if (item.items?.length) {
              return (
                <Collapsible key={item.title} defaultOpen={isActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger
                      render={
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={isOwnUrlActive}
                          className="group/collapsible-trigger"
                        />
                      }
                    >
                      {item.icon}
                      <span className="text-sidebar-foreground/65 group-data-[collapsible=icon]:hidden">{item.title}</span>
                      <HugeiconsIcon
                        icon={ArrowDown01Icon}
                        strokeWidth={2}
                        className="ml-auto size-4 transition-transform duration-200 group-data-panel-open/collapsible-trigger:rotate-180 group-data-[collapsible=icon]:hidden"
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              render={<Link to={subItem.url} onClick={() => setOpenMobile(false)} />}
                              isActive={isItemActive(subItem)}
                              className="h-8 p-2 text-sm font-medium text-sidebar-foreground data-active:bg-[var(--color-accent)] data-active:font-semibold data-active:text-sidebar-accent-foreground [&>span:last-child]:text-sidebar-foreground/65"
                            >
                              <span>{subItem.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            }

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={item.url ? <Link to={item.url} onClick={() => setOpenMobile(false)} /> : undefined}
                  tooltip={item.title}
                  isActive={isActive}
                >
                  {item.icon}
                  <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
