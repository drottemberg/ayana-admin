import type { DataTableSettings, DataTableState, TableQueryState } from '@/components/data-table'
import { DATA_TABLE_DEFAULT_PAGE_SIZE } from '@/components/data-table-config'
import { SortOrder } from '@/lib/api-types'
import { getLocalStorage } from '@/utils/storage-utils'

type InitialDataTableStateOptions<TData extends Record<string, unknown>> = {
  tableKey?: string
  pageSize?: number
  initialFilters?: Partial<Record<keyof TData & string, string[]>>
  queryState?: TableQueryState<TData>
}

function getTableSettingsKey(tableKey?: string) {
  return tableKey ? `data_table_settings:${tableKey}` : ''
}

function readTableSettings<TData extends Record<string, unknown>>(tableKey?: string): DataTableSettings<TData> {
  const settingsKey = getTableSettingsKey(tableKey)
  if (!settingsKey) return {}

  const settings = getLocalStorage<DataTableSettings<TData>>(settingsKey)
  return settings && typeof settings === 'object' ? settings : {}
}

function parseTableSettingsSort(sort?: string) {
  if (!sort) return []

  const [id, direction] = sort.split(':')
  if (!id) return []

  return [{ id, desc: direction === SortOrder.desc }]
}

function formatTableSettingsSort<TData extends Record<string, unknown>>(sorting: DataTableState<TData>['sorting']) {
  const [sort] = sorting
  return sort ? `${sort.id}:${sort.desc ? SortOrder.desc : SortOrder.asc}` : undefined
}

export function getInitialDataTableState<TData extends Record<string, unknown>>({
  tableKey,
  pageSize,
  initialFilters,
  queryState,
}: InitialDataTableStateOptions<TData>): DataTableState<TData> {
  const initialSettings = readTableSettings<TData>(tableKey)
  const sourceState = queryState ?? initialSettings
  const mergedFilters = { ...sourceState.f, ...initialFilters }

  return {
    pagination: {
      pageIndex: Math.max((sourceState.p ?? 1) - 1, 0),
      pageSize: sourceState.s ?? pageSize ?? DATA_TABLE_DEFAULT_PAGE_SIZE,
    },
    sorting: parseTableSettingsSort(sourceState.sort),
    search: sourceState.q ?? '',
    filters: mergedFilters as Partial<Record<keyof TData & string, string[]>>,
  }
}

export function getTableQueryState<TData extends Record<string, unknown>>(
  state: DataTableState<TData>,
): TableQueryState<TData> {
  const filters = Object.fromEntries(
    Object.entries(state.filters).filter(([, values]) => Array.isArray(values) && values.length),
  ) as Partial<Record<keyof TData & string, string[]>>

  return {
    p: state.pagination.pageIndex + 1,
    s: state.pagination.pageSize,
    q: state.search.trim() || undefined,
    sort: formatTableSettingsSort(state.sorting),
    f: Object.keys(filters).length ? filters : undefined,
  }
}

export function hasTableQueryParams(searchParams: URLSearchParams) {
  return (
    searchParams.has('q') ||
    searchParams.has('p') ||
    searchParams.has('s') ||
    searchParams.has('sort') ||
    Array.from(searchParams.keys()).some((key) => key.startsWith('f.'))
  )
}

export function parseTableQueryParams<TData extends Record<string, unknown>>(
  searchParams: URLSearchParams,
): TableQueryState<TData> {
  const page = Number(searchParams.get('p'))
  const pageSize = Number(searchParams.get('s'))
  const filters = Array.from(searchParams.entries()).reduce<Record<string, string[]>>((acc, [key, value]) => {
    if (!key.startsWith('f.') || !value) return acc

    const filterKey = key.slice(2)
    const filterValues = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (filterKey && filterValues.length) {
      acc[filterKey] = filterValues
    }

    return acc
  }, {})

  return {
    p: Number.isFinite(page) && page > 0 ? page : undefined,
    s: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : undefined,
    q: searchParams.get('q')?.trim() || undefined,
    sort: searchParams.get('sort') || undefined,
    f: Object.keys(filters).length ? (filters as TableQueryState<TData>['f']) : undefined,
  }
}

export function writeTableQueryParams<TData extends Record<string, unknown>>(
  searchParams: URLSearchParams,
  state: TableQueryState<TData>,
  options: { defaultPageSize?: number } = {},
) {
  const nextParams = new URLSearchParams(searchParams)
  const defaultPageSize = options.defaultPageSize ?? DATA_TABLE_DEFAULT_PAGE_SIZE

  nextParams.delete('q')
  nextParams.delete('p')
  nextParams.delete('s')
  nextParams.delete('sort')
  Array.from(nextParams.keys()).forEach((key) => {
    if (key.startsWith('f.')) nextParams.delete(key)
  })

  if (state.q) nextParams.set('q', state.q)
  if (state.p && state.p > 1) nextParams.set('p', String(state.p))
  if (state.s && state.s !== defaultPageSize) nextParams.set('s', String(state.s))
  if (state.sort) nextParams.set('sort', state.sort)
  Object.entries(state.f ?? {}).forEach(([key, values]) => {
    if (Array.isArray(values) && values.length) {
      nextParams.set(`f.${key}`, values.join(','))
    }
  })

  return nextParams
}
