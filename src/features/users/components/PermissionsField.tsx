import { TextInput } from '@/components/ui/text-input'
import {
  getOrganizationNodeById,
  type OrganizationPermissionNode,
} from '@/features/users/components/user-drawer-steps/organization-permissions'
import { OrganizationType } from '@/types/organization'
import type { UserOrganizationPermission } from '@/types/user'

type PermissionsFieldProps = {
  permissions?: UserOrganizationPermission[]
  tree?: OrganizationPermissionNode | null
  error?: string
  onOpen: () => void
}

export function PermissionsField({ permissions, tree, error, onOpen }: PermissionsFieldProps) {
  const summary = getPermissionSummary(permissions, tree)

  return (
    <TextInput
      label="Permissions"
      readOnly
      required
      value={summary}
      onClick={onOpen}
      className="cursor-pointer"
      placeholder="Select permissions"
      error={error}
      endIcon="grid"
    />
  )
}

function getPermissionSummary(permissions?: UserOrganizationPermission[], tree?: OrganizationPermissionNode | null) {
  if (!permissions?.length) return ''
  if (!tree) return `${permissions.length} organization${permissions.length === 1 ? '' : 's'} selected`

  const counts = permissions.reduce(
    (result, permission) => {
      const node = getOrganizationNodeById(permission.organizationId, tree)

      if (node?.type === OrganizationType.CUSTOMER) result.customers += 1
      if (node?.type === OrganizationType.LOCATION) result.locations += 1
      if (!node || (node.type !== OrganizationType.CUSTOMER && node.type !== OrganizationType.LOCATION)) {
        result.organizations += 1
      }

      return result
    },
    { customers: 0, locations: 0, organizations: 0 },
  )

  return [
    formatCount(counts.customers, 'customer'),
    formatCount(counts.locations, 'location'),
    formatCount(counts.organizations, 'organization'),
  ]
    .filter(Boolean)
    .join(', ')
}

function formatCount(count: number, label: string) {
  if (!count) return ''
  return `${count} ${label}${count === 1 ? '' : 's'}`
}
