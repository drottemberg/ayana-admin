import Calendar03Icon from '@hugeicons/core-free-icons/Calendar03Icon'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { FilterBar } from '@/components/ui/filter-bar'
import type { FilterMetadata } from '@/lib/api-types'
import type { DataReportComparison, DataReportFilters } from '@/types/data-report'

export const DATA_REPORT_FILTER_KEYS: Record<string, boolean> = {
  deviceIds: true,
  contractIds: true,
  customerIds: true,
  deviceTypeIds: true,
}

const KEY_LABELS: Record<string, string> = {
  deviceIds: 'Device list',
  contractIds: 'Contract',
  customerIds: 'Customer',
  deviceTypeIds: 'Device type',
}

type DataReportFiltersProps = {
  filters: DataReportFilters
  filterMetadata: FilterMetadata[]
  filterKeys: Record<string, boolean>
  comparisonOptions: DataReportComparison[]
  onFiltersChange: (filters: DataReportFilters) => void
  onFilterKeysChange: (keys: Record<string, boolean>) => void
  onReset: () => void
}

function toFilterValues(filters: DataReportFilters): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const [key, val] of Object.entries(filters)) {
    if (Array.isArray(val) && val.length > 0) result[key] = val as string[]
  }
  return result
}

function applyFilterChange(
  filters: DataReportFilters,
  key: string,
  values: string[],
): DataReportFilters {
  const next = { ...(filters as Record<string, unknown>) }
  if (values.length === 0) {
    delete next[key]
  } else {
    next[key] = values
  }
  return next as DataReportFilters
}

function toggleComparison(filters: DataReportFilters, comparison: DataReportComparison): DataReportFilters {
  const current = filters.comparison ?? []
  const exists = current.some((item) => item.id === comparison.id)
  const next = exists ? current.filter((item) => item.id !== comparison.id) : [...current, comparison]
  return { ...filters, comparison: next.length ? next : undefined }
}


export function DataReportFiltersBar({
  filters,
  filterMetadata,
  filterKeys,
  comparisonOptions,
  onFiltersChange,
  onFilterKeysChange,
  onReset,
}: DataReportFiltersProps) {
  const filterValues = toFilterValues(filters)
  const hasActiveFilters = Object.keys(filterValues).length > 0 || Boolean(filters.period)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <FilterBar
          filterMetadata={filterMetadata}
          filterKeys={filterKeys}
          keyLabels={KEY_LABELS}
          values={filterValues}
          onChange={(key, values) => onFiltersChange(applyFilterChange(filters, key, values))}
          onFilterKeysChange={onFilterKeysChange}
          onReset={onReset}
          hasActiveFilters={hasActiveFilters}
        >
          <DateRangePicker
            value={filters.period}
            placeholder="Period"
            onValueChange={(period) => onFiltersChange({ ...filters, period })}
          />
        </FilterBar>
        <Button
          variant="outline"
          className="h-9 shrink-0"
          onClick={() => {
            const next = comparisonOptions.find(
              (option) => !(filters.comparison ?? []).some((c) => c.id === option.id),
            )
            if (next) onFiltersChange(toggleComparison(filters, next))
          }}
        >
          Add comparison
        </Button>
      </div>

      {filters.comparison?.length ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
            Comparisons
          </span>
          {filters.comparison.map((comparison) => (
            <Button
              key={comparison.id}
              variant="outline"
              size="xs"
              onClick={() => onFiltersChange(toggleComparison(filters, comparison))}
            >
              {comparison.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
