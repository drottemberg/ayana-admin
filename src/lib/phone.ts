import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js'

export function normalizePhone(value: string) {
  const trimmed = value.trim()
  const hasLeadingPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  return `${hasLeadingPlus ? '+' : ''}${digits}`
}

export function validatePhone(value: string) {
  const normalized = normalizePhone(value)
  if (!normalized) return 'Phone number is required.'

  return isValidPhoneNumber(normalized) ? undefined : 'Enter a valid phone number.'
}

export function formatPhoneNumber(value?: string | null) {
  const normalized = value?.trim()
  if (!normalized) return ''

  const parsed = normalized.startsWith('+') ? parsePhoneNumberFromString(normalized) : undefined
  return parsed?.formatInternational() ?? normalized
}
