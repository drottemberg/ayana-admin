import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Link, useLocation } from 'react-router-dom'

export function NavMain({
  label,
  items,
}: {
  label?: string
  items: {
    title: string
    url: string
    activeUrls?: string[]
    icon?: React.ReactNode
    isActive?: boolean
  }[]
}) {
  const { setOpenMobile } = useSidebar()
  const { pathname } = useLocation()

  const isPathActive = (url: string) => {
    if (url === '/') {
      return pathname === '/'
    }

    return pathname === url || pathname.startsWith(`${url}/`)
  }

  const isItemActive = (item: { url: string; activeUrls?: string[] }) => {
    return [item.url, ...(item.activeUrls ?? [])].some(isPathActive)
  }

  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                render={<Link to={item.url} onClick={() => setOpenMobile(false)} />}
                tooltip={item.title}
                isActive={isItemActive(item)}
              >
                {item.icon}
                <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
