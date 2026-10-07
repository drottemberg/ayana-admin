import { useQuery } from '@tanstack/react-query'

import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CustomerPermissionTab } from '@/features/users/components/CustomerPermissionTab'
import { StaffPermissionTab } from '@/features/users/components/StaffPermissionTab'
import { getUserRequest } from '@/features/users/api'
import { usersQueryKeys } from '@/features/users/query-keys'
import { readSelectedOrgId } from '@/features/organizations/storage'
import { getPortalSafe, Portal } from '@/utils/portal-utils'
import type { User } from '@/types/user'

type EditPermissionsStepProps = {
  user: User
  permissionScope?: {
    kind: 'customer'
    organizationId: string
    readOnly?: boolean
    canEdit?: boolean
  }
  onEditFullPermissions?: () => Promise<void> | void
}

// Admin can edit Staff and Customer memberships. The Customer portal only manages the
// selected user's membership in its current organization.
export function EditPermissionsStep({ user, permissionScope, onEditFullPermissions }: EditPermissionsStepProps) {
  const portal = getPortalSafe()
  const currentOrgId = readSelectedOrgId() ?? undefined

  // The `user` prop is whatever the caller had in hand (a list row, a stale cache entry) — load
  // the real record fresh so every tab's default values (isStaff/staffRole/customerMemberships/
  // customerMemberships) reflect what's actually on the user right now, not what was on screen
  // before this drawer opened.
  const userQuery = useQuery({
    queryKey: usersQueryKeys.detail(String(user.id)),
    queryFn: () => getUserRequest(String(user.id)),
  })

  if (userQuery.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center gap-3 px-7 py-2 text-sm text-muted-foreground">
        <Spinner /> Loading user...
      </div>
    )
  }

  if (userQuery.error instanceof Error) {
    return (
      <div className="mx-7 my-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {userQuery.error.message}
      </div>
    )
  }

  const currentUser = userQuery.data ?? user
  const scopedOrgId = permissionScope?.organizationId ?? currentOrgId
  const readOnly = permissionScope?.readOnly ?? false

  if (permissionScope?.kind === 'customer') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <CustomerPermissionTab user={currentUser} scopeToOrgId={scopedOrgId} readOnly={readOnly} />
        {readOnly && onEditFullPermissions ? (
          <div className="mt-auto flex justify-end px-7 py-6">
            <Button size="lg" onClick={() => void onEditFullPermissions()}>
              Edit
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  if (portal === Portal.CUSTOMER) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <CustomerPermissionTab user={currentUser} scopeToOrgId={currentOrgId} />
      </div>
    )
  }

  return (
    <Tabs defaultValue="staff" className="flex min-h-0 flex-1 flex-col">
      <div className="px-7">
        <TabsList>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="customer">Customer</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="staff" className="flex min-h-0 flex-1 flex-col">
        <StaffPermissionTab user={currentUser} />
      </TabsContent>
      <TabsContent value="customer" className="flex min-h-0 flex-1 flex-col">
        <CustomerPermissionTab user={currentUser} />
      </TabsContent>
    </Tabs>
  )
}
