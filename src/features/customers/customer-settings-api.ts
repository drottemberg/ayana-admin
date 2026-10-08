import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { apiClient } from '@/lib/api-client'

export type CustomerMessagingConfig = {
  whatsappPhoneNumberId?: string | null
  whatsappBusinessAccountId?: string | null
  telegramBotUsername?: string | null
  hasWhatsappAccessToken?: boolean
  hasWhatsappVerifyToken?: boolean
  hasTelegramBotToken?: boolean
  hasTelegramWebhookSecret?: boolean
  updatedAt?: string | null
}

export type CustomerPromptProfile = {
  agentName?: string | null
  mood?: string | null
  communicationStyle?: string | null
  philosophy?: string | null
  welcomeMessage?: string | null
  objectives?: string | null
  highlights?: string | null
  doNotSay?: string | null
  extraInstructions?: string | null
  updatedAt?: string | null
}

export type CustomerMessagingConfigRow = CustomerMessagingConfig & {
  id: string
  whatsapp: string
  telegram: string
}

export type CustomerPromptProfileRow = CustomerPromptProfile & {
  id: string
  summary: string
}

export type CustomerLocationPolicyRow = {
  id: string
  name: string
  policy: Record<string, unknown> | null
  lateCancelWindowHours: number
  lateCancelPenaltyCredits: number
  noShowPenaltyCredits: number
  openingDate: string | null
  isConfigured: boolean
}

export type CustomerSettingKind = 'messaging-config' | 'prompt-profile' | 'location-policy'

const customerSettingPath = (customerId: string) => `/customers/${encodeURIComponent(customerId)}`

export const customerSettingsQueryKeys = {
  all: ['customer-settings'] as const,
  customer: (customerId: string) => [...customerSettingsQueryKeys.all, customerId] as const,
}

export async function getCustomerMessagingConfigRequest(customerId: string) {
  return apiClient.get<CustomerMessagingConfig | null>(`${customerSettingPath(customerId)}/messaging-config`)
}

export async function updateCustomerMessagingConfigRequest(customerId: string, payload: Record<string, unknown>) {
  return apiClient.patch(`${customerSettingPath(customerId)}/messaging-config`, payload)
}

export async function getCustomerPromptProfileRequest(customerId: string) {
  return apiClient.get<CustomerPromptProfile | null>(`${customerSettingPath(customerId)}/prompt-profile`)
}

export async function updateCustomerPromptProfileRequest(customerId: string, payload: Record<string, unknown>) {
  return apiClient.patch(`${customerSettingPath(customerId)}/prompt-profile`, payload)
}

export async function getCustomerLocationPoliciesRequest(customerId: string) {
  return apiClient.get<CustomerLocationPolicyRow[]>(`${customerSettingPath(customerId)}/location-policies`)
}

export async function updateCustomerLocationPolicyRequest(
  customerId: string,
  locationId: string,
  payload: Record<string, unknown>,
) {
  return apiClient.patch(
    `${customerSettingPath(customerId)}/locations/${encodeURIComponent(locationId)}/policy`,
    payload,
  )
}

export async function loadCustomerMessagingConfigRow(
  customerId: string,
  _state: DataTableState<CustomerMessagingConfigRow>,
): Promise<DataTableAsyncResult<CustomerMessagingConfigRow>> {
  const config = await getCustomerMessagingConfigRequest(customerId)
  const row: CustomerMessagingConfigRow = {
    ...config,
    id: customerId,
    whatsapp: config?.whatsappPhoneNumberId || config?.hasWhatsappAccessToken ? 'Configured' : 'Not configured',
    telegram: config?.telegramBotUsername
      ? `@${config.telegramBotUsername}`
      : config?.hasTelegramBotToken
        ? 'Token configured'
        : 'Not configured',
  }
  return { items: [row], count: 1, pageCount: 1 }
}

export async function loadCustomerPromptProfileRow(
  customerId: string,
  _state: DataTableState<CustomerPromptProfileRow>,
): Promise<DataTableAsyncResult<CustomerPromptProfileRow>> {
  const profile = await getCustomerPromptProfileRequest(customerId)
  const summary = profile
    ? Object.values(profile).find((value) => typeof value === 'string' && value.trim())
    : undefined
  const row: CustomerPromptProfileRow = {
    ...profile,
    id: customerId,
    summary: typeof summary === 'string' ? summary : 'Not configured',
  }
  return { items: [row], count: 1, pageCount: 1 }
}

export async function loadCustomerLocationPolicies(
  customerId: string,
  _state: DataTableState<CustomerLocationPolicyRow>,
): Promise<DataTableAsyncResult<CustomerLocationPolicyRow>> {
  const locations = await getCustomerLocationPoliciesRequest(customerId)
  const items = locations.map((item) => {
    const policy = item.policy
    return {
      ...item,
      lateCancelWindowHours: Number(policy?.lateCancelWindowHours ?? 12),
      lateCancelPenaltyCredits: Number(policy?.lateCancelPenaltyCredits ?? 1),
      noShowPenaltyCredits: Number(policy?.noShowPenaltyCredits ?? 1),
      openingDate: typeof policy?.openingDate === 'string' ? policy.openingDate : null,
      isConfigured: Boolean(policy),
    }
  })
  return { items, count: items.length, pageCount: 1 }
}
