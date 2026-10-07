import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { TextInput } from '@/components/ui/text-input'
import { useAuth } from '@/providers/use-auth'
import { cn } from '@/lib/utils'
import { createPasswordValidator, MAX_PASSWORD_LENGTH, PASSWORD_RULES } from '@/lib/validators'
import { AuthForm } from './AuthForm'

const signupSchema = z
  .object({
    email: z.email('Please enter a valid email address.'),
    name: z.string().trim().min(1, 'Name is required.').max(120, 'Name must be 120 characters or fewer.'),
    password: createPasswordValidator(),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

type SignupValues = z.infer<typeof signupSchema>

export function SignupForm({ className, ...props }: React.ComponentProps<'div'>) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { signup } = useAuth()
  const requestId = searchParams.get('requestId') ?? undefined
  const inviteEmail = searchParams.get('email') ?? ''
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: inviteEmail, name: '', password: '', confirmPassword: '' },
  })
  const passwordValue = watch('password')
  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ label: rule.shortLabel, passed: rule.regex.test(passwordValue) })),
    [passwordValue],
  )

  const onSubmit = async ({ email, name, password }: SignupValues) => {
    try {
      await signup(requestId, email, name, password)
      navigate('/app')
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Unable to create your account. Please try again.',
      })
    }
  }

  return (
    <AuthForm
      title="Create your customer account"
      description="Use the email address that received your invitation."
      className={className}
      {...props}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-5">
          <TextInput
            label="Email"
            type="email"
            placeholder="Enter your email address"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <TextInput
            label="Name"
            placeholder="Enter your name"
            autoComplete="name"
            error={errors.name?.message}
            {...register('name')}
          />
          <PasswordInput
            label="Password"
            placeholder="Create a password"
            maxLength={MAX_PASSWORD_LENGTH}
            error={errors.password?.message}
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
            placeholder="Re-enter your password"
            maxLength={MAX_PASSWORD_LENGTH}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <div className="flex flex-col gap-2">
            {errors.root?.message && <p className="text-body text-destructive">{errors.root.message}</p>}
            <Button type="submit" size="lg" disabled={isSubmitting}>
              Create account
            </Button>
            <Link to={`/login?email=${encodeURIComponent(inviteEmail)}`} className="text-link text-center underline underline-offset-4">
              Back to login
            </Link>
          </div>
        </div>
      </form>
    </AuthForm>
  )
}
