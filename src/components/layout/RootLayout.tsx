import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/app/AppSidebar'
import { SidebarInset, SidebarProvider } from '../ui/sidebar'
import { useAppSettings } from '@/providers/use-app-settings'

export function RootLayout() {
  const { settings, setSidebarOpen } = useAppSettings()

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
      </SidebarProvider>
    </div>
  )
}
