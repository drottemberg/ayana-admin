import type { Customer } from '@/types/customer'

export type Media = {
  id: string
  name: string
  status?: string | null
  type?: string | null
  customer?: Pick<Customer, 'id' | 'name'> | null
  tags: string[]
  fileName: string
  fileUrl: string
  mimeType: string
  sizeBytes: number
  durationSeconds?: number
  width?: number
  height?: number
  aspectRatio?: string
  hasSound?: boolean
  thumbnailUrl?: string | null
  createdAt: string
  updatedAt?: string
}

export type MediaCampaign = {
  id: string
  customerId?: string | null
  customer?: Pick<Customer, 'id' | 'name'> | null
  name: string
  status?: string | null
  priority?: number | null
  startAt?: string | null
  endAt?: string | null
  isArchived?: boolean
  isDeleted?: boolean
  createdAt?: string | null
  updatedAt?: string | null
}

export type MediaCampaignDevice = {
  campaignId: string
  deviceId: string
  syncStatus?: string | null
  progress?: number | null
  syncedAt?: string | null
  failedAt?: string | null
  failureReason?: string | null
  assignedAt?: string | null
  assignedBy?: string | null
}

export type CreateMediaCampaignPayload = {
  customerId: string
  name: string
  priority?: number
  startAt: string
  endAt?: string
  deviceIds?: string[]
  mediaIds?: string[]
}

export type UpdateMediaCampaignPayload = Partial<
  Pick<CreateMediaCampaignPayload, 'name' | 'priority' | 'startAt' | 'endAt'>
>

export type CreateMediaPayload = {
  name: string
  customerId?: string
  tags?: string[]
  file?: File
  hasSound?: boolean
}

export type UpdateMediaPayload = Omit<CreateMediaPayload, 'file'> & {
  thumbnailFile?: File
}