import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { BaseCard } from '@/components/app/BaseCard'
import { FormError } from '@/components/form-error'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { PasswordInput } from '@/components/ui/password-input'
import { PhoneInput } from '@/components/ui/phone-input'
import { TextInput } from '@/components/ui/text-input'
import { appQueryKeys } from '@/features/app/query-keys'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { normalizePhone, validatePhone } from '@/lib/phone'
import { createPasswordValidator, PASSWORD_RULES } from '@/lib/validators'
import { useAuth } from '@/providers/use-auth'

const accountFormSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  email: z.string().trim().email('Enter a valid email.'),
  phone: z
    .string()
    .optional()
    .refine((value) => (value ? !validatePhone(value) : true), {
      message: 'Enter a valid phone number.',
    }),
})

type AccountFormValues = z.infer<typeof accountFormSchema>

export default function AccountPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
    },
  })
  const updateAccountMutation = useMutation({
    mutationFn: (payload: { firstName: string; lastName: string; email: string; phone?: string | null }) =>
      apiClient.patch('/auth/me', payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: appQueryKeys.connect })
      toast.success('Profile updated successfully.')
    },
  })

  useEffect(() => {
    reset({
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
    })
  }, [reset, user])

  const submitForm = handleSubmit(async (values) => {
    if (!user) return
    try {
      await updateAccountMutation.mutateAsync({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone ? normalizePhone(values.phone) : null,
      })
    } catch {
      // error displayed via updateAccountMutation.error
    }
  })

  const errorMessage = updateAccountMutation.error instanceof Error ? updateAccountMutation.error.message : undefined

  return (
    <>
      <PageHeader title="Account" subtitle={user?.email} />
      <section className="space-y-6 p-4 md:p-6">
        <BaseCard className="md:max-w-2xl">
          <form className="grid gap-6" noValidate onSubmit={submitForm}>
            <FieldGroup className="gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  label="First name"
                  placeholder="First name"
                  required
                  disabled={!user || isSubmitting}
                  error={errors.firstName?.message}
                  {...register('firstName')}
                />
                <TextInput
                  label="Last name"
                  placeholder="Last name"
                  required
                  disabled={!user || isSubmitting}
                  error={errors.lastName?.message}
                  {...register('lastName')}
                />
              </div>
              <TextInput
                label="Email"
                type="email"
                placeholder="email@company.com"
                required
                disabled={!user || isSubmitting}
                error={errors.email?.message}
                {...register('email')}
              />
              <PhoneInput
                label="Phone number"
                placeholder="988-710-9998"
                disabled={!user || isSubmitting}
                error={errors.phone?.message}
                {...register('phone')}
              />
            </FieldGroup>

            <div className="flex flex-col gap-3">
              <FormError message={errorMessage} />
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={!isDirty || isSubmitting}
                  onClick={() => reset()}
                >
                  Cancel
                </Button>
                <Button type="submit" size="lg" disabled={!user || !isDirty} loading={isSubmitting}>
                  Save
                </Button>
              </div>
            </div>
          </form>
        </BaseCard>

        <PasswordSection hasPassword={user?.hasPassword ?? false} />
      </section>
    </>
  )
}

// ─── Password section ──────────────────────────────────────────────────────────

const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: createPasswordValidator(),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

type ChangePasswordValues = z.infer<typeof changePasswordSchema>

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema) })

  const passwordValue = watch('newPassword', '')

  const onSubmit = async (values: ChangePasswordValues) => {
    try {
      await apiClient.patch('/auth/password', {
        currentPassword: values.currentPassword || undefined,
        newPassword: values.newPassword,
      })
      reset()
      toast.success(hasPassword ? 'Password updated.' : 'Password added.')
    } catch (error) {
      const msg = error instanceof Error ? error.message : ''
      if (msg.toLowerCase().includes('incorrect')) {
        setError('currentPassword', { message: 'Current password is incorrect.' })
      } else {
        setError('root', { message: msg || 'Failed to update password.' })
      }
    }
  }

  return (
    <BaseCard className="md:max-w-2xl">
      <p className="font-semibold">
        {hasPassword ? 'Change password' : 'Add a password'}
      </p>
      {(
        <form
          className="grid gap-4"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <FieldGroup className="gap-4">
            {hasPassword && (
              <PasswordInput
                label="Current password"
                placeholder="Enter your current password"
                required
                error={errors.currentPassword?.message}
                {...register('currentPassword')}
              />
            )}
            <PasswordInput
              label="New password"
              placeholder="Enter your new password"
              required
              error={errors.newPassword?.message}
              {...register('newPassword')}
            />
            <div>
              <ul className="mb-2 text-sm">
                {PASSWORD_RULES.map((rule) => (
                  <li
                    key={rule.shortLabel}
                    className={rule.regex.test(passwordValue) ? 'text-green-600' : 'text-muted-foreground'}
                  >
                    {rule.regex.test(passwordValue) ? '✓' : '·'} {rule.shortLabel}
                  </li>
                ))}
              </ul>
            </div>
            <PasswordInput
              label="Confirm new password"
              placeholder="Confirm your new password"
              required
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </FieldGroup>

          <div className="flex flex-col gap-3">
            <FormError message={errors.root?.message} />
            <div className="flex justify-end">
              <Button type="submit" size="lg" disabled={!isDirty} loading={isSubmitting}>
                {hasPassword ? 'Update password' : 'Add password'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </BaseCard>
  )
}
