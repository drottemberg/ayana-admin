import { Button } from '@/components/ui/button'
import { AuthForm } from './AuthForm'
import { TextInput } from '@/components/ui/text-input'
import { PasswordInput } from '@/components/ui/password-input'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/providers/use-auth'

const loginFormSchema = z.object({
  email: z.email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})

type LoginFormValues = z.infer<typeof loginFormSchema>

export function LoginForm({ className, ...props }: React.ComponentProps<'div'>) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const initialEmail = searchParams.get('email') ?? ''
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: initialEmail,
      password: '',
    },
  })
  const email = watch('email').trim()
  const forgotPasswordUrl = email ? `/forgot-password?email=${encodeURIComponent(email)}` : '/forgot-password'

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login(values.email, values.password)
      navigate('/app')
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Unable to login. Please try again.',
      })
    }
  }

  return (
    <AuthForm
      title="Welcome back"
      description="Please enter your email address and password to login."
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
          <PasswordInput
            label="Password"
            placeholder="Enter your password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Link to={forgotPasswordUrl} className="text-link ml-auto inline-block underline underline-offset-4">
            Forgot password?
          </Link>
          <div className="flex flex-col gap-2">
            {errors.root?.message && <p className="text-body text-destructive">{errors.root.message}</p>}
            <Button type="submit" size="lg" disabled={isSubmitting}>
              Login
            </Button>
          </div>
        </div>
      </form>
    </AuthForm>
  )
}
