import { AuthLayout } from '@/components/layout/AuthLayout'
import { LoginForm } from '@/components/forms/auth/LoginForm'
export function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  )
}
