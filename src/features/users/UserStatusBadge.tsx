import { Badge } from '@/components/ui/badge'
import { UserService } from '@/features/users/user-service'
import { UserStatus } from '@/types/user'

const badgeClassByStatus: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: 'bg-green-100 text-green-800 border-green-200',
  [UserStatus.DISABLED]: 'bg-orange-100 text-orange-800 border-orange-200',
  [UserStatus.ARCHIVED]: 'bg-muted text-muted-foreground border-border',
  [UserStatus.DELETED]: 'bg-destructive/10 text-destructive border-destructive/20',
}

export function UserStatusBadge({ status }: { status?: UserStatus }) {
  if (!status) return null

  return (
    <Badge variant="outline" className={badgeClassByStatus[status]}>
      {UserService.userStatusToString(status)}
    </Badge>
  )
}
