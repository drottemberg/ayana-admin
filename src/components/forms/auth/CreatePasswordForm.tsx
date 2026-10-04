import { Button } from '@/components/ui/button'
import { AuthForm } from './AuthForm'
import { PasswordInput } from '@/components/ui/password-input'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/providers/use-auth'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { createPasswordValidator, MAX_PASSWORD_LENGTH, PASSWORD_RULES } from '@/lib/validators'

const createPasswordFormSchema = z
  .object({
    password: createPasswordValidator(),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

type CreatePasswordFormValues = z.infer<typeof createPasswordFormSchema>

export function CreatePasswordForm({ className, ...props }: React.ComponentProps<'div'>) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { completePasswordReset } = useAuth()
  const resetToken = searchParams.get('token') ?? undefined
  const email = searchParams.get('email') ?? undefined

  // No token in URL — link is invalid or expired
  if (!resetToken) {
    return (
      <AuthForm
        title="Link expired"
        description="This password reset link is invalid or has already been used. Please request a new one."
        className={className}
        {...props}
      >
        <Button size="lg" to="/forgot-password">
          Request new link
        </Button>
      </AuthForm>
    )
  }

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreatePasswordFormValues>({
    resolver: zodResolver(createPasswordFormSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })
  const passwordValue = watch('password')

  const passwordChecks = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        label: rule.shortLabel,
        passed: rule.regex.test(passwordValue),
      })),
    [passwordValue],
  )

  const onSubmit = async (values: CreatePasswordFormValues) => {
    try {
      await completePasswordReset(values.password, resetToken)
      navigate(email ? `/login?email=${encodeURIComponent(email)}` : '/login')
    } catch (error) {
      const msg = error instanceof Error ? error.message : ''
      const isExpired = msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired')
      setError('root', {
        message: isExpired
          ? 'This link has expired or already been used. Please request a new one.'
          : 'Unable to update password. Please try again.',
      })
    }
  }

  return (
    <AuthForm
      title="Create new password"
      description="Please enter your new password."
      className={className}
      {...props}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-5">
          <PasswordInput
            label="New password"
            placeholder="Enter your password"
            // error={errors.password?.message}
            maxLength={MAX_PASSWORD_LENGTH}
            {...register('password')}
          />
          <div className="-mt-3">
            <p className="text-body text-muted-foreground">Your password must contain:</p>
            <ul className="text-body pl-6">
              {passwordChecks.map((check, index) => (
                <li key={check.label} className={cn('list-disc', check.passed ? 'text-green-600' : 'text-destructive')}>
                  {check.label}
                  {index < passwordChecks.length - 1 ? ',' : '.'}
                </li>
              ))}
            </ul>
          </div>
          <PasswordInput
            label="Confirm password"
            placeholder="Enter your password"
            maxLength={MAX_PASSWORD_LENGTH}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <div className="flex flex-col gap-2">
            {errors.root?.message && <p className="text-body text-destructive">{errors.root.message}</p>}
            <Button type="submit" size="lg" disabled={isSubmitting}>
              Confirm
            </Button>
          </div>
        </div>
      </form>
    </AuthForm>
  )
}
