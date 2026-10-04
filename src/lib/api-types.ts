import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'

export const SortOrder = {
  asc: 'asc',
  desc: 'desc',
} as const

export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]

export type ApiListDto = {
  filters?: Record<string, unknown>
  search?: string
  page?: number
  limit?: number
  orderBy?: string
  order?: SortOrder
}

export type ApiListResult<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}

export function toApiListDto<T extends Record<string, unknown>>(
  tableState: DataTableState<T>,
  filters?: Record<string, unknown>,
): ApiListDto {
  const [sort] = tableState.sorting
  const search = tableState.search.trim()

  return {
    filters: {
      ...tableState.filters,
      ...filters,
    },
    search: search || undefined,
    page: tableState.pagination.pageIndex + 1,
    limit: tableState.pagination.pageSize,
    orderBy: sort?.id,
    order: sort ? (sort.desc ? SortOrder.desc : SortOrder.asc) : undefined,
  }
}

export function toDataTableResult<T>(result: ApiListResult<T>): DataTableAsyncResult<T> {
  return {
    items: result.items,
    count: result.total,
    pageCount: Math.max(1, Math.ceil(result.total / result.limit)),
  }
}

export type FilterMetadataItem = {
  label: string
  value: string
}

export type FilterMetadata = {
  key: string
  label: string
  items: FilterMetadataItem[]
  multiple: boolean
}

export type FilterMetadataResponse = {
  filters: FilterMetadata[]
}

export type FilterMetadataRequest = {
  keys: Record<string, boolean>
  context?: Record<string, string>
  search?: string
}
