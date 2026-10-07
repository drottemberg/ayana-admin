import { useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon'
import Building01Icon from '@hugeicons/core-free-icons/Building01Icon'
import Store01Icon from '@hugeicons/core-free-icons/Store01Icon'

import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { OrganizationType } from '@/types/organization'
import {
  getDescendantIds,
  getFullySelectedParentsOrItems,
  getOrganizationPathById,
  getVisibleOrganizationIds,
  isEverySelected,
  isSomeSelected,
  type OrganizationPermissionNode,
  type OrganizationPermissionTreeChange,
} from '@/features/users/components/user-drawer-steps/organization-permissions'

type OrganizationsPermissionTreeProps = {
  root: OrganizationPermissionNode | null
  selectedIds: string[]
  partiallySelectedIds?: Set<string>
  searchValue?: string
  loadingIds?: Set<string>
  renderActions?: (node: OrganizationPermissionNode, isSelected: boolean) => React.ReactNode
  onLoadChildren?: (node: OrganizationPermissionNode) => Promise<void> | void
  onLoadMore?: (node: OrganizationPermissionNode) => Promise<void> | void
  readOnly?: boolean
  onChecked: (change: OrganizationPermissionTreeChange) => void
}

export function OrganizationsPermissionTree({
  root,
  selectedIds,
  partiallySelectedIds,
  searchValue,
  loadingIds = new Set(),
  renderActions,
  onLoadChildren,
  onLoadMore,
  readOnly = false,
  onChecked,
}: OrganizationsPermissionTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [userCheckedIds, setUserCheckedIds] = useState<Set<string>>(() => new Set(selectedIds))
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const visibleExpandedIds = useMemo(() => {
    const next = new Set(expandedIds)

    if (root?.type === OrganizationType.MASTER) next.add(root.id)
    if (root && searchValue?.trim()) {
      getVisibleOrganizationIds(root).forEach((id) => next.add(id))
    }

    return next
  }, [expandedIds, root, searchValue])

  if (!root) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No items found
      </div>
    )
  }

  const emitChange = (nextSelectedIds: Set<string>, nextUserCheckedIds: Set<string>) => {
    const hiddenRootId = root.type === OrganizationType.MASTER ? root.id : null
    const parents = getFullySelectedParentsOrItems(root, nextSelectedIds).filter((id) => id !== hiddenRootId)

    onChecked({
      organizations: Array.from(nextSelectedIds).filter((id) => id !== hiddenRootId),
      userChecked: Array.from(nextUserCheckedIds).filter((id) => id !== hiddenRootId),
      parents,
    })
  }

  const toggleExpanded = (node: OrganizationPermissionNode) => {
    const shouldExpand = !expandedIds.has(node.id)

    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(node.id)) {
        next.delete(node.id)
      } else {
        next.add(node.id)
      }

      return next
    })

    if (shouldExpand && node.hasChildren && node.children.length === 0) {
      void onLoadChildren?.(node)
    }
  }

  const toggleSelected = (node: OrganizationPermissionNode) => {
    if (readOnly) return

    const nextSelectedIds = new Set(selectedIdSet)
    const nextUserCheckedIds = new Set(userCheckedIds)
    const ids = [node.id, ...getDescendantIds(node)]
    const shouldSelect = !selectedIdSet.has(node.id)

    ids.forEach((id) => {
      if (shouldSelect) {
        nextSelectedIds.add(id)
      } else {
        nextSelectedIds.delete(id)
      }
    })

    if (shouldSelect) {
      nextUserCheckedIds.add(node.id)
      getDescendantIds(node).forEach((id) => nextUserCheckedIds.delete(id))
    } else {
      ids.forEach((id) => nextUserCheckedIds.delete(id))

      // When unchecking a node, any ancestor in selectedIds that was implicitly
      // selecting it must be "decompacted": replaced by its explicit remaining siblings.
      const path = getOrganizationPathById(node.id, root)
      path
        .slice(0, -1)
        .reverse()
        .forEach((ancestor) => {
          if (!nextSelectedIds.has(ancestor.id)) return
          nextSelectedIds.delete(ancestor.id)
          nextUserCheckedIds.delete(ancestor.id)
          ancestor.children.forEach((sibling) => {
            if (!path.some((p) => p.id === sibling.id)) {
              nextSelectedIds.add(sibling.id)
              getDescendantIds(sibling).forEach((id) => nextSelectedIds.add(id))
            }
          })
        })
    }

    setUserCheckedIds(nextUserCheckedIds)
    emitChange(nextSelectedIds, nextUserCheckedIds)
  }

  const filterNode = (node: OrganizationPermissionNode): OrganizationPermissionNode | null => {
    const query = searchValue?.trim().toLowerCase()
    if (!query) return node

    const children = node.children.map(filterNode).filter(Boolean) as OrganizationPermissionNode[]
    const matches = node.name.toLowerCase().includes(query)

    if (matches || children.length) {
      return { ...node, children }
    }

    return null
  }

  const visibleRoot = filterNode(root)
  const visibleNodes =
    visibleRoot?.type === OrganizationType.MASTER ? visibleRoot.children : visibleRoot ? [visibleRoot] : []

  return (
    <div className="grid max-w-full gap-1 overflow-hidden">
      {visibleNodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          expandedIds={visibleExpandedIds}
          loadingIds={loadingIds}
          selectedIds={selectedIdSet}
          partiallySelectedIds={partiallySelectedIds}
          readOnly={readOnly}
          onToggleExpanded={toggleExpanded}
          onToggleSelected={toggleSelected}
          renderActions={renderActions}
          onLoadMore={onLoadMore}
        />
      ))}
      {root.hasMore && !loadingIds.has(root.id) ? (
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground"
          style={{ paddingLeft: 8 }}
          onClick={() => onLoadMore?.(root)}
        >
          Load more
        </Button>
      ) : null}
    </div>
  )
}

