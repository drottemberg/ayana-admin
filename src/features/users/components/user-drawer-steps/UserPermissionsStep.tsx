import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { SelectInput } from '@/components/ui/select-input'
import { TextInput } from '@/components/ui/text-input'
import {
  getOrganizationChildrenPermissionNode,
  getOrganizationsPermissionTreeRequest,
  organizationTreeQueryKeys,
} from '@/lib/api/organizations'
import { useLazyOrganizationTreeQuery } from '@/features/organizations/use-organization-tree'
import { UserService } from '@/features/users/user-service'
import { OrganizationsPermissionTree } from '@/features/users/components/user-drawer-steps/OrganizationsPermissionTree'
import {
  appendOrganizationPermissionNodeChildren,
  compactSelectedOrganizationIds,
  createOrganizationPermission,
  getParentRole,
  getOrganizationPathById,
  getPermissionsWithParentFilled,
  getTreeSelectedOrganizationIds,
  mergeOrganizationPermissionNode,
  replaceDefaultPermissionRoles,
  type OrganizationPermissionNode,
} from '@/features/users/components/user-drawer-steps/organization-permissions'
import { UserRole, type User, type UserOrganizationPermission } from '@/types/user'
import { Spinner } from '@/components/ui/spinner'

type RoleOption = { value: string; label: string }

type UserPermissionsStepProps = {
  user?: User
  role?: string
  position?: string
  showPosition?: boolean
  permissions?: UserOrganizationPermission[]
  /** Defaults to the legacy UserRole options when omitted — Customer invite passes CustomerRole options instead. */
  roleOptions?: RoleOption[]
  onCancel: () => void
  onConfirm: (permissions: UserOrganizationPermission[], role: string, position: string) => void
}

