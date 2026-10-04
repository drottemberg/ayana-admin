import type { QueryClient, QueryKey } from '@tanstack/react-query'

import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { getInitialDataTableState, getTableQueryState } from '@/components/data-table-state'
import type { ApiListDto, ApiListResult } from '@/lib/api-types'
import type { BatchRequestDto, BatchRequestItemDto } from '@/lib/batch-api'

export type BatchCacheEntry = {
  key: string
  queryKey: QueryKey
  request: BatchRequestItemDto
  map: (result: ApiListResult<unknown>) => DataTableAsyncResult<unknown>
  fallbackData: DataTableAsyncResult<unknown>
}

export type BatchDetailCacheEntry<TData = unknown> = {
  key: string
  queryKey: QueryKey
  map: (result: unknown) => TData
}

type TableBatchCacheEntryOptions<TData extends Record<string, unknown>> = {
  key: string
  queryKey: readonly unknown[]
  tableKey: string
  url: string
  method?: BatchRequestItemDto['method']
  pageSize?: number
  initialFilters?: Partial<Record<keyof TData & string, string[]>>
  payload: (tableState: DataTableState<TData>) => ApiListDto
  map: (result: ApiListResult<unknown>) => DataTableAsyncResult<TData>
}

export function getDataTableQueryKey<TData extends Record<string, unknown>>(
  queryKey: readonly unknown[],
  tableState: DataTableState<TData>,
): QueryKey {
  return [...queryKey, getTableQueryState(tableState)]
}

export function createTableBatchCacheEntry<TData extends Record<string, unknown>>({
  key,
  queryKey,
  tableKey,
  url,
  method = 'POST',
  pageSize,
  initialFilters,
  payload,
  map,
}: TableBatchCacheEntryOptions<TData>): BatchCacheEntry {
  const tableState = getInitialDataTableState<TData>({ tableKey, pageSize, initialFilters })

  return {
    key,
    queryKey: getDataTableQueryKey(queryKey, tableState),
    request: {
      url,
      method,
      payload: payload(tableState),
    },
    map: map as (result: ApiListResult<unknown>) => DataTableAsyncResult<unknown>,
    fallbackData: { items: [], count: 0, pageCount: 1 },
  }
}

function isBatchSubrequestError(result: unknown) {
  if (!result || typeof result !== 'object') return false

  return 'statusCode' in result && typeof (result as { statusCode?: unknown }).statusCode === 'number'
}

export function toBatchRequestDto(entries: BatchCacheEntry[], requests: BatchRequestDto = {}): BatchRequestDto {
  return {
    ...requests,
    ...Object.fromEntries(entries.map((entry) => [entry.key, entry.request])),
  }
}

export function writeBatchDetailsToQueryCache({
  data,
  entries,
  queryClient,
}: {
  data: Record<string, unknown>
  entries: BatchDetailCacheEntry[]
  queryClient: QueryClient
}) {
  for (const entry of entries) {
    const result = data[entry.key]
    if (result) {
      queryClient.setQueryData(entry.queryKey, entry.map(result))
    }
  }
}

export function writeBatchEntriesToQueryCache({
  data,
  entries,
  queryClient,
}: {
  data: Record<string, unknown>
  entries: BatchCacheEntry[]
  queryClient: QueryClient
}): string[] {
  const failedKeys: string[] = []

  for (const entry of entries) {
    const result = data[entry.key]
    if (!result) {
      queryClient.setQueryData(entry.queryKey, entry.fallbackData)
      failedKeys.push(entry.key)
      continue
    }

    if (isBatchSubrequestError(result)) {
      queryClient.setQueryData(entry.queryKey, entry.fallbackData)
      failedKeys.push(entry.key)
      continue
    }

    try {
      queryClient.setQueryData(entry.queryKey, entry.map(result as ApiListResult<unknown>))
    } catch {
      queryClient.setQueryData(entry.queryKey, entry.fallbackData)
      failedKeys.push(entry.key)
    }
  }

  return failedKeys
}

export function writeBatchResponseToQueryCache({
  data,
  detailEntries = [],
  tableEntries,
  queryClient,
}: {
  data: Record<string, unknown>
  detailEntries?: BatchDetailCacheEntry[]
  tableEntries: BatchCacheEntry[]
  queryClient: QueryClient
}): string[] {
  writeBatchDetailsToQueryCache({ data, entries: detailEntries, queryClient })
  return writeBatchEntriesToQueryCache({ data, entries: tableEntries, queryClient })
}
