import { InviteOpsForm } from '@/features/users/components/InviteOpsForm'
import type { UserRequest } from '@/types/user-request'
import type { TechnicianRole } from '@/types/membership'

type InviteOpsStepProps = {
  onCancel: () => void
  onInvited: (requests: UserRequest[]) => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
  role?: TechnicianRole
  onRoleChange?: (role: TechnicianRole) => void
  selectedIds: string[]
  onOpenPermissions: (formValues: { email: string }) => void
  initialFormValues?: { email: string }
}

export function InviteOpsStep({
  onCancel,
  onInvited,
  onDirtyChange,
  role,
  onRoleChange,
  selectedIds,
  onOpenPermissions,
  initialFormValues,
}: InviteOpsStepProps) {
  return (
    <InviteOpsForm
      role={role}
      onRoleChange={onRoleChange}
      selectedIds={selectedIds}
      onOpenPermissions={onOpenPermissions}
      onInvited={onInvited}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
      initialFormValues={initialFormValues}
    />
  )
}
