'use client'

import * as React from 'react'

import logo from '@/assets/logo.svg'
import icon from '@/assets/icon.svg'
import { AppModeBadge } from '@/components/app/AppModeBadge'
import { NavMain } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
import { OrgSwitcher } from '@/components/org-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { EntityIcon } from '@/components/app/entity-icons'
import { canUseFeature } from '@/features/app/features'
import { useConnect } from '@/features/app/use-connect'
import { Feature } from '@/types/feature'
import { getAppMode } from '@/features/app/app-mode'

const Icon = ({ icon }: { icon: IconSvgElement }) => {
  return <HugeiconsIcon icon={icon} strokeWidth={2} />
}

const data = {
  home: [
    {
      title: 'Home',
      url: '/',
      icon: <Icon icon={EntityIcon.home} />,
    },
  ],
  manage: [
    {
      title: 'Locations',
      url: '/locations',
      icon: <Icon icon={EntityIcon.locations} />,
      feature: Feature.LOCATIONS,
    },
    {
      title: 'Pricing options',
      url: '/pricing-options',
      icon: <Icon icon={EntityIcon.pricingOptions} />,
      feature: Feature.CUSTOMERS,
    },
    {
      title: 'Classes',
      url: '/classes',
      icon: <Icon icon={EntityIcon.classes} />,
      feature: Feature.CUSTOMERS,
    },
    {
      title: 'Class sessions',
      url: '/class-sessions',
      icon: <Icon icon={EntityIcon.classes} />,
      feature: Feature.CUSTOMERS,
    },
    {
      title: 'Client contracts',
      url: '/client-contracts',
      icon: <Icon icon={EntityIcon.clientContracts} />,
      feature: Feature.CUSTOMERS,
    },
    {
      title: 'Orders',
      url: '/orders',
      icon: <Icon icon={EntityIcon.orders} />,
      feature: Feature.ORDERS,
    },
    {
      title: 'Messages',
      url: '/messages',
      icon: <Icon icon={EntityIcon.users} />,
      feature: Feature.CUSTOMERS,
    },
    {
      title: 'Products',
      url: '/products',
      icon: <Icon icon={EntityIcon.products} />,
      feature: Feature.PRODUCTS,
    },
    {
      title: 'AI support issues',
      url: '/agent-support-issues',
      icon: <Icon icon={EntityIcon.issues} />,
      feature: Feature.ISSUES,
    },
    {
      title: 'Command logs',
      url: '/command-logs',
      icon: <Icon icon={EntityIcon.commandLogs} />,
      feature: Feature.LOGS,
    },
  ],
  tools: [],
  settings: [
    {
      title: 'Devices',
      url: '/devices',
      icon: <Icon icon={EntityIcon.devices} />,
      feature: Feature.DEVICES,
    },
    {
      title: 'Customers',
      url: '/customers',
      icon: <Icon icon={EntityIcon.customers} />,
      feature: Feature.CUSTOMERS,
    },
    {
      title: 'Users',
      url: '/users',
      icon: <Icon icon={EntityIcon.users} />,
      feature: Feature.USERS,
    },
    {
      title: 'Device Types',
      url: '/device-type-groups',
      activeUrls: ['/device-types'],
      icon: <Icon icon={EntityIcon.deviceTypes} />,
      feature: Feature.DEVICE_TYPE,
    },
  ],
}

function SidebarBrand() {
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  return (
    <div className="mx-2 my-3 group-data-[collapsible=icon]:mx-1 group-data-[collapsible=icon]:my-2">
      <Link to="/">
        {isCollapsed ? (
          <img src={icon} alt="Gaudier" className="h-8 w-8" />
        ) : (
          <span className="flex items-start gap-1.5">
            <img src={logo} alt="Gaudier" className="h-8 w-auto" />
            <AppModeBadge />
          </span>
        )}
      </Link>
    </div>
  )
}

function SidebarCollapseTrigger({ className }: { className?: string }) {
  const { open, isMobile } = useSidebar()

  return (
    <Tooltip>
      <TooltipTrigger render={<SidebarTrigger className={cn(className)} />} />
      <TooltipContent side="right" align="center" hidden={isMobile}>
        {open ? 'Close side panel' : 'Open side panel'}
      </TooltipContent>
    </Tooltip>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state, setOpenMobile } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const { pathname } = useLocation()
  const { session } = useConnect()
  const isAdminContext = getAppMode() === 'admin'
  const hasFeature = React.useCallback((feature: Feature) => Boolean(session?.hasFeature(feature)), [session])
  const manageItems = React.useMemo(() => data.manage.filter((item) => canUseFeature(item, hasFeature)), [hasFeature])
  const toolItems = React.useMemo(() => data.tools.filter((item) => canUseFeature(item, hasFeature)), [hasFeature])
  const settingsItems = React.useMemo(
    () => data.settings
      .filter((item) => item.title !== 'Devices' || isAdminContext)
      .filter((item) => canUseFeature(item, hasFeature)),
    [hasFeature, isAdminContext],
  )
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {isCollapsed ? (
          <div className="relative flex h-10 items-center justify-center">
            <div className="transition-opacity duration-150 group-hover:pointer-events-none group-hover:opacity-0">
              <img src={icon} alt="Gaudier" className="h-8 w-8" />
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
              <SidebarCollapseTrigger />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <SidebarBrand />
            <SidebarCollapseTrigger className="opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
          </div>
        )}
        <OrgSwitcher />
        {hasFeature(Feature.ORDERS) ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link to="/orders/kitchen" onClick={() => setOpenMobile(false)} />}
                isActive={pathname === '/orders/kitchen'}
                tooltip="Order Dashboard"
                className="!bg-black !text-white hover:!bg-neutral-800 hover:!text-white data-[active=true]:!bg-black data-[active=true]:!text-white"
              >
                <Icon icon={EntityIcon.orders} />
                <span className="group-data-[collapsible=icon]:hidden !text-white">Order Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.home} />
        {manageItems.length ? <NavMain label="Manage" items={manageItems} /> : null}
        {toolItems.length ? (
          <>
            <SidebarSeparator />
            <NavMain items={toolItems} />
          </>
        ) : null}
        {settingsItems.length ? (
          <>
            <SidebarSeparator />
            <NavMain label="Settings" items={settingsItems} />
          </>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
