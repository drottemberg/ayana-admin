import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { HugeiconsIcon } from '@hugeicons/react'
import UnfoldMoreIcon from '@hugeicons/core-free-icons/UnfoldMoreIcon'
import CheckmarkBadgeIcon from '@hugeicons/core-free-icons/CheckmarkBadge01Icon'
import LogoutIcon from '@hugeicons/core-free-icons/Logout01Icon'
import { useAuth } from '@/providers/use-auth'
import type { User } from '@/types/user'
import { StringUtils } from '@/utils'
import { useNavigate } from 'react-router-dom'

const NavAvatar = ({ user }: { user: User }) => {
  const userName = `${user?.firstName} ${user?.lastName}`
  const initials = StringUtils.getInitials(userName)

  return (
    <Avatar>
      <AvatarImage src={user.avatarUrl} alt={userName} />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}

export function NavUser() {
  const { user, logout } = useAuth()
  const { isMobile } = useSidebar()
  const navigate = useNavigate()

  if (!user) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}>
            <NavAvatar user={user} />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user?.firstName}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <HugeiconsIcon
              icon={UnfoldMoreIcon}
              strokeWidth={2}
              className="ml-auto size-4 group-data-[collapsible=icon]:hidden"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <NavAvatar user={user} />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user?.firstName}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate('/account')}>
                <HugeiconsIcon icon={CheckmarkBadgeIcon} strokeWidth={2} />
                Account
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <HugeiconsIcon icon={LogoutIcon} strokeWidth={2} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
