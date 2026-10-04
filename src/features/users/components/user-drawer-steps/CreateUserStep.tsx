import { CreateUserForm } from '@/features/users/components/CreateUserForm'
import type { CreateUserPayload, User, UserOrganizationPermission, UserRole } from '@/types/user'

type CreateUserStepProps = {
  customerId?: string
  onCancel: () => void
  onSaved: (user: User, payload: CreateUserPayload) => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
  role?: UserRole
  onRoleChange?: (role: UserRole) => void
  position?: string
  onPositionChange?: (position: string) => void
  permissions?: UserOrganizationPermission[]
  onOpenPermissions: (formValues: {
    firstName: string
    lastName: string
    email: string
    password?: string
    phone: string
    position: string
  }) => void
  initialFormValues?: {
    firstName: string
    lastName: string
    email: string
    password?: string
    phone: string
    position: string
  }
}

export function CreateUserStep({
  customerId,
  onCancel,
  onSaved,
  onDirtyChange,
  role,
  onRoleChange,
  position,
  onPositionChange,
  permissions,
  onOpenPermissions,
  initialFormValues,
}: CreateUserStepProps) {
  return (
    <CreateUserForm
      customerId={customerId}
      submitText="Create user"
      role={role}
      onRoleChange={onRoleChange}
      position={position}
      onPositionChange={onPositionChange}
      permissions={permissions}
      onOpenPermissions={() => {}}
      onOpenPermissionsWithValues={onOpenPermissions}
      onSaved={onSaved}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
      initialFormValues={initialFormValues}
    />
  )
}
