import { InviteUserForm } from '@/features/users/components/InviteUserForm'
import type { UserOrganizationPermission } from '@/types/user'
import type { UserRequest } from '@/types/user-request'
import type { CustomerRole } from '@/types/membership'

type InviteUserStepProps = {
  customerId?: string
  onCancel: () => void
  onInvited: (requests: UserRequest[]) => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
  role?: CustomerRole
  onRoleChange?: (role: CustomerRole) => void
  position?: string
  onPositionChange?: (position: string) => void
  permissions?: UserOrganizationPermission[]
  onOpenPermissions: (formValues: { email: string; position: string }) => void
  initialFormValues?: {
    email: string
    position?: string
  }
}

export function InviteUserStep({
  customerId,
  onCancel,
  onInvited,
  onDirtyChange,
  role,
  onRoleChange,
  position,
  onPositionChange,
  permissions,
  onOpenPermissions,
  initialFormValues,
}: InviteUserStepProps) {
  return (
    <InviteUserForm
      customerId={customerId}
      role={role}
      onRoleChange={onRoleChange}
      position={position}
      onPositionChange={onPositionChange}
      permissions={permissions}
      onOpenPermissions={() => {}}
      onOpenPermissionsWithValues={onOpenPermissions}
      onInvited={onInvited}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
      initialFormValues={initialFormValues}
    />
  )
}
