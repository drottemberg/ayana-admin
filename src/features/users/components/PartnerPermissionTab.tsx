import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { SelectInput } from '@/components/ui/select-input'
import { Spinner } from '@/components/ui/spinner'
import { FormError } from '@/components/form-error'
import { apiClient } from '@/lib/api-client'
import {
  getPartnerScopedCustomersPermissionNode,
  getPartnerScopedStoresPermissionNode,
  getPartnersPermissionTreeRequest,
} from '@/lib/api/organizations'
import { updateOpsMembership } from '@/features/users/api'
import { usersQueryKeys } from '@/features/users/query-keys'
import { UserService } from '@/features/users/user-service'
import { OrganizationsPermissionTree } from '@/features/users/components/user-drawer-steps/OrganizationsPermissionTree'
import {
  appendOrganizationPermissionNodeChildren,
  compactSelectedOrganizationIds,
  getOrganizationPathById,
  getPartiallySelectedAncestorIds,
  mergeOrganizationPermissionNode,
  opsMembershipsToSelectedIds,
  treeSelectionToOpsMemberships,
  type OrganizationPermissionNode,
} from '@/features/users/components/user-drawer-steps/organization-permissions'
import { OrganizationType } from '@/types/organization'
import {
  StoreScope,
  TechnicianRole,
  type OpsCustomerScopeInput,
  type OpsMembershipInput,
  type OpsMembershipRecord,
} from '@/types/membership'
import type { User } from '@/types/user'

type PartnerPermissionTabProps = {
  user: User
  /** Set in the Ops portal — roots the tree at just this partner and saves only its membership. */
  scopeToOrgId?: string
  readOnly?: boolean
}

function getOpsCustomerScopeKey(partnerId: string, customerId: string) {
  return `${partnerId}:${customerId}`
}

function getOpsCustomerScopeSignature(
  scope: OpsCustomerScopeInput | NonNullable<OpsMembershipRecord['customerScopes']>[number],
) {
  const storeIds = scope.storeScope === StoreScope.SPECIFIC ? (scope.storeIds ?? []).slice().sort().join('|') : ''
  return `${scope.storeScope}:${storeIds}`
}

function getOpsMembershipChange(
  membership: OpsMembershipInput,
  existingMemberships: OpsMembershipRecord[],
  removedCustomerScopeKeys: Set<string>,
): OpsMembershipInput | null {
  if (membership.scopeType === StoreScope.NONE) return membership

  const existingMembership = existingMemberships.find((item) => item.partnerId === membership.partnerId)
  if (!existingMembership) return membership
  if (membership.scopeType !== existingMembership.scopeType) return membership

  if (membership.scopeType === StoreScope.ALL) {
    return membership.role !== existingMembership.role ? membership : null
  }

  const existingScopeByCustomerId = new Map(
    (existingMembership.customerScopes ?? []).map((scope) => [scope.customerId, scope]),
  )
  const changedCustomerScopes: OpsCustomerScopeInput[] = (membership.customerScopes ?? []).filter((scope) => {
    const existingScope = existingScopeByCustomerId.get(scope.customerId)
    if (!existingScope) return true

    return getOpsCustomerScopeSignature(scope) !== getOpsCustomerScopeSignature(existingScope)
  })

  existingScopeByCustomerId.forEach((scope) => {
    if (!removedCustomerScopeKeys.has(getOpsCustomerScopeKey(membership.partnerId, scope.customerId))) return

    changedCustomerScopes.push({ customerId: scope.customerId, storeScope: StoreScope.NONE })
  })

  if (membership.role === existingMembership.role && changedCustomerScopes.length === 0) return null

  return {
    partnerId: membership.partnerId,
    role: membership.role,
    scopeType: membership.scopeType,
    ...(changedCustomerScopes.length ? { customerScopes: changedCustomerScopes } : {}),
  }
}

