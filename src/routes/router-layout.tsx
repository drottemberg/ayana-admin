import { Outlet } from 'react-router-dom'

import { ConnectivityBanner } from '@/components/app/connectivity-banner'
import { Toaster } from '@/components/ui/sonner'
import ModalProvider from '@/providers/modal-provider'

export function RouterLayout() {
  return (
    <ModalProvider>
      <ConnectivityBanner />
      <Outlet />
      <Toaster richColors />
    </ModalProvider>
  )
}
