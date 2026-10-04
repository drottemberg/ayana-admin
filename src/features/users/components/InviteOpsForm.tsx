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
import { inviteOpsRequest } from '@/features/user-requests/api'
import { userRequestsQueryKeys } from '@/features/user-requests/query-keys'
import { UserService } from '@/features/users/user-service'
import { useLazyPartnerTreeQuery } from '@/features/organizations/use-partner-tree'
import { treeSelectionToOpsMemberships } from '@/features/users/components/user-drawer-steps/organization-permissions'
import { TechnicianRole, TechnicianRoleValues } from '@/types/membership'
import type { UserRequest } from '@/types/user-request'

const inviteOpsFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  role: z.enum(TechnicianRoleValues),
})

type InviteOpsFormValues = z.infer<typeof inviteOpsFormSchema>

type InviteOpsFormProps = {
  role?: TechnicianRole
  onRoleChange?: (role: TechnicianRole) => void
  selectedIds: string[]
  onCancel: () => void
  onInvited: (requests: UserRequest[]) => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
  onOpenPermissions: (formValues: { email: string }) => void
  initialFormValues?: { email: string }
}

export function InviteOpsForm({
  role,
  onRoleChange,
  selectedIds,
  onCancel,
  onInvited,
  onDirtyChange,
  onOpenPermissions,
  initialFormValues,
}: InviteOpsFormProps) {
  const queryClient = useQueryClient()
  const treeQuery = useLazyPartnerTreeQuery({ enabled: selectedIds.length > 0 })
  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<InviteOpsFormValues>({
    resolver: zodResolver(inviteOpsFormSchema),
    mode: 'onChange',
    defaultValues: {
      email: initialFormValues?.email ?? '',
      role: role ?? TechnicianRole.TECHNICIAN,
    },
  })

  const inviteMutation = useMutation({
    mutationFn: inviteOpsRequest,
    onSuccess: async (requests) => {
      await queryClient.invalidateQueries({ queryKey: userRequestsQueryKeys.all })
      await onInvited(requests)
    },
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (role) {
      setValue('role', role, { shouldDirty: true, shouldValidate: true })
    }
  }, [role, setValue])

  const submitForm = handleSubmit(async (values) => {
    const memberships = treeSelectionToOpsMemberships(selectedIds, treeQuery.data ?? null, values.role)
    await inviteMutation.mutateAsync({ email: values.email.trim(), memberships })
  })

  const errorMessage = inviteMutation.error instanceof Error ? inviteMutation.error.message : undefined
  const permissionsSummary = selectedIds.length ? `${selectedIds.length} selected` : ''

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
          <Controller
            control={control}
            name="role"
            render={({ field, fieldState }) => (
              <SelectInput
                key={role ?? field.value}
                label="Default role"
                required
                items={UserService.technicianRoleKeys().map((r) => ({
                  value: r,
                  label: UserService.technicianRoleToString(r),
                }))}
                error={fieldState.error?.message}
                value={role ?? field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  onRoleChange?.(value as TechnicianRole)
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <TextInput
            label="Permissions"
            readOnly
            required
            value={permissionsSummary}
            onClick={() => onOpenPermissions({ email: getValues('email') })}
            className="cursor-pointer"
            placeholder="Select permissions"
            endIcon="grid"
          />
        </FieldGroup>
      </div>

      <div className="mt-auto flex flex-col gap-3 px-7 py-6">
        <div className="mt-auto flex justify-center gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="lg" loading={isSubmitting} disabled={!selectedIds.length}>
            Invite
          </Button>
        </div>
        <FormError message={errorMessage} />
      </div>
    </form>
  )
}
