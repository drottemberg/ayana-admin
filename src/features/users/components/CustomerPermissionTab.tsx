import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { SelectInput } from '@/components/ui/select-input'
import { Spinner } from '@/components/ui/spinner'
import { FormError } from '@/components/form-error'
import { getCustomerRequest } from '@/features/customers/api'
import { getOrganizationChildrenPermissionNode, getOrganizationsPermissionTreeRequest } from '@/lib/api/organizations'
import { updateCustomerMembership } from '@/features/users/api'
import { usersQueryKeys } from '@/features/users/query-keys'
import { UserService } from '@/features/users/user-service'
import { OrganizationsPermissionTree } from '@/features/users/components/user-drawer-steps/OrganizationsPermissionTree'
import {
  compactSelectedOrganizationIds,
  createOrganizationPermission,
  customerMembershipsToPermissions,
  getOrganizationPathById,
  getParentRole,
  getPermissionsWithParentFilled,
  getTreeSelectedOrganizationIds,
  mergeOrganizationPermissionNode,
  treeSelectionToCustomerMemberships,
  type OrganizationPermissionNode,
} from '@/features/users/components/user-drawer-steps/organization-permissions'
import { OrganizationType } from '@/types/organization'
import {
  CustomerRole,
  StoreScope,
  type CustomerMembershipInput,
  type CustomerMembershipRecord,
} from '@/types/membership'
import type { UserOrganizationPermission, User } from '@/types/user'

type CustomerPermissionTabProps = {
  user: User
  /** Set in the Customer portal — roots the tree at just this org and saves only its membership. */
  scopeToOrgId?: string
  readOnly?: boolean
}

function getCustomerMembershipSignature(membership: CustomerMembershipInput | CustomerMembershipRecord) {
  const stores =
    membership.storeScope === StoreScope.SPECIFIC
      ? (membership.stores ?? [])
          .map((store) => `${store.storeId}:${store.role ?? membership.role}`)
          .sort()
          .join('|')
      : ''

  return `${membership.role}:${membership.storeScope}:${stores}`
}

function customerMembershipHasChanged(
  membership: CustomerMembershipInput,
  existingMemberships: CustomerMembershipRecord[],
) {
  if (membership.storeScope === StoreScope.NONE) return true

  const existingMembership = existingMemberships.find((item) => item.customerId === membership.customerId)
  if (!existingMembership) return true

  return getCustomerMembershipSignature(membership) !== getCustomerMembershipSignature(existingMembership)
}

