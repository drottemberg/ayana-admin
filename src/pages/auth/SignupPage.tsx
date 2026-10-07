import { AuthLayout } from '@/components/layout/AuthLayout'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { getAppMode } from '@/features/app/app-mode'
import { SignupForm } from '@/components/forms/auth/SignupForm'

export function SignupPage() {
  if (getAppMode() !== 'customer') return <NotFoundPage />

  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  )
}
