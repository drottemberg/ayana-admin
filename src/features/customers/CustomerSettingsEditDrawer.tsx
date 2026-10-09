import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  getCustomerLocationPoliciesRequest,
  getCustomerMessagingConfigRequest,
  getCustomerPromptProfileRequest,
  updateCustomerLocationPolicyRequest,
  updateCustomerMessagingConfigRequest,
  updateCustomerPromptProfileRequest,
  type CustomerLocationPolicyRow,
  type CustomerSettingKind,
} from '@/features/customers/customer-settings-api'
import { customerSettingsQueryKeys } from '@/features/customers/customer-settings-api'
import { queryClient } from '@/lib/query-client'

type Target = { kind: CustomerSettingKind; location?: CustomerLocationPolicyRow }

const messagingFields = [
  { key: 'whatsappPhoneNumberId', label: 'WhatsApp phone number ID' },
  { key: 'whatsappBusinessPhoneNumber', label: 'WhatsApp business phone number (+33612345678)' },
  { key: 'whatsappBusinessAccountId', label: 'WhatsApp Business Account ID' },
  { key: 'whatsappAccessToken', label: 'WhatsApp access token', secret: true },
  { key: 'whatsappVerifyToken', label: 'WhatsApp verify token', secret: true },
  { key: 'telegramBotUsername', label: 'Telegram bot username' },
  { key: 'telegramBotToken', label: 'Telegram bot token', secret: true },
  { key: 'telegramWebhookSecret', label: 'Telegram webhook secret', secret: true },
] as const

const profileFields = [
  { key: 'agentName', label: 'Agent name' },
  { key: 'mood', label: 'Mood' },
  { key: 'communicationStyle', label: 'Communication style' },
  { key: 'philosophy', label: 'Philosophy', multiline: true },
  { key: 'welcomeMessage', label: 'Welcome message', multiline: true },
  { key: 'objectives', label: 'Objectives', multiline: true },
  { key: 'highlights', label: 'Highlights', multiline: true },
  { key: 'doNotSay', label: 'Do not say', multiline: true },
  { key: 'extraInstructions', label: 'Extra instructions', multiline: true },
] as const

const policyFields = [
  { key: 'lateCancelWindowHours', label: 'Late cancellation window (hours)', type: 'number' },
  { key: 'lateCancelPenaltyCredits', label: 'Late cancellation penalty (credits)', type: 'number' },
  { key: 'lateCancelPenaltyAmount', label: 'Late cancellation penalty (amount)', type: 'number' },
  { key: 'noShowPenaltyCredits', label: 'No-show penalty (credits)', type: 'number' },
  { key: 'noShowPenaltyAmount', label: 'No-show penalty (amount)', type: 'number' },
  { key: 'maxBookingsPerDay', label: 'Maximum bookings per day', type: 'number' },
  { key: 'openingDate', label: 'Opening date', type: 'date' },
  { key: 'openingHours', label: 'Studio opening hours (JSON)', multiline: true },
  { key: 'onlineOrderHours', label: 'Online order hours (JSON)', multiline: true },
] as const

function policyValues(policy?: Record<string, unknown> | null) {
  return {
    lateCancelWindowHours: String(policy?.lateCancelWindowHours ?? 12),
    lateCancelPenaltyCredits: String(policy?.lateCancelPenaltyCredits ?? 1),
    lateCancelPenaltyAmount: policy?.lateCancelPenaltyAmount == null ? '' : String(policy.lateCancelPenaltyAmount),
    noShowPenaltyCredits: String(policy?.noShowPenaltyCredits ?? 1),
    noShowPenaltyAmount: policy?.noShowPenaltyAmount == null ? '' : String(policy.noShowPenaltyAmount),
    maxBookingsPerDay: policy?.maxBookingsPerDay == null ? '' : String(policy.maxBookingsPerDay),
    openingDate: typeof policy?.openingDate === 'string' ? policy.openingDate.slice(0, 10) : '',
    openingHours: policy?.openingHours == null ? '' : JSON.stringify(policy.openingHours, null, 2),
    onlineOrderHours: policy?.onlineOrderHours == null ? '' : JSON.stringify(policy.onlineOrderHours, null, 2),
  }
}

function toPolicyPayload(values: Record<string, string>) {
  const numeric = [
    'lateCancelWindowHours',
    'lateCancelPenaltyCredits',
    'lateCancelPenaltyAmount',
    'noShowPenaltyCredits',
    'noShowPenaltyAmount',
    'maxBookingsPerDay',
  ]
  const requiredNumeric = new Set(['lateCancelWindowHours', 'lateCancelPenaltyCredits', 'noShowPenaltyCredits'])
  const payload: Record<string, unknown> = {}
  for (const key of numeric) {
    if (requiredNumeric.has(key) && values[key] === '') throw new Error(`${key} is required.`)
    payload[key] = values[key] === '' ? null : Number(values[key])
  }
  payload.openingDate = values.openingDate || null
  for (const key of ['openingHours', 'onlineOrderHours']) {
    if (!values[key].trim()) payload[key] = null
    else {
      try {
        const parsed = JSON.parse(values[key])
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected an object.')
        payload[key] = parsed
      } catch {
        throw new Error(`${key === 'openingHours' ? 'Studio opening hours' : 'Online order hours'} must be valid JSON.`)
      }
    }
  }
  return payload
}

