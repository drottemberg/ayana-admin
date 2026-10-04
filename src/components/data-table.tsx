import * as React from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type Row,
  type SortingState,
  type Table as TanStackTable,
  type VisibilityState,
} from '@tanstack/react-table'
import { HugeiconsIcon } from '@hugeicons/react'
import LeftToRightListBulletIcon from '@hugeicons/core-free-icons/LeftToRightListBulletIcon'
import ArrowDown02Icon from '@hugeicons/core-free-icons/ArrowDown02Icon'
import MoreHorizontalIcon from '@hugeicons/core-free-icons/MoreHorizontalIcon'
import ArrowUp02Icon from '@hugeicons/core-free-icons/ArrowUp02Icon'
import FilterHorizontalIcon from '@hugeicons/core-free-icons/FilterHorizontalIcon'

import { Button, buttonVariants } from '@/components/ui/button'
import { type VariantProps } from 'class-variance-authority'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownActionsMenu, type DropdownActionItem } from '@/components/ui/dropdown-menu'
import { SearchInput } from '@/components/ui/search-input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Modals } from '@/providers/modal'
import { Spinner } from '@/components/ui/spinner'
import { TablePagination } from '@/components/table-pagination'
import { EmptyBlock } from './empty-block'
import { getLocalStorage, removeLocalStorage, setLocalStorage } from '@/utils/storage-utils'
import { SortOrder } from '@/lib/api-types'
import {
  getInitialDataTableState,
  getTableQueryState,
  hasTableQueryParams,
  parseTableQueryParams,
  writeTableQueryParams,
} from '@/components/data-table-state'
import { DATA_TABLE_DEFAULT_PAGE_SIZE, DATA_TABLE_PER_PAGE_OPTIONS } from '@/components/data-table-config'

const PER_PAGE_OPTIONS = DATA_TABLE_PER_PAGE_OPTIONS
const DEFAULT_PAGE_SIZE = DATA_TABLE_DEFAULT_PAGE_SIZE

export type DataTableFilter<TData> = {
  id: string
  label: string
  column: keyof TData & string
  selectionMode?: 'single' | 'multiple'
  options?: string[]
  getValue?: (row: TData) => unknown
  /**
   * Async paginated options — load on open, search-as-you-type, load more on scroll.
   * When present, ignores `options`.
   * Returns a page of { id, label } items plus total count.
   */
  queryFn?: (search: string, page: number) => Promise<{ items: { id: string; label: string }[]; total: number }>
}

export type DataTableCommand<TData extends Record<string, unknown>> = {
  label: string
  onClick: (tableState: TData[]) => void
  disabled?: boolean
  variant?: 'default' | 'destructive'
}

export type DataTableState<TData extends Record<string, unknown>> = {
  pagination: PaginationState
  sorting: SortingState
  search: string
  filters: Partial<Record<keyof TData & string, string[]>>
}

export type TableQueryState<TData extends Record<string, unknown>> = {
  p?: number
  s?: number
  q?: string
  sort?: string
  f?: Partial<Record<keyof TData & string, string[]>>
}

export type DataTableSettings<TData extends Record<string, unknown>> = TableQueryState<TData> & {
  columnVisibility?: VisibilityState
}

export type DataTableAsyncResult<TData> = {
  items: TData[]
  count: number
  pageCount: number
}

type DataTableBaseProps<TData extends Record<string, unknown>> = {
  tableData: TData[]
  columns?: ColumnDef<TData>[]
  filters?: DataTableFilter<TData>[]
  getCommands?: (selectedData: TData[]) => DataTableCommand<TData>[]
  getRowCommands?: (row: TData) => DropdownActionItem[]
  primaryCommand?: DataTableCommand<TData>
  command?: DataTableCommand<TData>
  searchPlaceholder?: string
  toolbarExtra?: React.ReactNode
  searchColumns?: (keyof TData & string)[]
  pageSize?: number
  loadingMessage?: string
  emptyMessage?: string
  emptyAction?: {
    name: string
    onClick: () => void
  } & VariantProps<typeof buttonVariants>
  errorMessage?: string
  getRowId?: (row: TData, index: number) => string
  getRowCanSelect?: (row: TData) => boolean
  className?: string
  isLoading?: boolean
  manual?: boolean
  itemsCount?: number
  pageCount?: number
  onStateChange?: (state: DataTableState<TData>) => void
  onSelectedDataChange?: (selectedData: TData[]) => void
  initialSelectedIds?: string[]
  selectionMode?: 'single' | 'multiple'
  disabledSelection?: boolean
  customizeColumns?: boolean
  perPageOptions?: boolean
  tableKey?: string
  title?: React.ReactNode
  showTotalCount?: boolean
  showToolbar?: boolean
  showPagination?: boolean
  initialFilters?: Partial<Record<keyof TData & string, string[]>>
  syncQueryParams?: boolean
  onRowClick?: (row: TData) => void
  getRowClassName?: (row: TData) => string | undefined
}

