import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  DetailPageLayout,
  DetailSidePanel,
  RelatedEntityModule,
  type DetailPanelSection,
} from '@/components/app/detail-page-layout'
import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { NO_VALUE_STR } from '@/constants'
import { EntityIcon } from '@/components/app/entity-icons'
import { getStoreGroupRequest, getStoreGroupStoresRequest } from '@/features/groups/api'
import { StoreGroupService } from '@/features/groups/store-group-service'
import { storeGroupsQueryKeys } from '@/features/groups/query-keys'
import { storeColumns } from '@/features/stores/store-columns'
import type { StoreGroup } from '@/types/group'
import type { Store } from '@/types/store'
import { formatDateTime } from '@/utils/date-utils'
import { StringUtils } from '@/utils'

function getStoreGroupFromListCache(queryClient: ReturnType<typeof useQueryClient>, groupId: string) {
  const cachedQueries = queryClient.getQueriesData<DataTableAsyncResult<StoreGroup>>({
    queryKey: storeGroupsQueryKeys.all,
  })

  for (const [, data] of cachedQueries) {
    const group = Array.isArray(data?.items) ? data.items.find((item) => item.id === groupId) : undefined
    if (group) return group
  }

  return undefined
}

function getStoreGroupStoresFromCache(queryClient: ReturnType<typeof useQueryClient>, groupId: string) {
  const cachedQueries = queryClient.getQueriesData<DataTableAsyncResult<Store>>({
    queryKey: storeGroupsQueryKeys.stores(groupId),
  })

  for (const [, data] of cachedQueries) {
    if (Array.isArray(data?.items)) return data.items
  }

  return []
}

function toMembersResult(items: Store[], state: DataTableState<Store>): DataTableAsyncResult<Store> {
  const search = state.search.trim().toLocaleLowerCase()
  const filteredItems = search
    ? items.filter((store) =>
        [store.name, store.customer?.name, store.retailer, store.address?.city, store.address?.countryId]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase().includes(search)),
      )
    : items
  const [sort] = state.sorting
  const sortedItems = sort
    ? [...filteredItems].sort((left, right) => {
        const result = StringUtils.safeLocaleCompare(
          String(left[sort.id as keyof Store] ?? ''),
          String(right[sort.id as keyof Store] ?? ''),
        )
        return sort.desc ? -result : result
      })
    : filteredItems
  const { pageIndex, pageSize } = state.pagination
  const start = pageIndex * pageSize

  return {
    items: sortedItems.slice(start, start + pageSize),
    count: sortedItems.length,
    pageCount: Math.max(1, Math.ceil(sortedItems.length / pageSize)),
  }
}

export default function StoreGroupPage() {
  const { groupId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const groupQuery = useQuery({
    queryKey: storeGroupsQueryKeys.detail(groupId),
    queryFn: () => getStoreGroupRequest(groupId),
    enabled: Boolean(groupId),
    initialData: () => getStoreGroupFromListCache(queryClient, groupId),
  })

  const group = groupQuery.data
  const storeCount = group?.storeCount ?? 0
  const headerActions = group
    ? StoreGroupService.getDetailHeaderActions(group, queryClient, () => navigate('/store-groups'))
    : undefined

  const sections: DetailPanelSection[] = [
    {
      title: 'Details',
      icon: EntityIcon.groups,
      fields: [
        { label: 'ID', value: group?.id ?? NO_VALUE_STR },
        { label: 'Owner', value: group?.ownerId ?? NO_VALUE_STR },
        { label: 'Created at', value: formatDateTime(group?.createdAt, NO_VALUE_STR) },
        { label: 'Stores count', value: storeCount },
      ],
    },
  ]

  const loadStores = useCallback(
    async (state: DataTableState<Store>) => toMembersResult(await getStoreGroupStoresRequest(groupId), state),
    [groupId],
  )

  return (
    <DetailPageLayout
      header={{
        title: group?.name ?? 'Store Group',
        backTo: '/store-groups',
        options: headerActions?.options,
      }}
      modules={[{ key: 'stores', label: 'Stores', count: storeCount }]}
      aside={<DetailSidePanel sections={sections} isLoading={groupQuery.isLoading} />}
    >
      <RelatedEntityModule
        id="module-stores"
        title="Stores"
        icon={EntityIcon.stores}
        initialTotal={storeCount}
        action={{
          label: 'Add stores',
          onClick: () =>
            void StoreGroupService.showAddStoresModal(
              groupId,
              getStoreGroupStoresFromCache(queryClient, groupId),
              queryClient,
            ),
        }}
        queryKey={storeGroupsQueryKeys.stores(groupId)}
        loadData={loadStores}
        tableKey={`store-groups.${groupId}.stores`}
        columns={storeColumns}
        getCommands={StoreGroupService.getMemberTableActions(groupId, queryClient)}
        getRowCommands={StoreGroupService.getMemberRowActions(groupId, queryClient)}
        loadingMessage="Loading group stores..."
        emptyMessage="No stores in this group."
        errorMessage="Failed to load group stores."
      />
    </DetailPageLayout>
  )
}
