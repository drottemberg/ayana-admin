'use client'

import * as React from 'react'

import logo from '@/assets/logo.svg'
import icon from '@/assets/icon.svg'
import { AppModeBadge } from '@/components/app/AppModeBadge'
import { CreateMenu } from '@/components/create-menu'
import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import { OrgSwitcher } from '@/components/org-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { EntityIcon } from '@/components/app/entity-icons'
import { canUseFeature } from '@/features/app/features'
import { useConnect } from '@/features/app/use-connect'
import { Feature } from '@/types/feature'

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
      title: 'Devices',
      url: '/devices',
      icon: <Icon icon={EntityIcon.devices} />,
      feature: Feature.DEVICES,
    },
    {
      title: 'Contracts',
      url: '/contracts',
      icon: <Icon icon={EntityIcon.contracts} />,
      feature: Feature.CONTRACTS,
    },
    {
      title: 'Stores',
      url: '/stores',
      icon: <Icon icon={EntityIcon.stores} />,
      feature: Feature.STORES,
    },
    {
      title: 'Media',
      url: '/media',
      icon: <Icon icon={EntityIcon.media} />,
      feature: Feature.MEDIA,
    },
    {
      title: 'Campaigns',
      url: '/media-campaigns',
      icon: <Icon icon={EntityIcon.mediaCampaigns} />,
      feature: Feature.MEDIA,
    },
    {
      title: 'Products',
      url: '/products',
      icon: <Icon icon={EntityIcon.products} />,
      feature: Feature.PRODUCTS,
    },
    {
      title: 'Issues',
      url: '/issues',
      icon: <Icon icon={EntityIcon.issues} />,
      feature: Feature.ISSUES,
    },
    {
      title: 'Command logs',
      url: '/command-logs',
      icon: <Icon icon={EntityIcon.commandLogs} />,
      feature: Feature.LOGS,
    },
    {
      title: 'Data',
      url: '/data',
      icon: <Icon icon={EntityIcon.data} />,
      feature: Feature.DATA,
    },
  ],
  tools: [
    {
      title: 'AI Planogram',
      url: '/ai-planogram',
      icon: <Icon icon={EntityIcon.planograms} />,
      feature: Feature.PLANOGRAMS,
    },
  ],
  settings: [
    {
      title: 'Customers',
      url: '/customers',
      icon: <Icon icon={EntityIcon.customers} />,
      feature: Feature.CUSTOMERS,
    },
    {
      title: 'Maintenance Partners',
      url: '/partners',
      icon: <Icon icon={EntityIcon.partners} />,
      feature: Feature.MAINTENANCE,
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
  groups: [
    {
      title: 'Groups',
      icon: <Icon icon={EntityIcon.groups} />,
      items: [
        {
          title: 'Device Groups',
          url: '/device-groups',
          feature: Feature.DEVICES,
        },
        {
          title: 'Store Groups',
          url: '/store-groups',
          feature: Feature.STORES,
        },
      ],
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
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const { session } = useConnect()
  const hasFeature = React.useCallback((feature: Feature) => Boolean(session?.hasFeature(feature)), [session])
  const manageItems = React.useMemo(() => data.manage.filter((item) => canUseFeature(item, hasFeature)), [hasFeature])
  const toolItems = React.useMemo(() => data.tools.filter((item) => canUseFeature(item, hasFeature)), [hasFeature])
  const settingsItems = React.useMemo(
    () => data.settings.filter((item) => canUseFeature(item, hasFeature)),
    [hasFeature],
  )
  const groupItems = React.useMemo(
    () =>
      data.groups
        .map((item) => ({
          ...item,
          items: item.items.filter((child) => canUseFeature(child, hasFeature)),
        }))
        .filter((item) => item.items.length),
    [hasFeature],
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
        <CreateMenu />
        <OrgSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.home} />
        {manageItems.length ? <NavMain label="Manage" items={manageItems} /> : null}
        {groupItems.length ? <NavSecondary items={groupItems} /> : null}
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
