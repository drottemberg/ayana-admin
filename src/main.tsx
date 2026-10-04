// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/providers/auth-provider'
import { AppSettingsProvider } from '@/providers/app-settings-provider'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/query-client'

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