export type DataTableProps<TData extends Record<string, unknown>> = Omit<
  DataTableBaseProps<TData>,
  'tableData' | 'manual' | 'itemsCount' | 'pageCount'
> & {
  tableData?: TData[]
  data?: TData[]
}

export type DataTableAsyncProps<TData extends Record<string, unknown>> = Omit<
  DataTableBaseProps<TData>,
  'tableData' | 'manual' | 'itemsCount' | 'pageCount' | 'onStateChange'
> & {
  queryKey: readonly unknown[]
  loadData: (state: DataTableState<TData>) => Promise<DataTableAsyncResult<TData>>
  refetchOnMount?: boolean | 'always'
  refetchInterval?: number | false
}

function getStringValue(value: unknown) {
  if (Array.isArray(value)) return value.join(' ')
  if (value === null || value === undefined) return ''
  return String(value)
}

function buildColumns<TData extends Record<string, unknown>>(data: TData[]): ColumnDef<TData>[] {
  const firstRow = data[0]
  if (!firstRow) return []

  return Object.keys(firstRow).map((key) => ({
    accessorKey: key,
    header: key,
    cell: ({ getValue }) => getStringValue(getValue()),
  }))
}

function getFilterOptions<TData extends Record<string, unknown>>(data: TData[], filter: DataTableFilter<TData>) {
  const { column, getValue, options: configuredOptions } = filter

  if (configuredOptions?.length) return configuredOptions

  return Array.from(
    new Set(
      data
        .flatMap((row) => {
          const value = getValue ? getValue(row) : row[column]
          return Array.isArray(value) ? value : [value]
        })
        .map(getStringValue)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b))
}

function makeFilterFn<TData extends Record<string, unknown>>(filter: DataTableFilter<TData>) {
  return (row: Row<TData>, columnId: string, filterValue: unknown) => {
    const selectedValues = Array.isArray(filterValue) ? filterValue : []
    if (!selectedValues.length) return true

    const rowValue = filter.getValue ? filter.getValue(row.original) : row.getValue(columnId)
    const rowValues = Array.isArray(rowValue) ? rowValue.map(getStringValue) : [getStringValue(rowValue)]
    return selectedValues.some((value) => rowValues.includes(value))
  }
}

function getTableFilterValues<TData extends Record<string, unknown>>(
  columnFilters: ColumnFiltersState,
  filterIdByColumn: Map<string, string>,
) {
  return columnFilters.reduce<Partial<Record<keyof TData & string, string[]>>>((acc, filter) => {
    if (Array.isArray(filter.value) && filter.value.length) {
      const id = filterIdByColumn.get(filter.id) ?? filter.id
      acc[id as keyof TData & string] = filter.value.map(getStringValue)
    }

    return acc
  }, {})
}

function getColumnFilterValues(columnFilters: ColumnFiltersState, columnId: string) {
  const value = columnFilters.find((filter) => filter.id === columnId)?.value
  return Array.isArray(value) ? value.map(getStringValue) : []
}

function getFilterTriggerLabel(label: string, selectedLabels: string[]) {
  return selectedLabels.length > 0 ? `${label}: ${selectedLabels.join(', ')}` : label
}

function getTableSettingsKey(tableKey?: string) {
  return tableKey ? `data_table_settings:${tableKey}` : ''
}

function getColumnClassName(columnId: string) {
  if (columnId !== 'actions') return undefined

  return 'sticky right-0 z-10 bg-inherit shadow-[-8px_0_8px_-8px_rgb(0_0_0_/_0.18)]'
}

function readTableSettings<TData extends Record<string, unknown>>(tableKey?: string): DataTableSettings<TData> {
  const settingsKey = getTableSettingsKey(tableKey)
  if (!settingsKey) return {}

  const settings = getLocalStorage<DataTableSettings<TData>>(settingsKey)
  return settings && typeof settings === 'object' ? settings : {}
}

function parseTableSettingsSort(sort?: string): SortingState {
  if (!sort) return []

  const [id, direction] = sort.split(':')
  if (!id) return []

  return [{ id, desc: direction === SortOrder.desc }]
}

function toColumnFilters<TData extends Record<string, unknown>>(
  filters?: Partial<Record<keyof TData & string, string[]>>,
  tableFilters: DataTableFilter<TData>[] = [],
): ColumnFiltersState {
  if (!filters) return []

  const columnByFilterId = new Map(tableFilters.map((filter) => [filter.id, filter.column]))

  return Object.entries(filters).flatMap(([id, value]) => {
    return Array.isArray(value) && value.length ? [{ id: columnByFilterId.get(id) ?? id, value }] : []
  })
}

