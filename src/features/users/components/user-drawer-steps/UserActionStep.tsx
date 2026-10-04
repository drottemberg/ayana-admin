import { HugeiconsIcon } from '@hugeicons/react'
import MailSend02Icon from '@hugeicons/core-free-icons/MailSend02Icon'

import type { UserFlowAction } from '@/features/users/components/user-drawer-steps/types'

type UserActionStepProps = {
  onSelect: (action: UserFlowAction) => void
}

export function UserActionStep({ onSelect }: UserActionStepProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-7 py-2">
      <div className="grid gap-3">
        <ActionButton
          icon={<HugeiconsIcon icon={MailSend02Icon} strokeWidth={2} />}
          title="Invite Staff"
          description="Send an invitation to a Gaudier staff member."
          onClick={() => onSelect('invite-staff')}
        />
        <ActionButton
          icon={<HugeiconsIcon icon={MailSend02Icon} strokeWidth={2} />}
          title="Invite Customer User"
          description="Send an invitation to a customer contact."
          onClick={() => onSelect('invite')}
        />
        <ActionButton
          icon={<HugeiconsIcon icon={MailSend02Icon} strokeWidth={2} />}
          title="Invite Partner User"
          description="Send an invitation to a maintenance partner contact."
          onClick={() => onSelect('invite-ops')}
        />
      </div>
    </div>
  )
}

type ActionButtonProps = {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}

function ActionButton({ icon, title, description, onClick }: ActionButtonProps) {
  return (
    <button
      type="button"
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted"
      onClick={onClick}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-heading text-base font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}