export function CustomerPermissionTab({ user, scopeToOrgId, readOnly = false }: CustomerPermissionTabProps) {
  const queryClient = useQueryClient()
  const [searchValue, setSearchValue] = useState('')
  const existingMemberships = useMemo(
    () =>
      scopeToOrgId
        ? (user.customerMemberships ?? []).filter((m) => m.customerId === scopeToOrgId)
        : (user.customerMemberships ?? []),
    [user.customerMemberships, scopeToOrgId],
  )
  const [selectedRole, setSelectedRole] = useState<CustomerRole>(existingMemberships[0]?.role ?? CustomerRole.MEMBER)
  const roleItems = UserService.customerRoleKeys().map((r) => ({
    value: r,
    label: UserService.customerRoleToString(r),
  }))
  const [draftPermissions, setDraftPermissions] = useState<UserOrganizationPermission[]>(() =>
    customerMembershipsToPermissions(existingMemberships),
  )
  const [lazyTree, setLazyTree] = useState<OrganizationPermissionNode | null>(null)
  const [loadingNodeIds, setLoadingNodeIds] = useState<Set<string>>(() => new Set())
  const [removedCustomerIds, setRemovedCustomerIds] = useState<Set<string>>(() => new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const treeQuery = useQuery({
    queryKey: ['customer-permission-tree', scopeToOrgId ?? 'all'],
    queryFn: async () => {
      if (!scopeToOrgId) return getOrganizationsPermissionTreeRequest()

      const customer = await getCustomerRequest(scopeToOrgId)
      return {
        id: customer.id,
        name: customer.name,
        type: OrganizationType.CUSTOMER,
        hasChildren: (customer.locations ?? 0) > 0,
        children: [],
      } satisfies OrganizationPermissionNode
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
  })
  const isLoading = treeQuery.isLoading
  const error = treeQuery.error
  const tree = lazyTree ?? treeQuery.data ?? null
  const defaultRole = selectedRole
  const selectedOrganizationIds = getTreeSelectedOrganizationIds(draftPermissions, tree)
  const partiallySelectedCustomerIds = useMemo(() => {
    const directIds = new Set(draftPermissions.map((p) => p.organizationId))
    return new Set(
      draftPermissions.filter((p) => p.parentId && !directIds.has(p.parentId)).map((p) => p.parentId as string),
    )
  }, [draftPermissions])

  const removeRedundantPermissions = (permissionsToNormalize: UserOrganizationPermission[]) => {
    const selectedIds = new Set(permissionsToNormalize.map((permission) => permission.organizationId))

    return permissionsToNormalize.filter((permission) => {
      const ancestorIds = getOrganizationPathById(permission.organizationId, tree)
        .map((organization) => organization.id)
        .filter((id) => id !== permission.organizationId)
      const hasSelectedAncestor = ancestorIds.some((id) => selectedIds.has(id))

      if (!permission.role) return !hasSelectedAncestor

      const inheritedRole = getParentRole(permission.organizationId, permissionsToNormalize, tree) ?? defaultRole
      if (permission.role !== inheritedRole) return true

      return !hasSelectedAncestor
    })
  }

  const handleChangeOrganizations = (organizationIds: string[], parents: string[]) => {
    if (readOnly) return

    const explicitIds = compactSelectedOrganizationIds(organizationIds, parents, tree)
    const previousPermissionById = new Map(
      draftPermissions.map((permission) => [permission.organizationId, permission]),
    )
    const filteredPermissions = explicitIds.map((organizationId) => {
      const previousPermission = previousPermissionById.get(organizationId)
      if (previousPermission) return previousPermission

      const path = getOrganizationPathById(organizationId, tree)
      const parentNode = path.length >= 2 ? path[path.length - 2] : null
      return { ...createOrganizationPermission(organizationId), parentId: parentNode?.id }
    })
    const nextPermissions = removeRedundantPermissions(filteredPermissions)
    const previousMemberships = treeSelectionToCustomerMemberships(
      getPermissionsWithParentFilled(removeRedundantPermissions(draftPermissions), tree),
      tree,
      selectedRole,
    )
    const nextMemberships = treeSelectionToCustomerMemberships(
      getPermissionsWithParentFilled(nextPermissions, tree),
      tree,
      selectedRole,
    )
    const nextMembershipCustomerIds = new Set(nextMemberships.map((membership) => membership.customerId))
    const existingMembershipCustomerIds = new Set(existingMemberships.map((membership) => membership.customerId))

    setRemovedCustomerIds((current) => {
      const next = new Set(current)

      previousMemberships.forEach((membership) => {
        if (
          existingMembershipCustomerIds.has(membership.customerId) &&
          !nextMembershipCustomerIds.has(membership.customerId)
        ) {
          next.add(membership.customerId)
        }
      })
      nextMembershipCustomerIds.forEach((customerId) => next.delete(customerId))

      return next
    })
    setDraftPermissions(nextPermissions)
  }

  const handleChangePermission = (organizationId: string, role: string) => {
    if (readOnly) return

    const inheritedRole = getParentRole(organizationId, draftPermissions, tree) ?? defaultRole
    const nextRole = role === inheritedRole ? null : role
    const existingPermission = draftPermissions.find((permission) => permission.organizationId === organizationId)
    const nextPermissions = existingPermission
      ? draftPermissions.map((permission) =>
          permission.organizationId === organizationId
            ? ({ ...permission, role: nextRole } as UserOrganizationPermission)
            : permission,
        )
      : [...draftPermissions, createOrganizationPermission(organizationId, nextRole)]

    setDraftPermissions(removeRedundantPermissions(nextPermissions))
  }

  const getOrganizationRole = (organizationId: string) => {
    const permission = draftPermissions.find((item) => item.organizationId === organizationId)
    if (permission?.role) return permission.role

    return getParentRole(organizationId, draftPermissions, tree) ?? defaultRole
  }

  const handleLoadChildren = async (node: OrganizationPermissionNode) => {
    if (!node.hasChildren || node.children.length > 0 || loadingNodeIds.has(node.id)) return

    setLoadingNodeIds((current) => new Set(current).add(node.id))

    try {
      const loadedNode = await getOrganizationChildrenPermissionNode(node)
      if (!loadedNode) return

      setLazyTree((currentTree) => mergeOrganizationPermissionNode(currentTree ?? tree, loadedNode))
    } finally {
      setLoadingNodeIds((current) => {
        const next = new Set(current)
        next.delete(node.id)
        return next
      })
    }
  }

  const saveCustomerPermission = async () => {
    setIsSaving(true)
    setSaveError(null)

    try {
      const finalPermissions = getPermissionsWithParentFilled(removeRedundantPermissions(draftPermissions), tree)
      const memberships = treeSelectionToCustomerMemberships(finalPermissions, tree, selectedRole)
      const removedMemberships: CustomerMembershipInput[] = existingMemberships
        .filter((membership) => removedCustomerIds.has(membership.customerId))
        .map((membership) => ({
          customerId: membership.customerId,
          role: membership.role,
          storeScope: StoreScope.NONE,
        }))
      const membershipsToSave = [...memberships, ...removedMemberships].filter((membership) =>
        customerMembershipHasChanged(membership, existingMemberships),
      )

      await Promise.all(membershipsToSave.map((membership) => updateCustomerMembership(String(user.id), membership)))

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.detail(String(user.id)) }),
      ])
      toast.success('Customer user permission saved.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save customer user permission.')
    } finally {
      setIsSaving(false)
    }
  }

  const errorMessage = saveError

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-7 py-2">
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mb-4 grid gap-4">
          <SelectInput
            label="Default role"
            items={roleItems}
            value={selectedRole}
            disabled={readOnly}
            onValueChange={(value) => setSelectedRole(String(value) as CustomerRole)}
          />
          {!scopeToOrgId ? (
            <SearchInput
              placeholder="Search organization"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          ) : null}
        </div>

        {error instanceof Error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error.message}
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            <Spinner /> Loading organizations...
          </div>
        ) : (
          <OrganizationsPermissionTree
            root={tree}
            selectedIds={selectedOrganizationIds}
            partiallySelectedIds={partiallySelectedCustomerIds}
            searchValue={searchValue}
            loadingIds={loadingNodeIds}
            readOnly={readOnly}
            onLoadChildren={handleLoadChildren}
            onChecked={({ organizations, parents }) => handleChangeOrganizations(organizations, parents)}
            renderActions={(node, isSelected) =>
              isSelected && !readOnly ? (
                <div className="w-32" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <SelectInput
                    items={roleItems}
                    value={getOrganizationRole(node.id)}
                    onValueChange={(value) => handleChangePermission(node.id, String(value))}
                    className="h-7 text-sm"
                  />
                </div>
              ) : null
            }
          />
        )}
      </div>
      {!readOnly ? (
        <div className="mt-auto flex flex-col gap-3 py-6">
          <div className="flex justify-end">
            <Button
              size="lg"
              loading={isSaving}
              disabled={(!draftPermissions.length && !removedCustomerIds.size) || isSaving}
              onClick={() => void saveCustomerPermission()}
            >
              Save Customer User permission
            </Button>
          </div>
          <FormError message={errorMessage} />
        </div>
      ) : null}
    </div>
  )
}
