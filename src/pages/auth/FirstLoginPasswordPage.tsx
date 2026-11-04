import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { AuthForm } from '@/components/forms/auth/AuthForm'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/form-error'
import { apiClient } from '@/lib/api-client'
import { createPasswordValidator, MAX_PASSWORD_LENGTH, PASSWORD_RULES } from '@/lib/validators'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/use-auth'

const schema = z.object({
  newPassword: createPasswordValidator(),
  confirmPassword: z.string().min(1, 'Please confirm your password.'),
}).refine((values) => values.newPassword === values.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})

type FormValues = z.infer<typeof schema>

export function FirstLoginPasswordPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const passwordValue = watch('newPassword', '')

  const onSubmit = async (values: FormValues) => {
    try {
      await apiClient.patch('/auth/password', { newPassword: values.newPassword })
      toast.success('Password updated. You can now continue.')
      window.location.replace('/')
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setError('root', { message: message || 'Could not update your password. Please try again.' })
    }
  }

  const signOut = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return <AuthLayout>
    <AuthForm
      title="Create your password"
      description="You signed in with a temporary password. Create a password for your account to continue."
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-5">
          <PasswordInput
            label="New password"
            placeholder="Create a password"
            autoComplete="new-password"
            maxLength={MAX_PASSWORD_LENGTH}
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <ul className="text-body pl-6">
            {PASSWORD_RULES.map((rule) => (
              <li key={rule.shortLabel} className={cn('list-disc', rule.regex.test(passwordValue) ? 'text-green-600' : 'text-muted-foreground')}>
                {rule.shortLabel}
              </li>
            ))}
          </ul>
          <PasswordInput
            label="Confirm new password"
            placeholder="Confirm your new password"
            autoComplete="new-password"
            maxLength={MAX_PASSWORD_LENGTH}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <div className="flex flex-col gap-3">
            <FormError message={errors.root?.message} />
            <Button type="submit" size="lg" disabled={isSubmitting} loading={isSubmitting}>
              Set password and continue
            </Button>
            <Button type="button" variant="ghost" size="lg" disabled={isSubmitting} onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </form>
    </AuthForm>
  </AuthLayout>
}
