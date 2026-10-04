import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/use-auth'
import { Spinner } from '@/components/ui/spinner'
import { getRequiredFeature } from '@/features/app/features'
import { useConnect } from '@/features/app/use-connect'
import { NotFoundPage } from '@/pages/NotFoundPage'

function AppRouteLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background text-foreground">
      <div className="text-md flex items-center gap-3 text-muted-foreground">
        <Spinner />
        <span>Loading app...</span>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children }: React.PropsWithChildren) {
  const { isAuthenticated, isLoading } = useAuth()
  const { session } = useConnect()
  const location = useLocation()

  if (isLoading) {
    return <AppRouteLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const requiredFeature = getRequiredFeature(location.pathname)

  if (requiredFeature && !session?.hasFeature(requiredFeature)) {
    return <NotFoundPage />
  }

  return children
}

export function PublicOnlyRoute({ children }: React.PropsWithChildren) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <AppRouteLoader />
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}
