import { useCallback, useMemo, useState } from 'react'
import NiceModal from '@ebay/nice-modal-react'

import { BaseModal } from '@/components/modals/BaseModal'
import { DataTableAsync } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import type { SelectTableDataModalProps, SelectTableRow } from '@/providers/modal-types'
import { useModalController } from '@/providers/use-overlay-controller'

const SelectTableDataModal = NiceModal.create<SelectTableDataModalProps>(
  ({
    title,
    queryKey,
    loadData,
    columns,
    filters,
    searchPlaceholder = 'Search by ID, name...',
    searchColumns,
    selectionMode = 'multiple',
    tableKey,
    loadingMessage = 'Loading items...',
    emptyMessage = 'No items found.',
    errorMessage = 'Failed to load items.',
    submitLabel,
    onSelect,
    initialSelectedIds,
    getRowCanSelect,
  }) => {
    const modal = useModalController()
    const [selectedData, setSelectedData] = useState<SelectTableRow[]>([])
    const selectedCount = selectedData.length

    const actionLabel = useMemo(() => {
      if (selectionMode === 'single') return 'Select'
      const label = submitLabel ?? 'Add'

      return selectedCount ? `${label} (${selectedCount})` : label
    }, [selectedCount, selectionMode, submitLabel])

    const handleSubmit = useCallback(async () => {
      if (!selectedData.length) return

      await onSelect?.(selectedData)
      await modal.forceClose(selectedData)
    }, [modal, onSelect, selectedData])

    return (
      <BaseModal
        open={modal.open}
        onOpenChange={modal.onOpenChange}
        onClose={() => modal.requestClose(false)}
        title={title}
        className="sm:max-w-[860px]"
        // headerClassName="p-4"
        // bodyClassName="max-h-[70vh] overflow-y-auto px-4 py-3"
        // footerClassName="p-4"
        footer={
          <>
            <Button variant="outline" onClick={() => modal.requestClose(false)}>
              Cancel
            </Button>
            <Button disabled={!selectedData.length} onClick={handleSubmit}>
              {actionLabel}
            </Button>
          </>
        }
      >
        <DataTableAsync<SelectTableRow>
          queryKey={queryKey}
          loadData={loadData}
          tableKey={tableKey}
          columns={columns}
          filters={filters}
          searchPlaceholder={searchPlaceholder}
          searchColumns={searchColumns}
          selectionMode={selectionMode}
          onSelectedDataChange={setSelectedData}
          initialSelectedIds={initialSelectedIds}
          getRowCanSelect={getRowCanSelect}
          loadingMessage={loadingMessage}
          emptyMessage={emptyMessage}
          errorMessage={errorMessage}
          customizeColumns={false}
          perPageOptions={false}
        />
      </BaseModal>
    )
  },
)

export { SelectTableDataModal }
