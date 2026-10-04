import type { Address } from '@/types/address'
import { getCountryName } from '@/utils/geo-utils'

export function getInitials(fullName: string): string {
  if (!fullName) return ''
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

export function safeLocaleCompare(a: unknown, b: unknown): number {
  const firstValue = a === null || a === undefined ? '' : String(a)
  const secondValue = b === null || b === undefined ? '' : String(b)

  return firstValue.localeCompare(secondValue, undefined, {
    numeric: true,
  })
}

export function displayAddress(address: Address, opts?: { splitter?: string; hideCountry?: boolean }) {
  if (!address) return ''
  const { splitter, hideCountry } = opts ?? {}
  const { street, suite, zip, city, stateId, countryId } = address
  const NEW_LINE_SPLITER = splitter ?? '\n'
  const WORDS_SPLITER = ', '
  const fields = [
    street,
    suite,
    NEW_LINE_SPLITER,
    zip,
    city,
    stateId,
    !hideCountry ? getCountryName(countryId) : undefined,
  ]
  const result = fields.filter((i) => !!i).join(WORDS_SPLITER)
  return result.replaceAll(`${NEW_LINE_SPLITER}${WORDS_SPLITER}`, NEW_LINE_SPLITER)
}
