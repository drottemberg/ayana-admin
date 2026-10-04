import type { Customer } from '@/types/customer'
import { OrganizationType, type Organization } from '@/types/organization'
import type { Store } from '@/types/store'
import type { UserOrganizationPermission } from '@/types/user'
import {
  StoreScope,
  type CustomerMembershipInput,
  type CustomerMembershipRecord,
  type OpsCustomerScopeInput,
  type OpsMembershipInput,
  type OpsMembershipRecord,
  type TechnicianRole,
} from '@/types/membership'

export type OrganizationPermissionNode = Organization & {
  hasChildren?: boolean
  /** More pages available past what's currently in `children` — show a "Load more" row. */
  hasMore?: boolean
  /**
   * Real backend id, when `id` is a tree-path-scoped composite instead of the entity's own id.
   * Needed for the Partner tree: the same customer (and its stores) can legitimately appear
   * under more than one partner, so `id` there is namespaced per-partner to stay unique across
   * the whole tree (expand/select state is a plain Set<string> keyed by `id` — a real, shared
   * customer id colliding across two partner branches would make expanding one expand both).
   * Falls back to `id` wherever this is unset (every node outside the Partner tree).
   */
  entityId?: string
  children: OrganizationPermissionNode[]
}

export type OrganizationPermissionTreeChange = {
  organizations: string[]
  userChecked: string[]
  parents: string[]
}

export function createOrganizationPermission(
  organizationId: string,
  role: string | null = null,
): UserOrganizationPermission {
  // `role` is widened to plain string here on purpose — this same helper builds permission
  // entries for the Customer-invite tree too, where role values are CustomerRole, not UserRole.
  return { organizationId, role } as UserOrganizationPermission
}

export function buildOrganizationPermissionTree(
  customers: Customer[],
  stores: Store[],
): OrganizationPermissionNode | null {
  const childrenByParent = new Map<string, Store[]>()

  stores.forEach((store) => {
    const parentId = store.parentId ?? store.parent?.id
    if (!parentId) return

    const children = childrenByParent.get(parentId) ?? []
    children.push(store)
    childrenByParent.set(parentId, children)
  })

  const customerNodes = customers
    .map<OrganizationPermissionNode>((customer) => ({
      ...customer,
      children: (childrenByParent.get(customer.id) ?? [])
        .slice()
        .sort(sortOrganizations)
        .map((store) => ({ ...store, children: [] })),
    }))
    .sort(sortOrganizations)

  if (!customerNodes.length) return null

  return {
    id: 'root',
    name: 'All organizations',
    type: OrganizationType.MASTER,
    children: customerNodes,
  }
}

export function sortOrganizations<T extends Pick<Organization, 'name' | 'type'>>(first: T, second: T) {
  if (first.type !== second.type) {
    if (first.type === OrganizationType.CUSTOMER) return -1
    if (second.type === OrganizationType.CUSTOMER) return 1
  }

  return first.name.localeCompare(second.name)
}

export function getOrganizationNodeById(
  organizationId: string,
  root: OrganizationPermissionNode | null,
): OrganizationPermissionNode | null {
  if (!root) return null
  if (root.id === organizationId) return root

  for (const child of root.children) {
    const result = getOrganizationNodeById(organizationId, child)
    if (result) return result
  }

  return null
}

export function getOrganizationPathById(
  organizationId: string,
  root: OrganizationPermissionNode | null,
): OrganizationPermissionNode[] {
  if (!root) return []
  if (root.id === organizationId) return [root]

  for (const child of root.children) {
    const childPath = getOrganizationPathById(organizationId, child)
    if (childPath.length) return [root, ...childPath]
  }

  return []
}

export function getDescendantIds(node: OrganizationPermissionNode): string[] {
  return node.children.flatMap((child) => [child.id, ...getDescendantIds(child)])
}