function areColumnFiltersEqual(left: ColumnFiltersState, right: ColumnFiltersState) {
  if (left.length !== right.length) return false

  return left.every((filter, index) => {
    const otherFilter = right[index]
    const values = Array.isArray(filter.value) ? filter.value.map(getStringValue) : []
    const otherValues = Array.isArray(otherFilter?.value) ? otherFilter.value.map(getStringValue) : []

    return filter.id === otherFilter?.id && values.join('\u0000') === otherValues.join('\u0000')
  })
}

function areSortingStatesEqual(left: SortingState, right: SortingState) {
  if (left.length !== right.length) return false

  return left.every((sort, index) => {
    const otherSort = right[index]
    return sort.id === otherSort?.id && sort.desc === otherSort.desc
  })
}

function areTableFiltersEqual<TData extends Record<string, unknown>>(
  left: DataTableState<TData>['filters'],
  right: DataTableState<TData>['filters'],
) {
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  if (leftKeys.join('\u0000') !== rightKeys.join('\u0000')) return false

  return leftKeys.every((key) => {
    const leftValues = left[key as keyof TData & string] ?? []
    const rightValues = right[key as keyof TData & string] ?? []

    return leftValues.map(getStringValue).join('\u0000') === rightValues.map(getStringValue).join('\u0000')
  })
}

function areDataTableStatesEqual<TData extends Record<string, unknown>>(
  left: DataTableState<TData>,
  right: DataTableState<TData>,
) {
  return (
    left.search === right.search &&
    left.pagination.pageIndex === right.pagination.pageIndex &&
    left.pagination.pageSize === right.pagination.pageSize &&
    areSortingStatesEqual(left.sorting, right.sorting) &&
    areTableFiltersEqual(left.filters, right.filters)
  )
}

