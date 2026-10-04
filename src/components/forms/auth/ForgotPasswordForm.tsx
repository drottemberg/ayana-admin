import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { useAuth } from '@/providers/use-auth'
import { AuthForm } from './AuthForm'

const schema = z.object({
  email: z.email('Please enter a valid email address.'),
})

type Values = z.infer<typeof schema>

export function ForgotPasswordForm({ className, ...props }: React.ComponentProps<'div'>) {
  const { requestPasswordReset } = useAuth()
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: Values) => {
    try {
      await requestPasswordReset(values.email)
      setSent(true)
    } catch {
      setError('root', { message: 'Something went wrong. Please try again.' })
    }
  }

  if (sent) {
    return (
      <AuthForm
        title="Check your email"
        description="If an account exists with this email address, you will receive a link to reset your password shortly."
        className={className}
        {...props}
      >
        <Button variant="link" size="lg" to="/login">
          Back to login
        </Button>
      </AuthForm>
    )
  }

  return (
    <AuthForm
      title="Reset password"
      description="Enter your email address and we'll send you instructions to reset your password."
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
          <div className="flex flex-col gap-2">
            {errors.root?.message && (
              <p className="text-body text-destructive">{errors.root.message}</p>
            )}
            <Button type="submit" size="lg" loading={isSubmitting}>
              Send instructions
            </Button>
            <Button variant="link" size="lg" to="/login">
              Back to login
            </Button>
          </div>
        </div>
      </form>
    </AuthForm>
  )
}
