import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { FormError } from '@/components/form-error'
import { PasswordInput } from '@/components/ui/password-input'
import { TextInput } from '@/components/ui/text-input'
import { UserService } from '@/features/users/user-service'
import { UserRole, UserRoleValues } from '@/types/user'
import type { CreateUserPayload, User, UserOrganizationPermission, UserRole as UserRoleType } from '@/types/user'
import { SelectInput } from '@/components/ui/select-input'
import { createUserRequest, updateUserRequest } from '@/features/users/api'
import { usersQueryKeys } from '@/features/users/query-keys'
import { PhoneInput } from '@/components/ui/phone-input'
import { normalizePhone, validatePhone } from '@/lib/phone'
import { PermissionsField } from '@/features/users/components/PermissionsField'
import { useLazyOrganizationTreeQuery } from '@/features/organizations/use-organization-tree'
import { getPermissionsWithParentFilled } from '@/features/users/components/user-drawer-steps/organization-permissions'
import { createPasswordValidator, MAX_PASSWORD_LENGTH } from '@/lib/validators'

const userFormSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  email: z.string().trim().email('Enter a valid email.'),
  phone: z
    .string()
    .optional()
    .refine((value) => (value ? !validatePhone(value) : true), {
      message: 'Enter a valid phone number.',
    }),
  password: createPasswordValidator({ optional: true }),
  position: z.string().optional(),
  role: z.enum(UserRoleValues),
  permissions: z
    .array(
      z.object({
        organizationId: z.string(),
        role: z.enum(UserRoleValues).nullable(),
      }),
    )
    .min(1, 'Select permissions.'),
})

type UserFormValues = z.infer<typeof userFormSchema>

type CreateUserFormProps = {
  user?: User
  customerId?: string
  onCancel: () => void
  onSaved: (user: User, payload: CreateUserPayload) => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
  submitText?: string
  role?: UserRoleType
  onRoleChange?: (role: UserRoleType) => void
  position?: string
  onPositionChange?: (position: string) => void
  permissions?: UserOrganizationPermission[]
  onOpenPermissions?: () => void
  initialFormValues?: {
    firstName: string
    lastName: string
    email: string
    password?: string
    phone: string
    position: string
  }
  onOpenPermissionsWithValues?: (values: {
    firstName: string
    lastName: string
    email: string
    password?: string
    phone: string
    position: string
  }) => void
}

export function CreateUserForm({
  user,
  customerId,
  onCancel,
  onSaved,
  onDirtyChange,
  submitText,
  role,
  onRoleChange,
  position,
  onPositionChange,
  permissions,
  onOpenPermissions,
  initialFormValues,
  onOpenPermissionsWithValues,
}: CreateUserFormProps) {
  const isEditMode = !!user?.id
  const queryClient = useQueryClient()
  const formPermissions = permissions ?? user?.permissions ?? []
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
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: initialFormValues?.firstName ?? user?.firstName ?? '',
      lastName: initialFormValues?.lastName ?? user?.lastName ?? '',
      email: initialFormValues?.email ?? user?.email ?? '',
      password: initialFormValues?.password ?? '',
      phone: initialFormValues?.phone ?? user?.phone ?? '',
      position: initialFormValues?.position ?? user?.position ?? '',
      role: role ?? user?.role ?? UserRole.MEMBER,
      permissions: formPermissions,
    },
  })

  const createUserMutation = useMutation({
    mutationFn: createUserRequest,
    onSuccess: async (createdUser, payload) => {
      const scopedCustomerId = customerId ?? user?.customerId

      queryClient.setQueryData<User[]>(usersQueryKeys.all, (users = []) => [
        { ...createdUser, customerId: scopedCustomerId ?? undefined },
        ...users,
      ])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
        scopedCustomerId
          ? queryClient.invalidateQueries({ queryKey: usersQueryKeys.organization(scopedCustomerId) })
          : Promise.resolve(),
      ])
      await onSaved(createdUser, payload)
    },
  })
  const updateUserMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => {
      if (!user) throw new Error('User is required.')

      return updateUserRequest(String(user.id), payload)
    },
    onSuccess: async (updatedUser, payload) => {
      const scopedCustomerId = customerId ?? user?.customerId

      queryClient.setQueryData<User[]>(usersQueryKeys.all, (users = []) =>
        users.map((cachedUser) =>
          String(cachedUser.id) === String(updatedUser.id)
            ? { ...cachedUser, ...updatedUser, customerId: scopedCustomerId ?? cachedUser.customerId }
            : cachedUser,
        ),
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
        scopedCustomerId
          ? queryClient.invalidateQueries({ queryKey: usersQueryKeys.organization(scopedCustomerId) })
          : Promise.resolve(),
        user ? queryClient.invalidateQueries({ queryKey: usersQueryKeys.detail(String(user.id)) }) : Promise.resolve(),
      ])
      await onSaved(updatedUser, payload)
    },
  })
  const activeMutation = isEditMode ? updateUserMutation : createUserMutation

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
    const userPermissions = permissions ?? values.permissions
    const filledPermissions =
      isEditMode && treeQuery.data ? getPermissionsWithParentFilled(userPermissions, treeQuery.data) : userPermissions

    const payload: CreateUserPayload = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      phone: values.phone ? normalizePhone(values.phone) : null,
      position: values.position?.trim() || null,
      role: (role ?? values.role) as UserRoleType,
      permissions: filledPermissions,
    }

    if (isEditMode) {
      await updateUserMutation.mutateAsync(payload)
      return
    }

    payload.password = values.password!.trim()
    await createUserMutation.mutateAsync(payload)
  })

  const errorMessage = activeMutation.error instanceof Error ? activeMutation.error.message : undefined
  const permissionsError = errors.permissions?.message

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submitForm}>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-2">
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="First name"
              placeholder="First name"
              required
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <TextInput
              label="Last name"
              placeholder="Last name"
              required
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>
          <TextInput
            label="Email"
            type="email"
            placeholder="email@company.com"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          {!isEditMode ? (
            <PasswordInput
              label="Password"
              placeholder="Enter password"
              maxLength={MAX_PASSWORD_LENGTH}
              error={errors.password?.message}
              {...register('password')}
            />
          ) : null}
          <Controller
            control={control}
            name="phone"
            render={({ field, fieldState }) => (
              <PhoneInput
                label="Phone number"
                error={fieldState.error?.message}
                placeholder="6 12 34 56 78"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
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
                placeholder="Select role"
                required
                searchable
                items={UserService.roleKeys().map((role) => {
                  return {
                    value: role,
                    label: UserService.roleToString(role),
                  }
                })}
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
            tree={treeQuery.data ?? null}
            error={permissionsError}
            onOpen={() => {
              const values = getValues()
              onOpenPermissionsWithValues?.({
                firstName: values.firstName,
                lastName: values.lastName,
                email: values.email,
                password: values.password,
                phone: values.phone ?? '',
                position: values.position ?? '',
              })
              onOpenPermissions?.()
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
            {submitText ?? (isEditMode ? 'Save' : 'Send invite')}
          </Button>
        </div>
        <FormError message={errorMessage} />
      </div>
    </form>
  )
}
