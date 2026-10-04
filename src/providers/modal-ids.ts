export const ModalId = {
  AddComment: 'add-comment',
  AddIntervention: 'add-intervention',
  IssueResolution: 'issue-resolution',
  MediaPreview: 'media-preview',
  SelectTableData: 'select-table-data',
  Alert: 'alert',
  Confirm: 'confirm',
} as const

export type ModalId = (typeof ModalId)[keyof typeof ModalId]
