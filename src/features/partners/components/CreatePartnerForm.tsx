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
import { PermissionsField } from '@/features/users/components/PermissionsField'
import { UserService } from '@/features/users/user-service'
import { UserRole, UserRoleValues } from '@/types/user'
import type { UserOrganizationPermission, UserRole as UserRoleType } from '@/types/user'
import type { OrganizationPermissionNode } from '@/features/users/components/user-drawer-steps/organization-permissions'
import { createPartnerRequest, updatePartnerRequest } from '@/features/partners/api'
import { partnersQueryKeys } from '@/features/partners/query-keys'
import type { CreatePartnerPayload, MaintenancePartner } from '@/types/partner'

const partnerFormSchema = z.object({
  name: z.string().trim().min(1, 'Partner name is required.'),
  role: z.enum(UserRoleValues),
  permissions: z
    .array(z.object({ organizationId: z.string(), role: z.enum(UserRoleValues).nullable() }))
    .min(1, 'Select at least one organization.'),
})

type PartnerFormValues = z.infer<typeof partnerFormSchema>

type CreatePartnerFormProps = {
  partner?: MaintenancePartner
  role?: UserRoleType
  permissions?: UserOrganizationPermission[]
  tree?: OrganizationPermissionNode | null
  initialFormValues?: { name: string }
  onCancel: () => void
  onSaved: () => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
  onOpenPermissions: (formValues: { name: string }) => void
  onRoleChange?: (role: UserRoleType) => void
}

export function CreatePartnerForm({
  partner,
  role,
  permissions,
  tree,
  initialFormValues,
  onCancel,
  onSaved,
  onDirtyChange,
  onOpenPermissions,
  onRoleChange,
}: CreatePartnerFormProps) {
  const isEditMode = !!partner?.id
  const queryClient = useQueryClient()
  const formPermissions = permissions ?? partner?.permissions ?? []

  const createMutation = useMutation({
    mutationFn: createPartnerRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: partnersQueryKeys.all })
      await onSaved()
    },
  })
  const updateMutation = useMutation({
    mutationFn: (payload: CreatePartnerPayload) => {
      if (!partner) throw new Error('Partner is required.')
      return updatePartnerRequest(partner.id, payload)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: partnersQueryKeys.all }),
        partner ? queryClient.invalidateQueries({ queryKey: partnersQueryKeys.detail(partner.id) }) : Promise.resolve(),
      ])
      await onSaved()
    },
  })
  const activeMutation = isEditMode ? updateMutation : createMutation

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: initialFormValues?.name ?? partner?.name ?? '',
      role: role ?? UserRole.MEMBER,
      permissions: formPermissions,
    },
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (role) setValue('role', role, { shouldDirty: true, shouldValidate: true })
  }, [role, setValue])

  useEffect(() => {
    if (permissions) setValue('permissions', permissions, { shouldDirty: true, shouldValidate: true })
  }, [permissions, setValue])

  const submitForm = handleSubmit(async (values) => {
    const payload: CreatePartnerPayload = {
      name: values.name.trim(),
      role: (role ?? values.role) as UserRoleType,
      permissions: permissions ?? values.permissions,
    }

    if (isEditMode) {
      await updateMutation.mutateAsync(payload)
    } else {
      await createMutation.mutateAsync(payload)
    }
  })

  const errorMessage = activeMutation.error instanceof Error ? activeMutation.error.message : undefined

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submitForm}>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-2">
        <FieldGroup className="gap-4">
          <TextInput
            label="Partner name"
            placeholder="Partner name"
            required
            error={errors.name?.message}
            {...register('name')}
          />

          <Controller
            control={control}
            name="role"
            render={({ field, fieldState }) => (
              <SelectInput
                key={role ?? field.value}
                label="Default role"
                placeholder="Select role"
                required
                searchable
                items={UserService.roleKeys().map((r) => ({ value: r, label: UserService.roleToString(r) }))}
                error={fieldState.error?.message}
                value={role ?? field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  onRoleChange?.(value as UserRoleType)
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />

          <PermissionsField
            permissions={formPermissions}
            tree={tree ?? null}
            error={errors.permissions?.message}
            onOpen={() => onOpenPermissions({ name: getValues('name') })}
          />
        </FieldGroup>
      </div>

      <div className="mt-auto flex flex-col gap-3 px-7 py-6">
        <div className="mt-auto flex justify-center gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="lg" loading={isSubmitting}>
            {isEditMode ? 'Save' : 'Create'}
          </Button>
        </div>
        <FormError message={errorMessage} />
      </div>
    </form>
  )
}
