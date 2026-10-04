export function normalizePhone(value: string) {
  const trimmed = value.trim()
  const hasLeadingPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  return `${hasLeadingPlus ? '+' : ''}${digits}`
}

export function validatePhone(value: string) {
  const normalized = normalizePhone(value)
  const digitCount = normalized.replace(/\D/g, '').length

  if (!digitCount) return 'Phone number is required.'
  if (digitCount < 7 || digitCount > 15) return 'Enter a valid phone number.'
  if (normalized.includes('+') && !normalized.startsWith('+')) return 'Enter a valid phone number.'

  return undefined
}