function BaseDataTable<TData extends Record<string, unknown>>({
  tableData,
  columns,
  filters = [],
  getCommands,
  getRowCommands,
  primaryCommand,
  command,
  searchPlaceholder = 'Search...',
  toolbarExtra,
  searchColumns,
  pageSize = DEFAULT_PAGE_SIZE,
  loadingMessage = 'Loading...',
  emptyMessage = 'No results',
  emptyAction,
  errorMessage,
  getRowId,
  getRowCanSelect,
  className,
  isLoading = false,
  manual = false,
  itemsCount,
  pageCount,
  onStateChange,
  onSelectedDataChange,
  initialSelectedIds,
  selectionMode = 'multiple',
  disabledSelection = false,
  customizeColumns = true,
  perPageOptions = true,
  tableKey,
  title,
  showTotalCount = false,
  showToolbar = true,
  showPagination = true,
  initialFilters,
  syncQueryParams = Boolean(tableKey?.endsWith('.root')),
  onRowClick,
  getRowClassName,
}: DataTableBaseProps<TData>) {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsString = searchParams.toString()
  const shouldSyncQueryParams = Boolean(syncQueryParams && tableKey)
  const initialQueryState = React.useMemo(() => {
    const currentSearchParams = new URLSearchParams(searchParamsString)
    return shouldSyncQueryParams && hasTableQueryParams(currentSearchParams)
      ? parseTableQueryParams<TData>(currentSearchParams)
      : undefined
  }, [searchParamsString, shouldSyncQueryParams])
  const initialSettings = React.useMemo<DataTableSettings<TData>>(
    () => (initialQueryState ? { ...initialQueryState } : readTableSettings<TData>(tableKey)),
    [initialQueryState, tableKey],
  )
  const initialColumnFilters = React.useMemo<Partial<Record<keyof TData & string, string[]>>>(
    () =>
      ({ ...(initialSettings.f ?? {}), ...(initialFilters ?? {}) }) as Partial<Record<keyof TData & string, string[]>>,
    [initialFilters, initialSettings.f],
  )
  const [globalFilter, setGlobalFilter] = React.useState(initialSettings.q ?? '')
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(() =>
    toColumnFilters(initialColumnFilters, filters),
  )
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    initialSettings.columnVisibility ?? {},
  )
  const [sorting, setSorting] = React.useState<SortingState>(() => parseTableSettingsSort(initialSettings.sort))
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries((initialSelectedIds ?? []).map((id) => [id, true])),
  )
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialSettings.s ?? pageSize,
  })
  const selectionDragValueRef = React.useRef<boolean | null>(null)
  const selectionAnchorRowIdRef = React.useRef<string | null>(null)
  const shiftSelectionRef = React.useRef(false)
  const skipNextSelectionChangeRowIdRef = React.useRef<string | null>(null)
  const tableRef = React.useRef<TanStackTable<TData> | null>(null)
  const hadTableQueryParamsRef = React.useRef(hasTableQueryParams(searchParams))
  const suppressNextQueryParamsWriteRef = React.useRef(false)
  const filterIdByColumn = React.useMemo(() => new Map(filters.map((filter) => [filter.column, filter.id])), [filters])
  const tableQueryState = React.useMemo(
    () =>
      getTableQueryState({
        pagination,
        sorting,
        search: globalFilter,
        filters: getTableFilterValues<TData>(columnFilters, filterIdByColumn),
      }),
    [columnFilters, filterIdByColumn, globalFilter, pagination, sorting],
  )

  React.useEffect(() => {
    function stopSelectionDrag() {
      selectionDragValueRef.current = null
    }

    window.addEventListener('pointerup', stopSelectionDrag)
    window.addEventListener('pointercancel', stopSelectionDrag)

    return () => {
      window.removeEventListener('pointerup', stopSelectionDrag)
      window.removeEventListener('pointercancel', stopSelectionDrag)
    }
  }, [])

  const startSelectionDrag = React.useCallback((row: Row<TData>, isRangeSelection: boolean) => {
    const nextSelected = !row.getIsSelected()

    selectionDragValueRef.current = nextSelected

    if (isRangeSelection) return

    row.toggleSelected(nextSelected)
    selectionAnchorRowIdRef.current = row.id
  }, [])

  const applySelectionDrag = React.useCallback((row: Row<TData>) => {
    const nextSelected = selectionDragValueRef.current

    if (nextSelected === null || row.getIsSelected() === nextSelected) return

    row.toggleSelected(nextSelected)
  }, [])

  const handleRowSelectionChange = React.useCallback(
    (row: Row<TData>, value: boolean) => {
      if (!row.getCanSelect()) return

      if (selectionMode === 'single') {
        setRowSelection(value ? { [row.id]: true } : {})
        selectionAnchorRowIdRef.current = value ? row.id : null
        return
      }

      if (skipNextSelectionChangeRowIdRef.current === row.id) {
        skipNextSelectionChangeRowIdRef.current = null
        return
      }

      const rows = tableRef.current?.getRowModel().rows ?? []
      const anchorRowId = selectionAnchorRowIdRef.current

      if (shiftSelectionRef.current && anchorRowId) {
        const anchorIndex = rows.findIndex((item) => item.id === anchorRowId)
        const rowIndex = rows.findIndex((item) => item.id === row.id)

        if (anchorIndex !== -1 && rowIndex !== -1) {
          const startIndex = Math.min(anchorIndex, rowIndex)
          const endIndex = Math.max(anchorIndex, rowIndex)

          rows.slice(startIndex, endIndex + 1).forEach((item) => item.toggleSelected(value))
          selectionAnchorRowIdRef.current = row.id
          return
        }
      }

      row.toggleSelected(value)
      selectionAnchorRowIdRef.current = row.id
    },
    [selectionMode],
  )

  const tableColumns = React.useMemo<ColumnDef<TData>[]>(() => {
    const activeColumns = columns?.length ? columns : buildColumns(tableData)
    const filterColumns = new Map(filters.map((filter) => [filter.column, filter]))

    const cols: ColumnDef<TData>[] = []

    if (!disabledSelection) {
      cols.push({
        id: 'select',
        header: ({ table }) =>
          selectionMode === 'single' ? null : (
            <Checkbox
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
            />
          ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onCheckedChange={(value) => handleRowSelectionChange(row, !!value)}
            onKeyDown={(event) => {
              shiftSelectionRef.current = event.shiftKey
            }}
            onKeyUp={() => {
              shiftSelectionRef.current = false
            }}
            onPointerDown={(event) => {
              if (selectionMode === 'single') return

              shiftSelectionRef.current = event.shiftKey
              skipNextSelectionChangeRowIdRef.current = event.shiftKey ? null : row.id
              startSelectionDrag(row, event.shiftKey)
            }}
            onPointerEnter={() => {
              if (selectionMode === 'multiple') applySelectionDrag(row)
            }}
            aria-label="Select row"
            className="select-none"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 36,
      })
    }

    cols.push(
      ...activeColumns.map((column) => {
        const id = column.id ?? ('accessorKey' in column ? String(column.accessorKey) : undefined)
        const filter = id ? filterColumns.get(id) : undefined
        return filter ? { ...column, filterFn: makeFilterFn(filter) } : column
      }),
    )

    if (getRowCommands) {
      cols.push({
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const rowCommands = getRowCommands(row.original)

          if (!rowCommands.length) return null

          return (
            <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
              <DropdownActionsMenu
                items={rowCommands}
                align="end"
                triggerRender={
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Row actions" />
                }
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} size={16} strokeWidth={1} />
              </DropdownActionsMenu>
            </div>
          )
        },
        enableSorting: false,
        enableHiding: false,
        size: 44,
      })
    }

    return cols
  }, [
    applySelectionDrag,
    columns,
    disabledSelection,
    filters,
    getRowCommands,
    handleRowSelectionChange,
    selectionMode,
    startSelectionDrag,
    tableData,
  ])

  const activeSearchColumns = React.useMemo(() => {
    if (searchColumns?.length) return searchColumns

    return tableColumns
      .map((column) => column.id ?? ('accessorKey' in column ? String(column.accessorKey) : undefined))
      .filter((id): id is keyof TData & string => Boolean(id) && id !== 'select')
  }, [searchColumns, tableColumns])

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    state: {
      columnVisibility,
      columnFilters,
      globalFilter,
      pagination,
      rowSelection,
      sorting,
    },
    pageCount: manual ? (pageCount ?? -1) : undefined,
    rowCount: manual ? itemsCount : undefined,
    manualFiltering: manual,
    manualPagination: manual,
    manualSorting: manual,
    getRowId: getRowId ?? ((row, index) => getStringValue(row.id) || String(index)),
    enableRowSelection: disabledSelection ? false : (row) => getRowCanSelect?.(row.original) ?? true,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      setSorting(updater)
      setPagination((current) => ({ ...current, pageIndex: 0 }))
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = getStringValue(filterValue).trim().toLowerCase()
      if (!query) return true

      return activeSearchColumns.some((column) => getStringValue(row.original[column]).toLowerCase().includes(query))
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: manual ? undefined : getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: manual ? undefined : getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
  })
  tableRef.current = table

  React.useEffect(() => {
    const nextPageSize = initialSettings.s ?? pageSize
    setPagination((current) => (current.pageSize === nextPageSize ? current : { ...current, pageSize: nextPageSize }))
  }, [initialSettings.s, pageSize])

  React.useEffect(() => {
    onStateChange?.({
      pagination,
      sorting,
      search: globalFilter,
      filters: getTableFilterValues<TData>(columnFilters, filterIdByColumn),
    })
  }, [columnFilters, filterIdByColumn, globalFilter, onStateChange, pagination, sorting])

  React.useEffect(() => {
    if (!shouldSyncQueryParams) return
    const currentSearchParams = new URLSearchParams(searchParamsString)
    const hasQueryParams = hasTableQueryParams(currentSearchParams)

    if (!hasQueryParams) {
      if (!hadTableQueryParamsRef.current) return

      hadTableQueryParamsRef.current = false
      suppressNextQueryParamsWriteRef.current = true
      setGlobalFilter((current) => (current ? '' : current))
      setColumnFilters((current) => {
        const nextFilters = toColumnFilters(initialFilters, filters)
        return areColumnFiltersEqual(current, nextFilters) ? current : nextFilters
      })
      setSorting((current) => (current.length ? [] : current))
      setPagination((current) =>
        current.pageIndex === 0 && current.pageSize === pageSize ? current : { pageIndex: 0, pageSize },
      )
      return
    }

    hadTableQueryParamsRef.current = true

    const nextState = getInitialDataTableState<TData>({
      tableKey,
      pageSize,
      initialFilters,
      queryState: parseTableQueryParams<TData>(currentSearchParams),
    })

    setGlobalFilter((current) => (current === nextState.search ? current : nextState.search))
    setColumnFilters((current) => {
      const nextFilters = toColumnFilters(nextState.filters, filters)
      return areColumnFiltersEqual(current, nextFilters) ? current : nextFilters
    })
    setSorting((current) => (areSortingStatesEqual(current, nextState.sorting) ? current : nextState.sorting))
    setPagination((current) =>
      current.pageIndex === nextState.pagination.pageIndex && current.pageSize === nextState.pagination.pageSize
        ? current
        : nextState.pagination,
    )
  }, [filters, initialFilters, pageSize, searchParamsString, shouldSyncQueryParams, tableKey])

  React.useEffect(() => {
    const settingsKey = getTableSettingsKey(tableKey)
    if (!settingsKey) return
    const filteredColumnVisibility = Object.fromEntries(
      Object.entries(columnVisibility).filter(([, isVisible]) => !isVisible),
    ) as VisibilityState
    const settings: DataTableSettings<TData> = {
      ...tableQueryState,
      columnVisibility: Object.keys(filteredColumnVisibility).length ? filteredColumnVisibility : undefined,
    }

    if (settings.p === 1) delete settings.p
    if (settings.s === pageSize) delete settings.s

    const hasSettings = Object.values(settings).some((value) => value !== undefined)
    if (hasSettings) {
      setLocalStorage<DataTableSettings<TData>>(settingsKey, settings)
    } else {
      removeLocalStorage(settingsKey)
    }
  }, [columnVisibility, pageSize, tableKey, tableQueryState])

  React.useEffect(() => {
    if (!shouldSyncQueryParams) return
    if (suppressNextQueryParamsWriteRef.current) {
      suppressNextQueryParamsWriteRef.current = false
      return
    }

    const currentSearchParams = new URLSearchParams(searchParamsString)
    const nextParams = writeTableQueryParams(currentSearchParams, tableQueryState, { defaultPageSize: pageSize })
    if (nextParams.toString() === searchParamsString) return

    hadTableQueryParamsRef.current = hasTableQueryParams(nextParams)
    setSearchParams(nextParams, { replace: true })
  }, [pageSize, searchParamsString, setSearchParams, shouldSyncQueryParams, tableQueryState])

  const totalRows = manual ? (itemsCount ?? 0) : table.getFilteredRowModel().rows.length
  const selectedRowsCount = table.getSelectedRowModel().rows.length
  const firstVisibleRow = totalRows ? pagination.pageIndex * pagination.pageSize + 1 : 0
  const lastVisibleRow = Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalRows)
  const activeFiltersCount = columnFilters.reduce((count, filter) => {
    return count + (Array.isArray(filter.value) ? filter.value.length : Number(Boolean(filter.value)))
  }, 0)
  const commands = getCommands?.(table.getSelectedRowModel().rows.map((row) => row.original)) ?? []

  function toggleFilter(
    columnId: string,
    value: string,
    checked: boolean,
    selectionMode: 'single' | 'multiple' = 'multiple',
  ) {
    setColumnFilters((currentFilters) => {
      const currentValues = getColumnFilterValues(currentFilters, columnId)
      const nextValues =
        selectionMode === 'single'
          ? checked
            ? [value]
            : []
          : checked
            ? Array.from(new Set([...currentValues, value]))
            : currentValues.filter((item) => item !== value)
      const nextFilters = currentFilters.filter((filter) => filter.id !== columnId)

      return nextValues.length ? [...nextFilters, { id: columnId, value: nextValues }] : nextFilters
    })
    table.setPageIndex(0)
  }

  function getSelectedData() {
    const selectedRowIds = new Set(
      Object.keys(table.getState().rowSelection).filter((id) => table.getState().rowSelection[id]),
    )
    return table
      .getRowModel()
      .rows.filter((row) => selectedRowIds.has(row.id))
      .map((row) => row.original)
  }

  React.useEffect(() => {
    onSelectedDataChange?.(getSelectedData())
  }, [onSelectedDataChange, rowSelection])

  function resetFilters() {
    setGlobalFilter('')
    setColumnFilters([])
    table.setPageIndex(0)
  }

  async function disableSelections() {
    const count = table.getSelectedRowModel().rows.length
    Modals.confirm({
      operation: `clear ${count} selected row(s)`,
      onOk: async () => {
        table.toggleAllRowsSelected(false)
      },
    })
  }

  return (
    <div className={cn('@container space-y-3', className)}>
      {showToolbar ? (
        <div className="flex flex-col gap-3 @xl:flex-row @xl:items-stretch @xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 @5xl:flex-row @5xl:items-stretch">
            <SearchInput
              value={globalFilter}
              onChange={(event) => {
                setGlobalFilter(event.target.value)
                table.setPageIndex(0)
              }}
              placeholder={searchPlaceholder}
              containerClassName="w-full max-w-100 min-w-60"
            />
            {toolbarExtra && <div className="flex items-center">{toolbarExtra}</div>}
            {filters.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-foreground">Filter by:</span>
                {filters.map((filter) => {
                  const selectedValues = getColumnFilterValues(columnFilters, filter.column)

                  if (filter.queryFn) {
                    return (
                      <AsyncFilterDropdown
                        key={filter.id}
                        filter={
                          filter as DataTableFilter<TData> & { queryFn: NonNullable<DataTableFilter<TData>['queryFn']> }
                        }
                        selectedValues={selectedValues}
                        onToggle={(id, checked) =>
                          toggleFilter(filter.column, id, checked, filter.selectionMode ?? 'multiple')
                        }
                      />
                    )
                  }

                  const options = getFilterOptions(tableData, filter)
                  const triggerLabel = getFilterTriggerLabel(filter.label, selectedValues)
                  return (
                    <DropdownActionsMenu
                      key={filter.id}
                      items={options.map((option) => ({
                        type: 'checkbox',
                        label: option,
                        checked: selectedValues.includes(option),
                        onCheckedChange: (checked) =>
                          toggleFilter(filter.column, option, Boolean(checked), filter.selectionMode ?? 'multiple'),
                      }))}
                      align="start"
                      contentClassName="w-48"
                      triggerRender={<Button variant="outline" className="h-9" />}
                    >
                      {triggerLabel}
                    </DropdownActionsMenu>
                  )
                })}
                <DropdownActionsMenu items={[]} align="start" triggerRender={<Button variant="outline" size="lg" />}>
                  <HugeiconsIcon icon={FilterHorizontalIcon} strokeWidth={2} data-icon="inline-start" />
                </DropdownActionsMenu>

                {globalFilter || activeFiltersCount ? (
                  <Button
                    variant="ghost"
                    className="h-9 px-2 text-muted-foreground"
                    disabled={!globalFilter && !activeFiltersCount}
                    onClick={resetFilters}
                  >
                    Reset
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex flex-row items-center justify-between gap-3 @xl:items-end @xl:justify-end">
            {customizeColumns && (
              <DropdownActionsMenu
                items={table
                  .getAllColumns()
                  .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide())
                  .map((column) => ({
                    type: 'checkbox',
                    label: column.columnDef.header as string,
                    checked: column.getIsVisible(),
                    onCheckedChange: (value) => column.toggleVisibility(!!value),
                    className: 'capitalize',
                  }))}
                align="end"
                contentClassName="w-32"
                triggerRender={<Button variant="outline" className="h-9" />}
              >
                <HugeiconsIcon icon={LeftToRightListBulletIcon} strokeWidth={2} data-icon="inline-start" />
              </DropdownActionsMenu>
            )}

            {primaryCommand ? (
              <Button
                variant={primaryCommand.variant === 'destructive' ? 'destructive' : 'outline'}
                size="lg"
                disabled={primaryCommand.disabled}
                onClick={() => primaryCommand.onClick(getSelectedData())}
              >
                {primaryCommand.label}
              </Button>
            ) : null}

            {command ? (
              <Button
                variant={command.variant === 'destructive' ? 'destructive' : 'outline'}
                size="lg"
                disabled={command.disabled}
                onClick={() => command.onClick(getSelectedData())}
              >
                {command.label}
              </Button>
            ) : commands.length ? (
              <DropdownActionsMenu
                items={commands.map((command) => ({
                  ...command,
                  onClick: () => command.onClick(getSelectedData()),
                }))}
                align="end"
                triggerRender={<Button variant="outline" size="lg" />}
                showChevron
              >
                Commands
              </DropdownActionsMenu>
            ) : null}
          </div>
        </div>
      ) : null}

      {title || showTotalCount ? (
        <div className="flex items-center justify-between gap-3">
          {title ? <div className="text-h4 font-semibold">{title}</div> : <span />}
          {showTotalCount ? (
            <div className="text-sm text-foreground">
              {totalRows} item{totalRows === 1 ? '' : 's'}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortDirection = header.column.getIsSorted()

                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className={getColumnClassName(header.column.id)}
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1 text-left font-medium disabled:cursor-default"
                          disabled={!header.column.getCanSort() && header.column.id !== 'select'}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDirection === SortOrder.asc ? (
                            <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} size={14} />
                          ) : null}
                          {sortDirection === SortOrder.desc ? (
                            <HugeiconsIcon icon={ArrowDown02Icon} strokeWidth={2} size={14} />
                          ) : null}
                        </button>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    onRowClick && 'cursor-pointer',
                    !disabledSelection && !row.getCanSelect() && 'cursor-not-allowed opacity-45',
                    getRowClassName?.(row.original),
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={getColumnClassName(cell.column.id)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                {errorMessage ? (
                  <TableError message={errorMessage} colSpan={tableColumns.length} />
                ) : isLoading ? (
                  <TableSpinner message={loadingMessage} colSpan={tableColumns.length} />
                ) : (
                  <TableEmpty message={emptyMessage} action={emptyAction} colSpan={tableColumns.length} />
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
        {isLoading ? <div className="absolute inset-0 bg-background/50" /> : null}
      </div>

      {showPagination ? (
        <div className="flex flex-col items-stretch justify-between gap-2 @md:flex-row @md:items-center">
          <div className="flex flex-1 flex-col-reverse items-center justify-between gap-2 @md:flex-row">
            {perPageOptions && (
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
                items={PER_PAGE_OPTIONS.map((pageSize) => ({
                  label: `${pageSize}`,
                  value: `${pageSize}`,
                }))}
              >
                <SelectTrigger size="sm" className="w-16" id="rows-per-page">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectGroup>
                    {PER_PAGE_OPTIONS.map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            {selectedRowsCount > 0 ? (
              <div className="flex-1 lg:flex">
                <span className="cursor-pointer text-sm text-muted-foreground" onClick={disableSelections}>
                  {selectedRowsCount} row(s) selected
                </span>
              </div>
            ) : null}
          </div>
          <div className="text-center text-sm text-foreground">
            {firstVisibleRow}-{lastVisibleRow} of {totalRows}
          </div>
          <TablePagination
            className="flex-1 @md:flex-0"
            pageIndex={pagination.pageIndex}
            pageCount={table.getPageCount()}
            canPreviousPage={table.getCanPreviousPage()}
            canNextPage={table.getCanNextPage()}
            onPreviousPage={() => table.previousPage()}
            onNextPage={() => table.nextPage()}
            onPageChange={(pageIndex) => table.setPageIndex(pageIndex)}
          />
        </div>
      ) : null}
    </div>
  )
}

function AsyncFilterDropdown<TData extends Record<string, unknown>>({
  filter,
  selectedValues,
  onToggle,
}: {
  filter: DataTableFilter<TData> & { queryFn: NonNullable<DataTableFilter<TData>['queryFn']> }
  selectedValues: string[]
  onToggle: (value: string, checked: boolean) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [optionLabelsById, setOptionLabelsById] = React.useState<Record<string, string>>({})
  const listRef = React.useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['filter-options', filter.id, search],
    queryFn: ({ pageParam }) => filter.queryFn(search, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, p) => sum + p.items.length, 0)
      return loaded < lastPage.total ? pages.length + 1 : undefined
    },
    enabled: open,
    staleTime: 60_000,
  })

  const options = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0
  const selectedLabels = selectedValues.map((value) => {
    return optionLabelsById[value] ?? options.find((option) => option.id === value)?.label ?? value
  })

  function handleOptionToggle(option: { id: string; label: string }, checked: boolean) {
    if (checked && optionLabelsById[option.id] !== option.label) {
      setOptionLabelsById((current) => ({ ...current, [option.id]: option.label }))
    }
    onToggle(option.id, checked)
  }

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
      if (nearBottom && hasNextPage && !isFetchingNextPage) fetchNextPage()
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="h-9 max-w-64">
            <span className="truncate">{getFilterTriggerLabel(filter.label, selectedLabels)}</span>
          </Button>
        }
      />
      <PopoverContent className="w-56 p-0" align="start">
        <div className="border-b p-2">
          <SearchInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
            }}
            placeholder="Search..."
            containerClassName="w-full"
          />
        </div>
        <div ref={listRef} className="max-h-52 overflow-y-auto p-1" onScroll={handleScroll}>
          {isLoading && <div className="py-3 text-center text-sm text-muted-foreground">Loading...</div>}
          {!isLoading && options.length === 0 && (
            <div className="py-3 text-center text-sm text-muted-foreground">No results</div>
          )}
          {options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={selectedValues.includes(option.id)}
                onCheckedChange={(checked) => handleOptionToggle(option, Boolean(checked))}
              />
              <span className="truncate">{option.label}</span>
            </label>
          ))}
          {isFetchingNextPage && <div className="py-2 text-center text-xs text-muted-foreground">Loading more…</div>}
          {!isLoading && options.length > 0 && (
            <div className="px-2 py-1 text-[10px] text-muted-foreground">
              {options.length} / {total}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function DataTable<TData extends Record<string, unknown>>({ tableData, data, ...props }: DataTableProps<TData>) {
  return <BaseDataTable tableData={tableData ?? data ?? []} {...props} />
}

export function DataTableAsync<TData extends Record<string, unknown>>({
  queryKey,
  loadData,
  loadingMessage,
  emptyMessage,
  errorMessage = 'Failed to load data.',
  ...props
}: DataTableAsyncProps<TData>) {
  const initialTableState = React.useMemo(
    () =>
      getInitialDataTableState<TData>({
        tableKey: props.tableKey,
        pageSize: props.pageSize,
        initialFilters: props.initialFilters,
      }),
    [props.initialFilters, props.pageSize, props.tableKey],
  )
  const [tableState, setTableState] = React.useState<DataTableState<TData>>(initialTableState)
  const handleStateChange = React.useCallback((nextState: DataTableState<TData>) => {
    setTableState((currentState) => (areDataTableStatesEqual(currentState, nextState) ? currentState : nextState))
  }, [])

  const query = useQuery({
    queryKey: [...queryKey, getTableQueryState(tableState)],
    queryFn: () => loadData(tableState),
    placeholderData: (previousData) => previousData,
    refetchOnMount: props.refetchOnMount,
    refetchInterval: props.refetchInterval,
  })

  return (
    <BaseDataTable
      {...props}
      tableData={query.data?.items ?? []}
      manual
      isLoading={query.isFetching}
      itemsCount={query.data?.count ?? 0}
      pageCount={query.data?.pageCount ?? 0}
      loadingMessage={loadingMessage}
      emptyMessage={emptyMessage}
      errorMessage={query.isError ? errorMessage : undefined}
      onStateChange={handleStateChange}
    />
  )
}

function InfoCell({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <TableCell colSpan={colSpan} className="h-24 text-center">
      {children}
    </TableCell>
  )
}

function TableSpinner({ message, colSpan }: { message?: string; colSpan: number }) {
  return (
    <InfoCell colSpan={colSpan}>
      <div className="flex h-24 items-center justify-center">
        <Spinner />
        {message && <span className="ml-2">{message}</span>}
      </div>
    </InfoCell>
  )
}

function TableError({ message, colSpan }: { message: string; colSpan: number }) {
  return (
    <InfoCell colSpan={colSpan}>
      <div className="flex h-24 items-center justify-center text-destructive">{message}</div>
    </InfoCell>
  )
}

function TableEmpty({
  message,
  action,
  colSpan,
}: {
  message: string
  action?: {
    name: string
    onClick: () => void
  } & VariantProps<typeof buttonVariants>
  colSpan: number
}) {
  return (
    <InfoCell colSpan={colSpan}>
      <EmptyBlock title={message} button={action} />
    </InfoCell>
  )
}
