import FilterHorizontalIcon from '@hugeicons/core-free-icons/FilterHorizontalIcon'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@/components/ui/button'
import { DropdownActionsMenu } from '@/components/ui/dropdown-menu'
import type { FilterMetadata } from '@/lib/api-types'

type FilterBarProps = {
  filterMetadata: FilterMetadata[]
  filterKeys: Record<string, boolean>
  keyLabels: Record<string, string>
  values: Record<string, string[]>
  onChange: (key: string, values: string[]) => void
  onFilterKeysChange: (keys: Record<string, boolean>) => void
  onReset: () => void
  showLabel?: boolean
  hasActiveFilters?: boolean
  children?: React.ReactNode
}

function toggleValue(current: string[], value: string, checked: boolean, multiple: boolean): string[] {
  if (multiple) {
    return checked ? [...current, value] : current.filter((v) => v !== value)
  }
  return checked ? [value] : []
}

export function FilterBar({
  filterMetadata,
  filterKeys,
  keyLabels,
  values,
  onChange,
  onFilterKeysChange,
  onReset,
  showLabel = false,
  hasActiveFilters,
  children,
}: FilterBarProps) {
  const settingsItems = Object.entries(filterKeys).map(([key, enabled]) => ({
    type: 'checkbox' as const,
    label: keyLabels[key] ?? key,
    checked: enabled,
    onCheckedChange: (checked: boolean) =>
      onFilterKeysChange({ ...filterKeys, [key]: Boolean(checked) }),
  }))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showLabel && <span className="text-sm text-foreground">Filter by:</span>}

      {filterMetadata.map((meta) => {
        const selected = values[meta.key] ?? []

        return (
          <DropdownActionsMenu
            key={meta.key}
            items={meta.items.map((item) => ({
              type: 'checkbox' as const,
              label: item.label,
              checked: selected.includes(item.value),
              onCheckedChange: (checked) =>
                onChange(meta.key, toggleValue(selected, item.value, Boolean(checked), meta.multiple)),
            }))}
            align="start"
            contentClassName="w-48"
            triggerRender={<Button variant="outline" className="h-9" />}
          >
            {meta.label}
            {selected.length > 0 ? ` (${selected.length})` : null}
          </DropdownActionsMenu>
        )
      })}

      {children}

      <DropdownActionsMenu
        items={settingsItems}
        align="start"
        contentClassName="w-48"
        triggerRender={<Button variant="outline" size="lg" />}
      >
        <HugeiconsIcon icon={FilterHorizontalIcon} strokeWidth={2} data-icon="inline-start" />
      </DropdownActionsMenu>

      {hasActiveFilters ? (
        <Button variant="ghost" className="h-9 px-2 text-muted-foreground" onClick={onReset}>
          Reset
        </Button>
      ) : null}
    </div>
  )
}
