import { InviteStaffForm } from '@/features/users/components/InviteStaffForm'
import type { InviteStaffResult } from '@/features/user-requests/api'

type InviteStaffStepProps = {
  onCancel: () => void
  onInvited: (result: InviteStaffResult) => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
}

export function InviteStaffStep({ onCancel, onInvited, onDirtyChange }: InviteStaffStepProps) {
  return <InviteStaffForm onCancel={onCancel} onInvited={onInvited} onDirtyChange={onDirtyChange} />
}
