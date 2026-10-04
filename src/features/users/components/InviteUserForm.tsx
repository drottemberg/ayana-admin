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
import { Modals } from '@/providers/modal'
import { inviteCustomerRequest } from '@/features/user-requests/api'
import { userRequestsQueryKeys } from '@/features/user-requests/query-keys'
import { usersQueryKeys } from '@/features/users/query-keys'
import { UserService } from '@/features/users/user-service'
import type { UserOrganizationPermission } from '@/types/user'
import { CustomerRole, CustomerRoleValues } from '@/types/membership'
import type { UserRequest } from '@/types/user-request'
import { PermissionsField } from '@/features/users/components/PermissionsField'
import { useLazyOrganizationTreeQuery } from '@/features/organizations/use-organization-tree'
import { treeSelectionToCustomerMemberships } from '@/features/users/components/user-drawer-steps/organization-permissions'

const inviteUserFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  position: z.string().optional(),
  role: z.enum(CustomerRoleValues),
  permissions: z
    .array(
      z.object({
        organizationId: z.string(),
        role: z.string().nullable(),
      }),
    )
    .min(1, 'Select permissions.'),
})

type InviteUserFormValues = z.infer<typeof inviteUserFormSchema>

type InviteUserFormProps = {
  customerId?: string
  role?: CustomerRole
  onRoleChange?: (role: CustomerRole) => void
  position?: string
  onPositionChange?: (position: string) => void
  permissions?: UserOrganizationPermission[]
  onCancel: () => void
  onInvited: (requests: UserRequest[]) => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
  onOpenPermissions: () => void
  initialFormValues?: {
    email: string
    position?: string
  }
  onOpenPermissionsWithValues?: (values: { email: string; position: string }) => void
}

export function InviteUserForm({
  customerId,
  role,
  onRoleChange,
  position,
  onPositionChange,
  permissions,
  onCancel,
  onInvited,
  onDirtyChange,
  onOpenPermissions,
  initialFormValues,
  onOpenPermissionsWithValues,
}: InviteUserFormProps) {
  const queryClient = useQueryClient()
  const formPermissions = permissions ?? []
  const treeQuery = useLazyOrganizationTreeQuery({
    enabled: formPermissions.length > 0,
  })
  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserFormSchema),
    mode: 'onChange',
    defaultValues: {
      email: initialFormValues?.email ?? '',
      position: initialFormValues?.position ?? '',
      role: role ?? CustomerRole.MEMBER,
      permissions: formPermissions,
    },
  })
  const inviteMutation = useMutation({
    mutationFn: inviteCustomerRequest,
    onSuccess: async (requests) => {
      await queryClient.invalidateQueries({ queryKey: userRequestsQueryKeys.all })
      await queryClient.invalidateQueries({ queryKey: usersQueryKeys.all })
      if (customerId) {
        await queryClient.invalidateQueries({ queryKey: usersQueryKeys.organization(customerId) })
      }
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

  useEffect(() => {
    if (position !== undefined) {
      setValue('position', position, { shouldDirty: true })
    }
  }, [position, setValue])

  const submitForm = handleSubmit(async (values) => {
    const email = values.email.trim()
    const defaultRole = (role ?? values.role) as CustomerRole
    const memberships = treeSelectionToCustomerMemberships(
      permissions ?? values.permissions,
      treeQuery.data ?? null,
      defaultRole,
    ).map((membership) => ({ ...membership, position: values.position?.trim() || undefined }))

    const confirmed = await Modals.confirm({
      title: 'Send invite?',
      content: `Do you want to send an invitation to ${email}?`,
      okText: 'Yes',
      cancelText: 'No',
    })

    if (!confirmed) return

    await inviteMutation.mutateAsync({ email, memberships })
  })

  const errorMessage = inviteMutation.error instanceof Error ? inviteMutation.error.message : undefined
  const permissionsError = errors.permissions?.message

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
          <TextInput
            label="Position"
            placeholder="e.g. Store Manager"
            error={errors.position?.message}
            {...register('position', {
              onChange: (e) => onPositionChange?.(e.target.value),
            })}
          />
          <Controller
            control={control}
            name="role"
            render={({ field, fieldState }) => (
              <SelectInput
                key={role ?? field.value}
                label="Default role"
                required
                searchable
                items={UserService.customerRoleKeys().map((role) => ({
                  value: role,
                  label: UserService.customerRoleToString(role),
                }))}
                error={fieldState.error?.message}
                value={role ?? field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  onRoleChange?.(value as CustomerRole)
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <PermissionsField
            permissions={formPermissions}
            tree={treeQuery.data ?? null}
            error={permissionsError}
            onOpen={() => {
              const values = getValues()
              onOpenPermissionsWithValues?.({ email: values.email, position: values.position ?? '' })
              onOpenPermissions()
            }}
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