export function getVisibleOrganizationIds(root: OrganizationPermissionNode | null): string[] {
  if (!root) return []

  if (root.type === OrganizationType.MASTER) {
    return root.children.flatMap((child) => [child.id, ...getDescendantIds(child)])
  }

  return [root.id, ...getDescendantIds(root)]
}

export function mergeOrganizationPermissionNode(
  root: OrganizationPermissionNode | null,
  loadedNode: OrganizationPermissionNode,
): OrganizationPermissionNode | null {
  if (!root) return loadedNode

  if (root.id === loadedNode.id) {
    return {
      ...root,
      ...loadedNode,
      children: loadedNode.children,
    }
  }

  return {
    ...root,
    children: root.children.map((child) => mergeOrganizationPermissionNode(child, loadedNode) ?? child),
  }
}

// Like mergeOrganizationPermissionNode, but for "Load more": appends a next page of children
// to a node instead of replacing what's already loaded. Dedupes by id in case a page overlaps.
export function appendOrganizationPermissionNodeChildren(
  root: OrganizationPermissionNode | null,
  nodeId: string,
  nextPageChildren: OrganizationPermissionNode[],
  hasMore: boolean,
): OrganizationPermissionNode | null {
  if (!root) return root

  if (root.id === nodeId) {
    const existingIds = new Set(root.children.map((child) => child.id))
    const appended = nextPageChildren.filter((child) => !existingIds.has(child.id))

    return { ...root, hasMore, children: [...root.children, ...appended] }
  }

  return {
    ...root,
    children: root.children.map(
      (child) => appendOrganizationPermissionNodeChildren(child, nodeId, nextPageChildren, hasMore) ?? child,
    ),
  }
}

export function getFullySelectedParentsOrItems(root: OrganizationPermissionNode | null, selectedIds: Set<string>) {
  const result: string[] = []

  const traverse = (node: OrganizationPermissionNode) => {
    if (node.children.length && node.children.every((child) => isEverySelected(child, selectedIds))) {
      result.push(node.id)
      return
    }

    if (node.children.length) {
      node.children.forEach(traverse)
      return
    }

    if (selectedIds.has(node.id)) result.push(node.id)
  }

  if (root?.type === OrganizationType.MASTER) {
    root.children.forEach(traverse)
  } else if (root) {
    traverse(root)
  }

  return result
}

export function isEverySelected(node: OrganizationPermissionNode, selectedIds: Set<string>): boolean {
  return selectedIds.has(node.id) && node.children.every((child) => isEverySelected(child, selectedIds))
}

export function isSomeSelected(node: OrganizationPermissionNode, selectedIds: Set<string>): boolean {
  return node.children.some((child) => selectedIds.has(child.id) || isSomeSelected(child, selectedIds))
}

export function getTreeSelectedOrganizationIds(
  permissions: Array<{ organizationId: string }> | null | undefined,
  tree: OrganizationPermissionNode | null,
): string[] {
  const selectedIds = new Set<string>()

  if (!Array.isArray(permissions)) return []

  permissions.forEach((permission) => {
    selectedIds.add(permission.organizationId)

    const node = getOrganizationNodeById(permission.organizationId, tree)
    if (node?.children.length) {
      getDescendantIds(node).forEach((id) => selectedIds.add(id))
    }
  })

  return Array.from(selectedIds)
}

export function compactSelectedOrganizationIds(
  organizationIds: string[],
  parents: string[],
  tree: OrganizationPermissionNode | null,
): string[] {
  const selectedIds = new Set(organizationIds)
  const compactIds = new Set([...organizationIds, ...parents])

  parents.forEach((parentId) => {
    const parentNode = getOrganizationNodeById(parentId, tree)
    if (!parentNode) return

    getDescendantIds(parentNode).forEach((descendantId) => {
      if (selectedIds.has(descendantId)) {
        compactIds.delete(descendantId)
      }
    })
  })

  return Array.from(compactIds)
}

