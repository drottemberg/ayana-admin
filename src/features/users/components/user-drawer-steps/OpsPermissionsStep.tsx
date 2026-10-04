import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { SelectInput } from '@/components/ui/select-input'
import { Spinner } from '@/components/ui/spinner'
import {
  getPartnerScopedCustomersPermissionNode,
  getPartnerScopedStoresPermissionNode,
  getPartnersPermissionTreeRequest,
  partnerTreeQueryKeys,
} from '@/lib/api/organizations'
import { useLazyPartnerTreeQuery } from '@/features/organizations/use-partner-tree'
import { UserService } from '@/features/users/user-service'
import { OrganizationsPermissionTree } from '@/features/users/components/user-drawer-steps/OrganizationsPermissionTree'
import {
  appendOrganizationPermissionNodeChildren,
  compactSelectedOrganizationIds,
  getOrganizationPathById,
  mergeOrganizationPermissionNode,
  type OrganizationPermissionNode,
} from '@/features/users/components/user-drawer-steps/organization-permissions'
import { OrganizationType } from '@/types/organization'
import { TechnicianRole } from '@/types/membership'

type OpsPermissionsStepProps = {
  role?: TechnicianRole
  selectedIds?: string[]
  onCancel: () => void
  onConfirm: (selectedIds: string[], role: TechnicianRole) => void
}

// Simpler than UserPermissionsStep on purpose: the Ops membership model has no per-node role
// override (OpsCustomerScopeInput carries only scope, not role — role lives once, on the
// partner-level membership), so this only needs a checkbox tree, not a role select per row.
export function OpsPermissionsStep({ role, selectedIds: initialSelectedIds = [], onCancel, onConfirm }: OpsPermissionsStepProps) {
  const queryClient = useQueryClient()
  const [searchValue, setSearchValue] = useState('')
  const [selectedRole, setSelectedRole] = useState<TechnicianRole>(role ?? TechnicianRole.TECHNICIAN)
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds)
  const [lazyTree, setLazyTree] = useState<OrganizationPermissionNode | null>(() =>
    queryClient.getQueryData<OrganizationPermissionNode | null>(partnerTreeQueryKeys.lazyRoot) ?? null,
  )
  const [loadingNodeIds, setLoadingNodeIds] = useState<Set<string>>(() => new Set())
  const [loadChildrenError, setLoadChildrenError] = useState<string | null>(null)
  const pageByNodeId = useRef<Map<string, number>>(new Map())
  const treeQuery = useLazyPartnerTreeQuery()
  const isLoading = treeQuery.isLoading
  const error = treeQuery.error
  const tree = lazyTree ?? treeQuery.data ?? null

  const handleChecked = ({ organizations, parents }: { organizations: string[]; parents: string[] }) => {
    setSelectedIds(compactSelectedOrganizationIds(organizations, parents, tree))
  }

  // A partner's children are the customers within its MaintenanceScope grant; a customer
  // nested under a partner has its stores filtered to that same partner's scope over it —
  // hence the ancestor lookup for partnerId when the node being loaded is a CUSTOMER.
  const loadNodePage = (node: OrganizationPermissionNode, page: number): Promise<OrganizationPermissionNode | null> => {
    if (node.id === 'root') return getPartnersPermissionTreeRequest(page)
    if (node.type === OrganizationType.MAINTENANCE) return getPartnerScopedCustomersPermissionNode(node, page)

    const partnerId = getOrganizationPathById(node.id, tree).find((n) => n.type === OrganizationType.MAINTENANCE)?.id
    if (!partnerId) return Promise.resolve(null)

    return getPartnerScopedStoresPermissionNode(node, partnerId, page)
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
      queryClient.setQueryData<OrganizationPermissionNode | null>(partnerTreeQueryKeys.lazyRoot, (currentTree) =>
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
        appendOrganizationPermissionNodeChildren(currentTree ?? tree, node.id, loadedNode.children, loadedNode.hasMore ?? false)

      setLazyTree((currentTree) => appendLoadedNode(currentTree))
      queryClient.setQueryData<OrganizationPermissionNode | null>(partnerTreeQueryKeys.lazyRoot, (currentTree) =>
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

  const handleConfirm = () => {
    onConfirm(selectedIds, selectedRole)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-7 py-2">
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mb-4 grid gap-4">
          <SelectInput
            label="Default role"
            items={UserService.technicianRoleKeys().map((r) => ({ value: r, label: UserService.technicianRoleToString(r) }))}
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(String(value) as TechnicianRole)}
          />
          <SearchInput
            placeholder="Search partner"
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
            <Spinner /> Loading partners...
          </div>
        ) : (
          <OrganizationsPermissionTree
            root={tree}
            selectedIds={selectedIds}
            searchValue={searchValue}
            loadingIds={loadingNodeIds}
            onLoadChildren={handleLoadChildren}
            onLoadMore={handleLoadMore}
            onChecked={handleChecked}
          />
        )}
      </div>
      <div className="mt-auto flex justify-center gap-3 py-6">
        <Button variant="outline" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="lg" onClick={handleConfirm} disabled={!selectedIds.length}>
          Confirm
        </Button>
      </div>
    </div>
  )
}
