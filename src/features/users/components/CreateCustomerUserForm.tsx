import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { FormError } from '@/components/form-error'
import { TextInput } from '@/components/ui/text-input'
import { PhoneInput } from '@/components/ui/phone-input'
import { normalizePhone, validatePhone } from '@/lib/phone'
import { createCustomerUserRequest } from '@/features/users/api'
import { usersQueryKeys } from '@/features/users/query-keys'
import type { User } from '@/types/user'

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  email: z.string().trim().email('Enter a valid email.').or(z.literal('')),
  phone: z.string().optional().refine((value) => !value || !validatePhone(value), 'Enter a valid phone number.'),
}).refine((value) => Boolean(value.email?.trim() || value.phone?.trim()), {
  message: 'Enter an email address or phone number.',
  path: ['email'],
})

type Values = z.infer<typeof schema>

export function CreateCustomerUserForm({
  customerId,
  onSaved,
  onCancel,
  onDirtyChange,
}: {
  customerId?: string
  onSaved: (user: User) => Promise<void> | void
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { control, register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { firstName: '', lastName: '', email: '', phone: '' },
  })
  const mutation = useMutation({
    mutationFn: createCustomerUserRequest,
    onSuccess: async (user) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
        customerId ? queryClient.invalidateQueries({ queryKey: usersQueryKeys.organization(customerId) }) : Promise.resolve(),
      ])
      await onSaved(user)
    },
  })

  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange])

  const submit = handleSubmit(async (values) => {
    await mutation.mutateAsync({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      ...(values.email?.trim() ? { email: values.email.trim() } : {}),
      ...(values.phone?.trim() ? { phone: normalizePhone(values.phone) } : {}),
    })
  })

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submit}>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-2">
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="First name" placeholder="First name" required error={errors.firstName?.message} {...register('firstName')} />
            <TextInput label="Last name" placeholder="Last name" required error={errors.lastName?.message} {...register('lastName')} />
          </div>
          <TextInput label="Email" type="email" placeholder="email@example.com" error={errors.email?.message} {...register('email')} />
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
          <p className="text-sm text-muted-foreground">At least one contact method is required: email or phone.</p>
        </FieldGroup>
      </div>
      <div className="mt-auto flex flex-col gap-3 px-7 py-6">
        <div className="flex justify-center gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" size="lg" loading={isSubmitting}>Add user</Button>
        </div>
        <FormError message={mutation.error instanceof Error ? mutation.error.message : undefined} />
      </div>
    </form>
  )
}