export function synchronizePermissions(
  organizationIds: string[],
  permissions: UserOrganizationPermission[],
): UserOrganizationPermission[] {
  const permissionById = new Map(permissions.map((permission) => [permission.organizationId, permission]))

  return organizationIds.map(
    (organizationId) => permissionById.get(organizationId) ?? createOrganizationPermission(organizationId),
  )
}

export function getParentRole(
  organizationId: string,
  permissions: UserOrganizationPermission[],
  root: OrganizationPermissionNode | null,
) {
  const path = getOrganizationPathById(organizationId, root)
    .map((organization) => organization.id)
    .filter((id) => id !== organizationId)
  let parentRole: string | null = null

  path.forEach((id) => {
    const parentPermission = permissions.find((permission) => permission.organizationId === id)
    if (parentPermission?.role) {
      parentRole = parentPermission.role
    }
  })

  return parentRole
}

export function getPermissionsWithParentFilled(
  permissions: UserOrganizationPermission[],
  root: OrganizationPermissionNode | null,
): UserOrganizationPermission[] {
  return permissions.map((permission) =>
    permission.role
      ? permission
      : ({ ...permission, role: getParentRole(permission.organizationId, permissions, root) } as UserOrganizationPermission),
  )
}

// Converts the tree's checked-permission set into the typed membership shape the backend's
// invite/customer endpoint expects. A customer id present directly in `permissions` (with no
// individually-selected store beneath it) means that membership's scope is ALL; a customer with
// only some descendant stores selected (so the customer id itself was compacted out — see
// removeRedundantPermissions in UserPermissionsStep) means SPECIFIC, carrying just those store ids.
export function treeSelectionToCustomerMemberships(
  permissions: Array<{ organizationId: string; role: string | null }>,
  tree: OrganizationPermissionNode | null,
  defaultRole: CustomerMembershipInput['role'],
): CustomerMembershipInput[] {
  if (!tree) return []

  const permissionById = new Map(permissions.map((permission) => [permission.organizationId, permission]))
  const customerNodes = tree.type === OrganizationType.MASTER ? tree.children : [tree]

  return customerNodes
    .map((customerNode): CustomerMembershipInput | null => {
      const customerPermission = permissionById.get(customerNode.id)
      const selectedStoreNodes = customerNode.children.filter((store) => permissionById.has(store.id))

      if (!customerPermission && selectedStoreNodes.length === 0) return null

      if (selectedStoreNodes.length === 0) {
        return {
          customerId: customerNode.id,
          role: (customerPermission?.role as CustomerMembershipInput['role']) ?? defaultRole,
          storeScope: StoreScope.ALL,
        }
      }

      return {
        customerId: customerNode.id,
        role: (customerPermission?.role as CustomerMembershipInput['role']) ?? defaultRole,
        storeScope: StoreScope.SPECIFIC,
        stores: selectedStoreNodes.map((store) => ({
          storeId: store.id,
          role: permissionById.get(store.id)?.role as CustomerMembershipInput['role'] | undefined,
        })),
      }
    })
    .filter((membership): membership is CustomerMembershipInput => membership !== null)
}