type TreeNodeProps = {
  node: OrganizationPermissionNode
  level: number
  expandedIds: Set<string>
  loadingIds: Set<string>
  selectedIds: Set<string>
  partiallySelectedIds?: Set<string>
  parentSelected?: boolean
  onToggleExpanded: (node: OrganizationPermissionNode) => void
  onToggleSelected: (node: OrganizationPermissionNode) => void
  renderActions?: (node: OrganizationPermissionNode, isSelected: boolean) => React.ReactNode
  onLoadMore?: (node: OrganizationPermissionNode) => Promise<void> | void
  readOnly?: boolean
}

function TreeNode({
  node,
  level,
  expandedIds,
  loadingIds,
  selectedIds,
  partiallySelectedIds,
  parentSelected = false,
  onToggleExpanded,
  onToggleSelected,
  renderActions,
  onLoadMore,
  readOnly = false,
}: TreeNodeProps) {
  const isBranch = node.hasChildren ?? node.children.length > 0
  const isExpanded = expandedIds.has(node.id)
  const isLoading = loadingIds.has(node.id)
  const isSelected = selectedIds.has(node.id) || parentSelected || (isBranch && isEverySelected(node, selectedIds))
  // partiallySelectedIds covers branches whose children are not loaded, so isSomeSelected
  // cannot see the selected descendant yet.
  const isHalfSelected =
    !isSelected &&
    (isSomeSelected(node, selectedIds) ||
      (node.type !== OrganizationType.LOCATION && (partiallySelectedIds?.has(node.id) ?? false)))

  return (
    <div className="max-w-full overflow-hidden">
      <div
        className={cn(
          'flex min-h-11 w-full max-w-full items-center gap-2 overflow-hidden px-2 py-1.5 text-sm',
          isSelected && 'bg-muted/60',
        )}
        style={{ paddingLeft: 8 + level * 18 }}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn('shrink-0', !isBranch && 'invisible')}
          onClick={() => onToggleExpanded(node)}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            className={cn('transition-transform', isExpanded && 'rotate-90')}
          />
        </Button>
        <Checkbox
          checked={isSelected}
          indeterminate={isHalfSelected}
          disabled={readOnly}
          className={cn(readOnly && 'pointer-events-none')}
          onCheckedChange={() => onToggleSelected(node)}
        />
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <HugeiconsIcon
            icon={node.type === OrganizationType.LOCATION ? Store01Icon : Building01Icon}
            strokeWidth={2}
          />
        </span>
        <span className="min-w-0 flex-1 truncate overflow-hidden whitespace-nowrap">{node.name}</span>
        <div className="max-w-32 min-w-0 shrink-0 overflow-hidden">{renderActions?.(node, isSelected)}</div>
      </div>

      {isBranch && isExpanded ? (
        <div className="grid max-w-full overflow-hidden border-b border-border">
          {isLoading ? (
            <div
              className="flex min-h-10 items-center gap-2 px-2 py-2 text-sm text-muted-foreground"
              style={{ paddingLeft: 8 + (level + 1) * 18 }}
            >
              <Spinner />
              <span>Loading...</span>
            </div>
          ) : null}
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              loadingIds={loadingIds}
              selectedIds={selectedIds}
              partiallySelectedIds={partiallySelectedIds}
              parentSelected={isSelected && !isHalfSelected}
              readOnly={readOnly}
              onToggleExpanded={onToggleExpanded}
              onToggleSelected={onToggleSelected}
              renderActions={renderActions}
              onLoadMore={onLoadMore}
            />
          ))}
          {node.hasMore && !isLoading ? (
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-muted-foreground"
              style={{ paddingLeft: 8 + (level + 1) * 18 }}
              onClick={() => onLoadMore?.(node)}
            >
              Load more
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
