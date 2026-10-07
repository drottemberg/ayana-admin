import { apiClient } from '@/lib/api-client'
import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { toApiListDto, toDataTableResult, type ApiListResult } from '@/lib/api-types'

export type BroadcastActivity = 'ALL' | 'CLASS_BOOKING' | 'PRODUCT_PURCHASE' | 'BOTH'

export type BroadcastAudienceFilters = {
  locationIds: string[]
  activity: BroadcastActivity
}

export type BroadcastChannel = 'WHATSAPP' | 'TELEGRAM' | 'EMAIL'

export type ApprovedWhatsappTemplate = {
  name: string
  language: string
  category: string
  bodyText: string
  bodyParameterCount: number
  headerImage: boolean
}

export type BroadcastRecipient = {
  id: string
  userId: string
  userName: string
  email: string | null
  phone: string | null
  channel: 'WHATSAPP' | 'TELEGRAM'
  channelId: string
  channelLabel: string
  lastContactAt: string
}

export type BroadcastAudience = {
  items: BroadcastRecipient[]
  total: number
  people: number
}

export type BroadcastSendResult = {
  campaignId: string
  inProgress: boolean
  total: number
  channelsTotal: number
  channelsSent: number
  emailsTotal: number
  emailsSent: number
  warnings: Array<{
    recipientId: string
    userName: string
    channel: BroadcastRecipient['channel']
    warning: string
  }>
  failed: Array<{
    recipientId: string
    userName: string
    channel: BroadcastRecipient['channel'] | 'EMAIL'
    sent: false
    error: string
  }>
}

export type BroadcastHistoryItem = Record<string, unknown> & {
  id: string
  customerId: string
  customerName: string | null
  status: 'SENDING' | 'SENT' | 'PARTIAL' | 'FAILED'
  message: string
  media: Array<{ name: string; mimeType: string; size: number; url: string }>
  createdAt: string
  total: number
  counts: Record<string, number>
  filters?: {
    locationIds: string[]
    activity: BroadcastActivity
    channels?: BroadcastChannel[]
    whatsappTemplate?: { name: string; language: string; bodyParameters: string[]; headerImage: boolean } | null
  } | null
}

export type BroadcastDelivery = Record<string, unknown> & {
    id: string
    userId: string
    userChannelId: string | null
    messageId: string | null
    message: { id: string; content: string; createdAt: string } | null
    userChannel: { id: string; channel: 'WHATSAPP' | 'TELEGRAM' | 'WEB'; channelId: string } | null
    recipientName: string
    destination: string
    channel: 'WHATSAPP' | 'TELEGRAM' | 'EMAIL'
    status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
    error: string | null
    sentAt: string | null
    deliveredAt: string | null
    readAt: string | null
    failedAt: string | null
    events: Array<{ status: string; providerMessageId: string | null; occurredAt: string; details: unknown }>
}

export type BroadcastHistoryDetail = BroadcastHistoryItem & {
  filters: {
    locationIds: string[]
    activity: BroadcastActivity
    channels?: BroadcastChannel[]
    whatsappTemplate?: { name: string; language: string; bodyParameters: string[]; headerImage: boolean } | null
  } | null
  deliveries: BroadcastDelivery[]
}

export async function getBroadcastCampaignsRequest(state: DataTableState<BroadcastHistoryItem>): Promise<DataTableAsyncResult<BroadcastHistoryItem>> {
  const result = await apiClient.post<ApiListResult<BroadcastHistoryItem>>(
    '/messaging/broadcast/campaigns/list',
    toApiListDto(state),
  )
  return toDataTableResult(result)
}

export async function getBroadcastCampaignDetailRequest(broadcastId: string): Promise<BroadcastHistoryDetail> {
  return apiClient.get<BroadcastHistoryDetail>(`/messaging/broadcast/campaigns/${broadcastId}`)
}

export async function getBroadcastCustomerOptions(search: string, page = 1) {
  const result = await apiClient.post<ApiListResult<{ id: string; name: string }>>('/customers/list', {
    filters: { contractId: null },
    search: search.trim() || undefined,
    page,
    limit: 20,
    orderBy: 'name',
    order: 'asc',
  })
  return { items: result.items.map((customer) => ({ id: customer.id, label: customer.name })), total: result.total }
}

export async function getCustomerBroadcastHistoryRequest(customerId: string): Promise<BroadcastHistoryItem[]> {
  return apiClient.get<BroadcastHistoryItem[]>(`/messaging/broadcast/customers/${customerId}/history`)
}

export async function getCustomerBroadcastHistoryDetailRequest(customerId: string, broadcastId: string): Promise<BroadcastHistoryDetail> {
  return apiClient.get<BroadcastHistoryDetail>(`/messaging/broadcast/customers/${customerId}/history/${broadcastId}`)
}

export async function getCustomerBroadcastAudienceRequest(
  customerId: string,
  filters: BroadcastAudienceFilters,
): Promise<BroadcastAudience> {
  return apiClient.post<BroadcastAudience>(`/messaging/broadcast/customers/${customerId}/audience`, filters)
}

export async function getApprovedWhatsappTemplatesRequest(customerId: string): Promise<ApprovedWhatsappTemplate[]> {
  return apiClient.get<ApprovedWhatsappTemplate[]>(`/messaging/broadcast/customers/${customerId}/whatsapp-templates`)
}

export async function sendCustomerBroadcastRequest(input: {
  customerId: string
  idempotencyKey: string
  recipientIds: string[]
  filters: BroadcastAudienceFilters
  channels: BroadcastChannel[]
  message: string
  files: File[]
  whatsappTemplate?: { name: string; language: string; bodyParameters: string[]; headerImage: boolean }
}): Promise<BroadcastSendResult> {
  const body = new FormData()
  body.append('idempotencyKey', input.idempotencyKey)
  body.append('recipientIds', JSON.stringify(input.recipientIds))
  body.append('locationIds', JSON.stringify(input.filters.locationIds))
  body.append('activity', input.filters.activity)
  body.append('channels', JSON.stringify(input.channels))
  body.append('message', input.message)
  if (input.whatsappTemplate) {
    body.append('whatsappTemplateName', input.whatsappTemplate.name)
    body.append('whatsappTemplateLanguage', input.whatsappTemplate.language)
    body.append('whatsappTemplateBodyParameters', JSON.stringify(input.whatsappTemplate.bodyParameters))
    body.append('whatsappTemplateHeaderImage', String(input.whatsappTemplate.headerImage))
  }
  input.files.forEach((file) => body.append('files', file, file.name))

  return apiClient.post<BroadcastSendResult>(
    `/messaging/broadcast/customers/${input.customerId}/send`,
    body,
  )
}
