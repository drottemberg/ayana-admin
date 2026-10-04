import { useEffect } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/providers/use-auth'

export function SsoCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { completeSsoLogin } = useAuth()
  const token = searchParams.get('token')
  const refreshToken = searchParams.get('refreshToken')

  useEffect(() => {
    if (!token || !refreshToken) return

    let cancelled = false

    async function completeLogin() {
      try {
        await completeSsoLogin(token!, refreshToken!)
        if (!cancelled) {
          navigate('/', { replace: true })
        }
      } catch {
        if (!cancelled) {
          navigate('/login?ssoError=1', { replace: true })
        }
      }
    }

    void completeLogin()

    return () => {
      cancelled = true
    }
  }, [completeSsoLogin, navigate, refreshToken, token])

  if (!token || !refreshToken) {
    return <Navigate to="/login?ssoError=1" replace />
  }

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Spinner />
    </div>
  )
}
