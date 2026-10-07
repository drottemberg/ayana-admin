import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/app/AppSidebar'
import { SidebarInset, SidebarProvider } from '../ui/sidebar'
import { useAppSettings } from '@/providers/use-app-settings'
import { AssistantChatWidget } from '@/features/assistant-chat/AssistantChatWidget'
import { useLocation } from 'react-router-dom'

export function RootLayout() {
  const { settings, setSidebarOpen } = useAppSettings()
  const location = useLocation()

  if (location.pathname === '/orders/kitchen') {
    return (
      <main className="min-h-svh w-full bg-background">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
    )
  }

  return (
    <div className="flex">
      <SidebarProvider open={settings.sidebarOpen} onOpenChange={setSidebarOpen}>
        <AppSidebar />
        <SidebarInset>
          <main>
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </main>
        </SidebarInset>
        <AssistantChatWidget />
      </SidebarProvider>
    </div>
  )
}