export function PartnerPermissionTab({ user, scopeToOrgId, readOnly = false }: PartnerPermissionTabProps) {
  const queryClient = useQueryClient()
  const [searchValue, setSearchValue] = useState('')
  const existingMemberships = scopeToOrgId
    ? (user.technicianMemberships ?? []).filter((m) => m.partnerId === scopeToOrgId)
    : (user.technicianMemberships ?? [])
  const [selectedRole, setSelectedRole] = useState<TechnicianRole>(
    existingMemberships[0]?.role ?? TechnicianRole.TECHNICIAN,
  )
  const [selectedIds, setSelectedIds] = useState<string[]>(() => opsMembershipsToSelectedIds(existingMemberships))
  const [lazyTree, setLazyTree] = useState<OrganizationPermissionNode | null>(null)
  const [loadingNodeIds, setLoadingNodeIds] = useState<Set<string>>(() => new Set())
  const [loadChildrenError, setLoadChildrenError] = useState<string | null>(null)
  const [removedPartnerIds, setRemovedPartnerIds] = useState<Set<string>>(() => new Set())
  const [removedCustomerScopeKeys, setRemovedCustomerScopeKeys] = useState<Set<string>>(() => new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const pageByNodeId = useRef<Map<string, number>>(new Map())

  const treeQuery = useQuery({
    queryKey: ['partner-permission-tree', scopeToOrgId ?? 'all'],
    queryFn: async () => {
      if (!scopeToOrgId) return getPartnersPermissionTreeRequest()

      const partner = await apiClient.get<{ id: string; name: string }>(`/maintenance-partners/${scopeToOrgId}`)
      return {
        id: partner.id,
        name: partner.name,
        type: OrganizationType.MAINTENANCE,
        hasChildren: true,
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
  const partiallySelectedIds = useMemo(() => getPartiallySelectedAncestorIds(selectedIds), [selectedIds])

  const handleChecked = ({ organizations, parents }: { organizations: string[]; parents: string[] }) => {
    if (readOnly) return

    const nextSelectedIds = compactSelectedOrganizationIds(organizations, parents, tree)
    const previousMemberships = treeSelectionToOpsMemberships(selectedIds, tree, selectedRole)
    const nextMemberships = treeSelectionToOpsMemberships(nextSelectedIds, tree, selectedRole)
    const nextMembershipByPartnerId = new Map(nextMemberships.map((membership) => [membership.partnerId, membership]))
    const existingPartnerIds = new Set(existingMemberships.map((membership) => membership.partnerId))
    const existingCustomerScopeKeys = new Set(
      existingMemberships.flatMap((membership) =>
        (membership.customerScopes ?? []).map((scope) =>
          getOpsCustomerScopeKey(membership.partnerId, scope.customerId),
        ),
      ),
    )

    setRemovedPartnerIds((current) => {
      const next = new Set(current)

      previousMemberships.forEach((membership) => {
        if (existingPartnerIds.has(membership.partnerId) && !nextMembershipByPartnerId.has(membership.partnerId)) {
          next.add(membership.partnerId)
        }
      })
      nextMembershipByPartnerId.forEach((membership) => next.delete(membership.partnerId))

      return next
    })
    setRemovedCustomerScopeKeys((current) => {
      const next = new Set(current)

      previousMemberships.forEach((previousMembership) => {
        const nextMembership = nextMembershipByPartnerId.get(previousMembership.partnerId)
        if (!nextMembership || previousMembership.scopeType !== StoreScope.SPECIFIC) return

        const nextCustomerIds = new Set((nextMembership.customerScopes ?? []).map((scope) => scope.customerId))
        ;(previousMembership.customerScopes ?? []).forEach((scope) => {
          const scopeKey = getOpsCustomerScopeKey(previousMembership.partnerId, scope.customerId)
          if (existingCustomerScopeKeys.has(scopeKey) && !nextCustomerIds.has(scope.customerId)) {
            next.add(scopeKey)
          }
        })
      })
      nextMemberships.forEach((membership) => {
        ;(membership.customerScopes ?? []).forEach((scope) => {
          next.delete(getOpsCustomerScopeKey(membership.partnerId, scope.customerId))
        })
      })

      return next
    })
    setSelectedIds(nextSelectedIds)
  }

  const loadNodePage = (node: OrganizationPermissionNode, page: number): Promise<OrganizationPermissionNode | null> => {
    if (node.type === OrganizationType.MAINTENANCE) return getPartnerScopedCustomersPermissionNode(node, page)

    const partnerId =
      getOrganizationPathById(node.id, tree).find((n) => n.type === OrganizationType.MAINTENANCE)?.id ?? scopeToOrgId
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
      setLazyTree((currentTree) => mergeOrganizationPermissionNode(currentTree ?? tree, loadedNode))
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
      setLazyTree((currentTree) =>
        appendOrganizationPermissionNodeChildren(
          currentTree ?? tree,
          node.id,
          loadedNode.children,
          loadedNode.hasMore ?? false,
        ),
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

  const savePartnerPermission = async () => {
    setIsSaving(true)
    setSaveError(null)

    try {
      const memberships = treeSelectionToOpsMemberships(selectedIds, tree, selectedRole)
      const removedMemberships: OpsMembershipInput[] = existingMemberships
        .filter((membership) => removedPartnerIds.has(membership.partnerId))
        .map((membership) => ({
          partnerId: membership.partnerId,
          role: membership.role,
          scopeType: StoreScope.NONE,
        }))
      const membershipsToSave = [...memberships, ...removedMemberships]
        .map((membership) => getOpsMembershipChange(membership, existingMemberships, removedCustomerScopeKeys))
        .filter((membership): membership is OpsMembershipInput => membership !== null)

      await Promise.all(membershipsToSave.map((membership) => updateOpsMembership(String(user.id), membership)))

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.detail(String(user.id)) }),
      ])
      toast.success('Partner permission saved.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save partner permission.')
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
            items={UserService.technicianRoleKeys().map((r) => ({
              value: r,
              label: UserService.technicianRoleToString(r),
            }))}
            value={selectedRole}
            disabled={readOnly}
            onValueChange={(value) => setSelectedRole(String(value) as TechnicianRole)}
          />
          {!scopeToOrgId ? (
            <SearchInput
              placeholder="Search partner"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          ) : null}
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
            partiallySelectedIds={partiallySelectedIds}
            searchValue={searchValue}
            loadingIds={loadingNodeIds}
            readOnly={readOnly}
            onLoadChildren={handleLoadChildren}
            onLoadMore={handleLoadMore}
            onChecked={handleChecked}
          />
        )}
      </div>
      {!readOnly ? (
        <div className="mt-auto flex flex-col gap-3 py-6">
          <div className="flex justify-end">
            <Button
              size="lg"
              loading={isSaving}
              disabled={(!selectedIds.length && !removedPartnerIds.size && !removedCustomerScopeKeys.size) || isSaving}
              onClick={() => void savePartnerPermission()}
            >
              Save Partner permission
            </Button>
          </div>
          <FormError message={errorMessage} />
        </div>
      ) : null}
    </div>
  )
}
