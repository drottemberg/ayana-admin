import { AuthLayout } from '@/components/layout/AuthLayout'
import { ForgotPasswordForm } from '@/components/forms/auth/ForgotPasswordForm'

export function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
