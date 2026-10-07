import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { FormError } from '@/components/form-error'
import { PasswordInput } from '@/components/ui/password-input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Spinner } from '@/components/ui/spinner'
import { TextInput } from '@/components/ui/text-input'
import { getUserRequest, updateUserDetailsRequest } from '@/features/users/api'
import { usersQueryKeys } from '@/features/users/query-keys'
import { apiClient } from '@/lib/api-client'
import { normalizePhone, validatePhone } from '@/lib/phone'
import { createPasswordValidator, PASSWORD_RULES } from '@/lib/validators'
import { useAuth } from '@/providers/use-auth'
import type { User } from '@/types/user'

const detailsFormSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  phone: z
    .string()
    .optional()
    .refine((value) => (value ? !validatePhone(value) : true), {
      message: 'Enter a valid phone number.',
    }),
})

type DetailsFormValues = z.infer<typeof detailsFormSchema>

type EditUserDetailsFormProps = {
  user: User
  onCancel: () => void
  onSaved: (user: User) => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
}

// The `user` prop is whatever the caller had in hand (a list row, a stale cache entry) — load
// the real record fresh before rendering the form, same as EditPermissionsStep, so defaults
// reflect what's actually on the user right now.
export function EditUserDetailsForm({ user, onCancel, onSaved, onDirtyChange }: EditUserDetailsFormProps) {
  const userQuery = useQuery({
    queryKey: usersQueryKeys.detail(String(user.id)),
    queryFn: () => getUserRequest(String(user.id)),
  })

  if (userQuery.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center gap-3 px-7 py-2 text-sm text-muted-foreground">
        <Spinner /> Loading user...
      </div>
    )
  }

  if (userQuery.error instanceof Error) {
    return (
      <div className="mx-7 my-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {userQuery.error.message}
      </div>
    )
  }

  return (
    <EditUserDetailsFormBody
      user={userQuery.data ?? user}
      onCancel={onCancel}
      onSaved={onSaved}
      onDirtyChange={onDirtyChange}
    />
  )
}

function EditUserDetailsFormBody({ user, onCancel, onSaved, onDirtyChange }: EditUserDetailsFormProps) {
  const { user: currentUser } = useAuth()
  const isSelf = currentUser ? String(currentUser.id) === String(user.id) : false
  const queryClient = useQueryClient()
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsFormSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? '',
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { firstName: string; lastName: string; phone?: string | null }) =>
      updateUserDetailsRequest(String(user.id), payload),
    onSuccess: async (updatedUser) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.detail(String(user.id)) }),
      ])
      await onSaved(updatedUser)
    },
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const submitForm = handleSubmit(async (values) => {
    await updateMutation.mutateAsync({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone ? normalizePhone(values.phone) : null,
    })
  })

  const errorMessage = updateMutation.error instanceof Error ? updateMutation.error.message : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <form className="flex flex-col gap-4 px-7 py-2" noValidate onSubmit={submitForm}>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="First name" required error={errors.firstName?.message} {...register('firstName')} />
            <TextInput label="Last name" required error={errors.lastName?.message} {...register('lastName')} />
          </div>
          {/* Email can't be changed here — UpdateUserDto (backend) doesn't accept it. */}
          <TextInput label="Email" type="email" value={user.email} disabled />
          <Controller
            control={control}
            name="phone"
            render={({ field, fieldState }) => (
              <PhoneInput
                label="Phone number"
                placeholder="6 12 34 56 78"
                error={fieldState.error?.message}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
        </FieldGroup>

        <div className="mt-2 flex flex-col gap-3">
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="lg" loading={isSubmitting} disabled={!isDirty}>
              Save
            </Button>
          </div>
          <FormError message={errorMessage} />
        </div>
      </form>

      {/* PATCH /auth/password only ever targets the caller's own account — there is no
          admin-reset-another-user's-password endpoint, so this only shows when editing yourself. */}
      {isSelf ? (
        <div className="mt-2 border-t border-border px-7 py-6">
          <PasswordChangeFields hasPassword={user.hasPassword ?? false} />
        </div>
      ) : null}
    </div>
  )
}

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

// Mirrors pages/app/AccountPage.tsx's PasswordSection (same fields, same endpoint, same UX) —
// duplicated rather than shared because this drawer's compact layout has no BaseCard wrapper.
function PasswordChangeFields({ hasPassword }: { hasPassword: boolean }) {
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
    <form className="grid gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      <p className="font-semibold">{hasPassword ? 'Change password' : 'Add a password'}</p>
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
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={!isDirty} loading={isSubmitting}>
            {hasPassword ? 'Update password' : 'Add password'}
          </Button>
        </div>
        <FormError message={errors.root?.message} />
      </div>
    </form>
  )
}
