import { Button } from '@/components/ui/button'
import type { UserFlowAction } from '@/features/users/components/user-drawer-steps/types'
import type { User } from '@/types/user'

type InviteUserSuccessStepProps = {
  action?: UserFlowAction
  user?: User
  onCreateAnother: () => void
  onClose: () => void
}

export function InviteUserSuccessStep({ action, user, onCreateAnother, onClose }: InviteUserSuccessStepProps) {
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'user'
  const isCreateAction = action === 'create'

  return (
    <div className="flex min-h-0 flex-1 flex-col px-7 py-10">
      <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center text-center">
        <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
          <span aria-hidden="true">✓</span>
        </div>
        <h2 className="mb-2 font-heading text-2xl font-semibold text-foreground">
          {isCreateAction ? 'User created' : 'Invite sent'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isCreateAction ? `${displayName} has been created.` : `Invitation has been sent to ${displayName}.`}
        </p>
      </div>

      <div className="mt-auto flex justify-center gap-3">
        <Button variant="outline" size="lg" onClick={onCreateAnother}>
          {isCreateAction ? 'Create another' : 'Send another'}
        </Button>
        <Button size="lg" onClick={onClose}>
          OK
        </Button>
      </div>
    </div>
  )
}
