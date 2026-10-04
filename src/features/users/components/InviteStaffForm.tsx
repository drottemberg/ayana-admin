import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { FormError } from '@/components/form-error'
import { TextInput } from '@/components/ui/text-input'
import { SelectInput } from '@/components/ui/select-input'
import { inviteStaffRequest, type InviteStaffResult } from '@/features/user-requests/api'
import { userRequestsQueryKeys } from '@/features/user-requests/query-keys'
import { UserService } from '@/features/users/user-service'
import { StaffRole, StaffRoleValues } from '@/types/membership'

const inviteStaffFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  staffRole: z.enum(StaffRoleValues),
})

type InviteStaffFormValues = z.infer<typeof inviteStaffFormSchema>

type InviteStaffFormProps = {
  onCancel: () => void
  onInvited: (result: InviteStaffResult) => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
}

export function InviteStaffForm({ onCancel, onInvited, onDirtyChange }: InviteStaffFormProps) {
  const queryClient = useQueryClient()
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<InviteStaffFormValues>({
    resolver: zodResolver(inviteStaffFormSchema),
    mode: 'onChange',
    defaultValues: { email: '', firstName: '', lastName: '', staffRole: StaffRole.SUPPORT },
  })

  const inviteMutation = useMutation({
    mutationFn: inviteStaffRequest,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: userRequestsQueryKeys.all })
      await onInvited(result)
    },
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const submitForm = handleSubmit(async (values) => {
    await inviteMutation.mutateAsync({
      email: values.email.trim(),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      staffRole: values.staffRole,
    })
  })

  const errorMessage = inviteMutation.error instanceof Error ? inviteMutation.error.message : undefined

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submitForm}>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-2">
        <FieldGroup className="gap-4">
          <TextInput
            label="Email"
            type="email"
            placeholder="email@company.com"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          <TextInput label="First name" required error={errors.firstName?.message} {...register('firstName')} />
          <TextInput label="Last name" required error={errors.lastName?.message} {...register('lastName')} />
          <Controller
            control={control}
            name="staffRole"
            render={({ field, fieldState }) => (
              <SelectInput
                label="Role"
                required
                items={UserService.staffRoleKeys().map((role) => ({
                  value: role,
                  label: UserService.staffRoleToString(role),
                }))}
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
      </div>

      <div className="mt-auto flex flex-col gap-3 px-7 py-6">
        <div className="mt-auto flex justify-center gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="lg" loading={isSubmitting}>
            Invite
          </Button>
        </div>
        <FormError message={errorMessage} />
      </div>
    </form>
  )
}
