import { Badge } from '@/components/ui/badge'
import { OrganizationStatus, type OrganizationStatus as OrgStatus } from '@/types/organization'

const config: Record<OrgStatus, { label: string; className: string }> = {
  [OrganizationStatus.ACTIVE]:   { label: 'Active',   className: 'bg-green-100 text-green-800 border-green-200' },
  [OrganizationStatus.PENDING]:  { label: 'Inactive', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  [OrganizationStatus.ARCHIVED]: { label: 'Archived', className: 'bg-muted text-muted-foreground border-border' },
  [OrganizationStatus.DELETED]:  { label: 'Deleted',  className: 'bg-red-100 text-red-800 border-red-200' },
}

export function OrganizationStatusBadge({
  status,
  isDeleted,
  isArchived,
}: {
  status?: OrgStatus
  /** Fallback only, for rows the backend hasn't caught up on yet — OrganizationEntity.getStatus() already folds these into `status`. */
  isDeleted?: boolean
  isArchived?: boolean
}) {
  const resolved: OrgStatus =
    status ?? (isDeleted ? OrganizationStatus.DELETED : isArchived ? OrganizationStatus.ARCHIVED : OrganizationStatus.PENDING)
  const { label, className } = config[resolved] ?? config[OrganizationStatus.PENDING]

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  )
}
