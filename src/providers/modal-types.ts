import type { ComponentProps, ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'

import type { Button } from '@/components/ui/button'
import type { DataTableAsyncResult, DataTableFilter, DataTableState } from '@/components/data-table'
import { ModalId } from '@/providers/modal-ids'
import type { MediaPreviewModalProps } from '@/features/media/components/MediaPreviewModal'
import type { Issue } from '@/types/issue'

export type SelectTableRow = Record<string, unknown>

type BaseModalDialogOptions = {
  title?: string
  content?: ReactNode
  okText?: string
  cancelText?: string
  okButtonProps?: ComponentProps<typeof Button>
  cancelButtonProps?: ComponentProps<typeof Button>
  onOk?: () => Promise<void> | void
  onCancel?: () => Promise<void> | void
}

export type AlertModalDialogOptions = BaseModalDialogOptions & {
  title: string
}

export type ConfirmModalDialogOptions = BaseModalDialogOptions & {
  operation?: string
}

export type AddCommentModalProps = {
  deviceId?: string
}

export type AddInterventionModalProps = {
  deviceId?: string
}

export type IssueResolutionModalProps = {
  issue: Issue
}

export type SelectTableDataModalProps = {
  title: string
  queryKey: readonly unknown[]
  loadData: (state: DataTableState<SelectTableRow>) => Promise<DataTableAsyncResult<SelectTableRow>>
  columns: ColumnDef<SelectTableRow>[]
  filters?: DataTableFilter<SelectTableRow>[]
  searchPlaceholder?: string
  searchColumns?: (keyof SelectTableRow & string)[]
  selectionMode?: 'single' | 'multiple'
  tableKey?: string
  loadingMessage?: string
  emptyMessage?: string
  errorMessage?: string
  submitLabel?: string
  onSelect?: (selectedData: SelectTableRow[]) => Promise<void> | void
  initialSelectedIds?: string[]
  getRowCanSelect?: (row: SelectTableRow) => boolean
}

export type ModalPropsById = {
  [ModalId.AddComment]: AddCommentModalProps
  [ModalId.AddIntervention]: AddInterventionModalProps
  [ModalId.IssueResolution]: IssueResolutionModalProps
  [ModalId.MediaPreview]: MediaPreviewModalProps
  [ModalId.SelectTableData]: SelectTableDataModalProps
}