// Same ALL-vs-SPECIFIC rule as treeSelectionToCustomerMemberships, one level deeper
// (Partner -> Customer -> Store). `selectedIds` here is the tree's already-compacted
// selection (OrganizationsPermissionTree.emitChange's `parents`, via compactSelectedOrganizationIds)
// — a fully-selected branch is represented by its top id alone, descendants omitted.
export function treeSelectionToOpsMemberships(
  selectedIds: string[],
  tree: OrganizationPermissionNode | null,
  defaultRole: TechnicianRole,
): OpsMembershipInput[] {
  if (!tree) return []

  const selectedSet = new Set(selectedIds)
  const partnerNodes = tree.type === OrganizationType.MASTER ? tree.children : [tree]

  return partnerNodes
    .map((partnerNode): OpsMembershipInput | null => {
      const isPartnerSelected = selectedSet.has(partnerNode.id)
      const selectedCustomerNodes = partnerNode.children.filter(
        (customerNode) =>
          selectedSet.has(customerNode.id) || customerNode.children.some((store) => selectedSet.has(store.id)),
      )

      if (!isPartnerSelected && selectedCustomerNodes.length === 0) return null

      if (isPartnerSelected) {
        return { partnerId: partnerNode.entityId ?? partnerNode.id, role: defaultRole, scopeType: StoreScope.ALL }
      }

      const customerScopes: OpsCustomerScopeInput[] = selectedCustomerNodes.map((customerNode) => {
        const selectedStoreIds = customerNode.children
          .filter((store) => selectedSet.has(store.id))
          .map((store) => store.entityId ?? store.id)

        return selectedStoreIds.length === 0
          ? { customerId: customerNode.entityId ?? customerNode.id, storeScope: StoreScope.ALL }
          : { customerId: customerNode.entityId ?? customerNode.id, storeScope: StoreScope.SPECIFIC, storeIds: selectedStoreIds }
      })

      return { partnerId: partnerNode.entityId ?? partnerNode.id, role: defaultRole, scopeType: StoreScope.SPECIFIC, customerScopes }
    })
    .filter((membership): membership is OpsMembershipInput => membership !== null)
}

// Inverse of treeSelectionToCustomerMemberships — seeds the edit-permissions tree's draft
// selection from a user's EXISTING customer memberships (UserEntity.customerMemberships).
export function customerMembershipsToPermissions(memberships: CustomerMembershipRecord[]): UserOrganizationPermission[] {
  const permissions: UserOrganizationPermission[] = []

  for (const membership of memberships) {
    if (membership.storeScope === StoreScope.ALL || !membership.stores?.length) {
      permissions.push({ organizationId: membership.customerId, role: membership.role } as UserOrganizationPermission)
      continue
    }

    for (const store of membership.stores) {
      permissions.push({
        organizationId: store.storeId,
        role: store.role ?? membership.role,
        parentId: membership.customerId,
      } as UserOrganizationPermission)
    }
  }

  return permissions
}

// Inverse of treeSelectionToOpsMemberships — seeds the edit-permissions tree's selectedIds
// from a user's EXISTING ops/technician memberships (UserEntity.technicianMemberships),
// reconstructing the same partner-scoped composite ids the Partner tree assigns on load
// (`${partnerId}::${customerId}`, `${partnerId}::${customerId}::${storeId}`) — deterministic,
// so this works without fetching the tree first.
export function opsMembershipsToSelectedIds(memberships: OpsMembershipRecord[]): string[] {
  const ids: string[] = []

  for (const membership of memberships) {
    if (membership.scopeType === StoreScope.ALL || !membership.customerScopes?.length) {
      ids.push(membership.partnerId)
      continue
    }

    for (const scope of membership.customerScopes) {
      const customerKey = `${membership.partnerId}::${scope.customerId}`

      if (scope.storeScope === StoreScope.ALL || !scope.storeIds?.length) {
        ids.push(customerKey)
        continue
      }

      scope.storeIds.forEach((storeId) => ids.push(`${customerKey}::${storeId}`))
    }
  }

  return ids
}

// The Partner tree's selectedIds are composite (`partnerId::customerId::storeId`) and its
// branches load lazily — a prefilled SPECIFIC selection deep in an unexpanded branch has no
// loaded children for isSomeSelected to find, so without this the partner/customer rows above
// it render fully unchecked instead of indeterminate. Derives every ancestor prefix of each
// selected id (that isn't itself selected, i.e. not a compacted-to-ALL branch) so those rows
// can show indeterminate before the user ever expands them.
export function getPartiallySelectedAncestorIds(selectedIds: string[]): Set<string> {
  const selectedSet = new Set(selectedIds)
  const partial = new Set<string>()

  for (const id of selectedIds) {
    const parts = id.split('::')
    for (let i = 1; i < parts.length; i++) {
      const ancestorId = parts.slice(0, i).join('::')
      if (!selectedSet.has(ancestorId)) partial.add(ancestorId)
    }
  }

  return partial
}
