import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSidebar } from '@/components/ui/sidebar'

export function useSidebarNavigation() {
  const { setOpenMobile } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()

  return useCallback(
    (url: string, event: React.MouseEvent<HTMLAnchorElement>) => {
      setOpenMobile(false)

      const target = new URL(url, window.location.origin)
      const currentUrl = `${location.pathname}${location.search}${location.hash}`
      const targetUrl = `${target.pathname}${target.search}${target.hash}`

      if (targetUrl !== currentUrl) return

      event.preventDefault()
      navigate(currentUrl, {
        replace: true,
        state: {
          ...(typeof location.state === 'object' && location.state !== null ? location.state : {}),
          sidebarRefreshKey: `${Date.now()}-${Math.random()}`,
        },
      })
    },
    [location.hash, location.pathname, location.search, location.state, navigate, setOpenMobile],
  )
}