export function CustomerSettingsEditDrawer({
  open,
  onOpenChange,
  customerId,
  customerName,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  customerName: string
  target: Target | null
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [hasExistingSecret, setHasExistingSecret] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open || !target) return
    let current = true
    setIsLoading(true)
    setValues({})
    setHasExistingSecret({})
    const load = async () => {
      try {
        if (target.kind === 'messaging-config') {
          const config = await getCustomerMessagingConfigRequest(customerId)
          const next: Record<string, string> = {}
          for (const field of messagingFields) {
            const value = (config as Record<string, unknown> | null)?.[field.key]
            next[field.key] = typeof value === 'string' ? value : ''
          }
          if (current) {
            setValues(next)
            setHasExistingSecret({
              whatsappAccessToken: Boolean(config?.hasWhatsappAccessToken),
              whatsappVerifyToken: Boolean(config?.hasWhatsappVerifyToken),
              telegramBotToken: Boolean(config?.hasTelegramBotToken),
              telegramWebhookSecret: Boolean(config?.hasTelegramWebhookSecret),
            })
          }
        } else if (target.kind === 'prompt-profile') {
          const profile = await getCustomerPromptProfileRequest(customerId)
          if (current) {
            const next: Record<string, string> = {}
            for (const field of profileFields) {
              const value = (profile as Record<string, unknown> | null)?.[field.key]
              next[field.key] = typeof value === 'string' ? value : ''
            }
            setValues(next)
          }
        } else {
          const locations = await getCustomerLocationPoliciesRequest(customerId)
          const location = locations.find((item) => item.id === target.location?.id)
          if (current) setValues(policyValues(location?.policy ?? target.location?.policy))
        }
      } catch (error) {
        if (current) toast.error(error instanceof Error ? error.message : 'Could not load customer settings.')
      } finally {
        if (current) setIsLoading(false)
      }
    }
    void load()
    return () => { current = false }
  }, [open, target, customerId])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!target) return
    setIsSaving(true)
    try {
      if (target.kind === 'messaging-config') {
        const payload: Record<string, unknown> = {}
        for (const field of messagingFields) {
          const value = values[field.key]?.trim() ?? ''
          if ('secret' in field && field.secret) {
            if (value) payload[field.key] = value
          } else {
            payload[field.key] = value || null
          }
        }
        await updateCustomerMessagingConfigRequest(customerId, payload)
      } else if (target.kind === 'prompt-profile') {
        const payload = Object.fromEntries(profileFields.map((field) => [field.key, values[field.key]?.trim() || null]))
        await updateCustomerPromptProfileRequest(customerId, payload)
      } else if (target.location) {
        await updateCustomerLocationPolicyRequest(customerId, target.location.id, toPolicyPayload(values))
      }
      await queryClient.invalidateQueries({ queryKey: customerSettingsQueryKeys.customer(customerId) })
      toast.success('Customer settings updated.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save customer settings.')
    } finally {
      setIsSaving(false)
    }
  }

  const title = target?.kind === 'messaging-config'
    ? 'Edit messaging configuration'
    : target?.kind === 'prompt-profile'
      ? 'Edit customer prompt profile'
      : `Edit location policy${target?.location?.name ? ` · ${target.location.name}` : ''}`
  const fields = target?.kind === 'messaging-config'
    ? messagingFields
    : target?.kind === 'prompt-profile'
      ? profileFields
      : policyFields

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} title={title} description={`Settings for ${customerName}.`} contentClassName="sm:max-w-2xl">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
          {isLoading ? <div className="py-6 text-sm text-muted-foreground">Loading settings…</div> : null}
          {!isLoading && target?.kind === 'messaging-config' ? <h3 className="font-medium">WhatsApp and Telegram</h3> : null}
          {!isLoading && target?.kind === 'prompt-profile' ? <h3 className="font-medium">Assistant behavior and content</h3> : null}
          {!isLoading && target?.kind === 'location-policy' ? <p className="text-sm text-muted-foreground">Leave schedule values empty when no specific hours are set. Hours must be JSON by weekday, for example: {'{"mon":{"open":"09:00","close":"18:00"}}'}.</p> : null}
          {!isLoading ? fields.map((field) => {
            const value = values[field.key] ?? ''
            const secret = 'secret' in field && field.secret
            const placeholder = secret && hasExistingSecret[field.key] ? 'Saved; enter a new value to replace it' : undefined
            return (
              <label key={field.key} className="grid gap-1.5 text-sm font-medium">
                <span>{field.label}</span>
                {'multiline' in field && field.multiline
                  ? <Textarea value={value} onChange={(event) => setValues((previous) => ({ ...previous, [field.key]: event.target.value }))} rows={field.key === 'openingHours' || field.key === 'onlineOrderHours' ? 7 : 3} placeholder={placeholder} />
                  : <Input type={'type' in field ? field.type : 'text'} value={value} onChange={(event) => setValues((previous) => ({ ...previous, [field.key]: event.target.value }))} placeholder={placeholder} />}
                {secret && hasExistingSecret[field.key] ? <span className="text-xs font-normal text-muted-foreground">Leave blank to keep the saved value.</span> : null}
              </label>
            )
          }) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button type="submit" disabled={isLoading || isSaving || !target}>{isSaving ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </form>
    </AppDrawer>
  )
}
