import { useEffect } from 'react'
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import {
  getPartnersPermissionTreeRequest,
  partnerTreeQueryKeys,
} from '@/lib/api/organizations'
import type { OrganizationPermissionNode } from '@/features/users/components/user-drawer-steps/organization-permissions'
import { DEFAULT_STALE_TIME, getQueryStaleTime } from '@/lib/query-config'

type PartnerTreeQueryOptions = {
  enabled?: boolean
}

export function useLazyPartnerTreeQuery(options: PartnerTreeQueryOptions = {}) {
  const queryClient = useQueryClient()
  const reusableFullTree = getFreshTreeFromCache(queryClient, partnerTreeQueryKeys.full())

  useEffect(() => {
    if (!reusableFullTree) return

    const lazyState = queryClient.getQueryState<OrganizationPermissionNode | null>(partnerTreeQueryKeys.lazyRoot)

    if (!lazyState || lazyState.dataUpdatedAt < reusableFullTree.dataUpdatedAt) {
      queryClient.setQueryData(partnerTreeQueryKeys.lazyRoot, reusableFullTree.data, {
        updatedAt: reusableFullTree.dataUpdatedAt,
      })
    }
  }, [queryClient, reusableFullTree])

  return useQuery({
    queryKey: partnerTreeQueryKeys.lazyRoot,
    queryFn: () => getPartnersPermissionTreeRequest(),
    initialData: () => reusableFullTree?.data,
    initialDataUpdatedAt: () => reusableFullTree?.dataUpdatedAt,
    // This cache is built incrementally (load children / load more merge into it directly via
    // queryClient.setQueryData) — it must never auto-refetch. A background refetch on remount
    // would fetch a bare page-1 root and silently overwrite every branch already expanded,
    // making a confirmed selection look lost the next time this step opens.
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    ...options,
  })
}

export { partnerTreeQueryKeys }

function getFreshTreeFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: QueryKey,
): { data: OrganizationPermissionNode | null; dataUpdatedAt: number } | null {
  const state = queryClient.getQueryState<OrganizationPermissionNode | null>(queryKey)

  if (!state?.data || !state.dataUpdatedAt || state.isInvalidated) return null

  const staleTime = getQueryStaleTime<number>(DEFAULT_STALE_TIME)
  const isFresh = Date.now() - state.dataUpdatedAt <= staleTime

  if (!isFresh) return null

  return {
    data: state.data,
    dataUpdatedAt: state.dataUpdatedAt,
  }
}
