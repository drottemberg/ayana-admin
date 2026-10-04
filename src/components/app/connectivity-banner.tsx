import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import Alert02Icon from '@hugeicons/core-free-icons/Alert02Icon'
import WifiConnected01Icon from '@hugeicons/core-free-icons/WifiConnected01Icon'
import { API_STATUS_EVENT_NAME, type ApiError } from '@/lib/api'

type ApiStatusEvent = CustomEvent<{ error: ApiError | null }>

const offlineStatus = {
  title: 'Offline mode',
  description: 'Network connection is unavailable. Some data can be outdated.',
  variant: 'warning',
} as const

const apiUnavailableStatus = {
  title: 'API unavailable',
  description: 'The app cannot reach the server right now. Some features may not work properly.',
  variant: 'error',
} as const

export function ConnectivityBanner() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [isApiAvailable, setIsApiAvailable] = useState(true)
  const didMountRef = useRef(false)

  const status = useMemo(() => {
    if (!isOnline) {
      return offlineStatus
    }

    if (!isApiAvailable) {
      return apiUnavailableStatus
    }

    return null
  }, [isApiAvailable, isOnline])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    const handleApiStatus = (event: Event) => {
      setIsApiAvailable((event as ApiStatusEvent).detail.error === null)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener(API_STATUS_EVENT_NAME, handleApiStatus)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener(API_STATUS_EVENT_NAME, handleApiStatus)
    }
  }, [])

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }

    if (!isOnline) {
      toast.warning('You are offline.')
      return
    }

    if (!isApiAvailable) {
      toast.error('API is not responding.')
      return
    }

    toast.success('Connection restored.')
  }, [isApiAvailable, isOnline])

  if (!status) {
    return null
  }

  return (
    <div
      className={[
        'sticky top-0 z-500 flex min-h-10 items-center gap-3 border-b bg-white px-4 py-2 text-sm shadow-sm',
        status.variant === 'error'
          ? 'border-error-200 bg-error-50 text-error-900'
          : 'border-warning-200 bg-warning-50 text-warning-950',
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      <HugeiconsIcon
        icon={status.variant === 'error' ? Alert02Icon : WifiConnected01Icon}
        strokeWidth={2}
        className="size-4 shrink-0"
      />
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">{status.title}</span>
        <span className="text-current/80">{status.description}</span>
      </div>
    </div>
  )
}
