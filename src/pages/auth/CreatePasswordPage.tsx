import { AuthLayout } from '@/components/layout/AuthLayout'
import { CreatePasswordForm } from '@/components/forms/auth/CreatePasswordForm'

export function CreatePasswordPage() {
  return (
    <AuthLayout>
      <CreatePasswordForm />
    </AuthLayout>
  )
}
