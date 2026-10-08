// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/providers/auth-provider'
import { AppSettingsProvider } from '@/providers/app-settings-provider'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/query-client'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()

  const reloadKey = 'ayana-admin-chunk-reload-at'
  const lastReload = Number(sessionStorage.getItem(reloadKey))
  if (lastReload && Date.now() - lastReload < 30_000) return

  sessionStorage.setItem(reloadKey, String(Date.now()))
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
  <QueryClientProvider client={queryClient}>
    <AppSettingsProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppSettingsProvider>
    <ReactQueryDevtools initialIsOpen={false} client={queryClient} buttonPosition='bottom-left' />
  </QueryClientProvider>,
  // </StrictMode>,
)