export function UserPermissionsStep({
  user,
  role,
  position,
  showPosition = true,
  permissions = [],
  roleOptions,
  onCancel,
  onConfirm,
}: UserPermissionsStepProps) {
  const queryClient = useQueryClient()
  const [searchValue, setSearchValue] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>(role ?? user?.role ?? UserRole.MEMBER)
  const roleItems = roleOptions ?? UserService.roleKeys().map((r) => ({ value: r, label: UserService.roleToString(r) }))
  const [draftPosition, setDraftPosition] = useState(position ?? user?.position ?? '')
  const [draftPermissions, setDraftPermissions] = useState<UserOrganizationPermission[]>(() =>
    Array.isArray(permissions) ? permissions : [],
  )
  const [lazyTree, setLazyTree] = useState<OrganizationPermissionNode | null>(
    () => queryClient.getQueryData<OrganizationPermissionNode | null>(organizationTreeQueryKeys.lazyRoot) ?? null,
  )
  const [loadingNodeIds, setLoadingNodeIds] = useState<Set<string>>(() => new Set())
  const [loadChildrenError, setLoadChildrenError] = useState<string | null>(null)
  const pageByNodeId = useRef<Map<string, number>>(new Map())
  const defaultRole = selectedRole
  const treeQuery = useLazyOrganizationTreeQuery()
  const isLoading = treeQuery.isLoading
  const error = treeQuery.error
  const tree = lazyTree ?? treeQuery.data ?? null
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

  const handleChangeOrganizations = (organizationIds: string[], _userChecked: string[], parents: string[]) => {
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

    setDraftPermissions(removeRedundantPermissions(filteredPermissions))
  }

  const handleChangePermission = (organizationId: string, role: string) => {
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

  const handleConfirm = () => {
    onConfirm(
      getPermissionsWithParentFilled(removeRedundantPermissions(draftPermissions), tree),
      selectedRole,
      draftPosition,
    )
  }

  const handleRoleChange = (nextRole: string) => {
    setDraftPermissions((current) => replaceDefaultPermissionRoles(current, selectedRole, nextRole))
    setSelectedRole(nextRole)
  }

  const loadNodePage = (node: OrganizationPermissionNode, page: number): Promise<OrganizationPermissionNode | null> => {
    if (node.id === 'root') return getOrganizationsPermissionTreeRequest(page)

    return getOrganizationChildrenPermissionNode(node, page)
  }

  const handleLoadChildren = async (node: OrganizationPermissionNode) => {
    if (!node.hasChildren || node.children.length > 0 || loadingNodeIds.has(node.id)) return

    setLoadingNodeIds((current) => new Set(current).add(node.id))
    setLoadChildrenError(null)

    try {
      const loadedNode = await loadNodePage(node, 1)
      if (!loadedNode) return

      pageByNodeId.current.set(node.id, 1)
      const mergeLoadedNode = (currentTree: OrganizationPermissionNode | null | undefined) =>
        mergeOrganizationPermissionNode(currentTree ?? tree, loadedNode)

      setLazyTree((currentTree) => mergeLoadedNode(currentTree))
      queryClient.setQueryData<OrganizationPermissionNode | null>(organizationTreeQueryKeys.lazyRoot, (currentTree) =>
        mergeLoadedNode(currentTree),
      )
    } catch (loadError) {
      setLoadChildrenError(loadError instanceof Error ? loadError.message : `Failed to load "${node.name}".`)
    } finally {
      setLoadingNodeIds((current) => {
        const next = new Set(current)
        next.delete(node.id)
        return next
      })
    }
  }

  const handleLoadMore = async (node: OrganizationPermissionNode) => {
    if (loadingNodeIds.has(node.id)) return

    setLoadingNodeIds((current) => new Set(current).add(node.id))
    setLoadChildrenError(null)

    try {
      const nextPage = (pageByNodeId.current.get(node.id) ?? 1) + 1
      const loadedNode = await loadNodePage(node, nextPage)
      if (!loadedNode) return

      pageByNodeId.current.set(node.id, nextPage)
      const appendLoadedNode = (currentTree: OrganizationPermissionNode | null | undefined) =>
        appendOrganizationPermissionNodeChildren(
          currentTree ?? tree,
          node.id,
          loadedNode.children,
          loadedNode.hasMore ?? false,
        )

      setLazyTree((currentTree) => appendLoadedNode(currentTree))
      queryClient.setQueryData<OrganizationPermissionNode | null>(organizationTreeQueryKeys.lazyRoot, (currentTree) =>
        appendLoadedNode(currentTree),
      )
    } catch (loadError) {
      setLoadChildrenError(loadError instanceof Error ? loadError.message : `Failed to load more "${node.name}".`)
    } finally {
      setLoadingNodeIds((current) => {
        const next = new Set(current)
        next.delete(node.id)
        return next
      })
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-7 py-2">
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mb-4 grid gap-4">
          <SelectInput
            label="Default role"
            items={roleItems}
            value={selectedRole}
            onValueChange={(value) => handleRoleChange(String(value))}
          />
          {showPosition && (
            <TextInput
              label="Default position"
              placeholder="e.g. Store Manager"
              value={draftPosition}
              onChange={(e) => setDraftPosition(e.target.value)}
            />
          )}
          <SearchInput
            placeholder="Search organization"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
        </div>

        {loadChildrenError ? (
          <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {loadChildrenError}
          </div>
        ) : null}

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
            onLoadChildren={handleLoadChildren}
            onLoadMore={handleLoadMore}
            onChecked={({ organizations, userChecked, parents }) =>
              handleChangeOrganizations(organizations, userChecked, parents)
            }
            renderActions={(node, isSelected) =>
              isSelected ? (
                <OrganizationRoleSelect
                  items={roleItems}
                  value={getOrganizationRole(node.id)}
                  onChange={(role) => handleChangePermission(node.id, role)}
                />
              ) : null
            }
          />
        )}
      </div>
      <div className="mt-auto flex justify-center gap-3 py-6">
        <Button variant="outline" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="lg" onClick={handleConfirm} disabled={!draftPermissions.length}>
          Confirm
        </Button>
      </div>
    </div>
  )
}

type OrganizationRoleSelectProps = {
  items: RoleOption[]
  value: string
  onChange: (role: string) => void
}

function OrganizationRoleSelect({ items, value, onChange }: OrganizationRoleSelectProps) {
  return (
    <div className="w-32" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
      <SelectInput
        items={items}
        value={value}
        onValueChange={(value) => onChange(String(value))}
        className="h-7 text-sm"
      />
    </div>
  )
}
