import * as React from 'react'
import {
  getCountries as getPhoneCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js'
import { getTimezone } from 'countries-and-timezones'

import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SelectInput, type SelectInputItem } from '@/components/ui/select-input'
import * as GeoUtils from '@/utils/geo-utils'

type PhoneInputProps = {
  id?: string
  name?: string
  label?: React.ReactNode
  value?: string | null
  placeholder?: string
  error?: React.ReactNode
  disabled?: boolean
  required?: boolean
  onValueChange?: (value: string) => void
  onBlur?: () => void
}

const phoneCountryCodes = new Set<string>(getPhoneCountries())

function isPhoneCountryCode(value: string): value is CountryCode {
  return phoneCountryCodes.has(value)
}

function getBrowserCountry(): CountryCode {
  if (typeof navigator !== 'undefined') {
    try {
      const language = navigator.languages?.[0] || navigator.language
      const region = new Intl.Locale(language).region?.toUpperCase()
      if (region && isPhoneCountryCode(region)) return region
    } catch {
      // Ignore malformed browser locale strings and try the timezone fallback.
    }

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const country = getTimezone(timezone)?.countries?.[0]?.toUpperCase()
      if (country && isPhoneCountryCode(country)) return country
    } catch {
      // Some browsers do not expose a usable timezone.
    }
  }

  return 'FR'
}

function getPhoneCountryItems(locale: string): SelectInputItem[] {
  return GeoUtils.getCountries({ locale })
    .filter((country) => phoneCountryCodes.has(country.value))
    .map((country) => ({
      value: country.value,
      label: `${country.flag} +${getCountryCallingCode(country.value as CountryCode)} · ${country.name}`,
    }))
}

function toE164(value: string, country: CountryCode) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const parsed = trimmed.startsWith('+')
    ? parsePhoneNumberFromString(trimmed)
    : parsePhoneNumberFromString(trimmed, country)
  if (parsed) return parsed.number

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  if (trimmed.startsWith('+')) return `+${digits}`

  return `+${getCountryCallingCode(country)}${digits}`
}

function getDisplayParts(value: string, fallbackCountry: CountryCode) {
  if (!value) return { country: fallbackCountry, nationalNumber: '' }

  const parsed = value.startsWith('+')
    ? parsePhoneNumberFromString(value)
    : parsePhoneNumberFromString(value, fallbackCountry)

  return {
    country: parsed?.country && isPhoneCountryCode(parsed.country) ? parsed.country : fallbackCountry,
    nationalNumber: parsed?.formatNational() ?? value,
  }
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ id, name, label, value = '', placeholder = 'Phone number', error, disabled, required, onValueChange, onBlur }, ref) => {
    const inputId = id ?? React.useId()
    const browserCountry = React.useMemo(getBrowserCountry, [])
    const locale = typeof navigator === 'undefined' ? 'en' : navigator.language
    const items = React.useMemo(() => getPhoneCountryItems(locale), [locale])
    const [country, setCountry] = React.useState<CountryCode>(() => {
      const current = getDisplayParts(String(value ?? ''), browserCountry)
      return current.country
    })
    const [nationalNumber, setNationalNumber] = React.useState(() =>
      getDisplayParts(String(value ?? ''), browserCountry).nationalNumber,
    )
    const lastEmittedValue = React.useRef<string | undefined>(undefined)

    React.useEffect(() => {
      const currentValue = String(value ?? '')
      if (lastEmittedValue.current === currentValue) {
        lastEmittedValue.current = undefined
        return
      }

      const display = getDisplayParts(currentValue, browserCountry)
      setCountry(display.country)
      setNationalNumber(display.nationalNumber)
    }, [browserCountry, value])

    const emitValue = React.useCallback(
      (nextValue: string) => {
        lastEmittedValue.current = nextValue
        onValueChange?.(nextValue)
      },
      [onValueChange],
    )

    return (
      <Field data-slot="phone-input-field" data-invalid={Boolean(error)}>
        {label ? (
          <FieldLabel htmlFor={inputId} required={required}>
            {label}
          </FieldLabel>
        ) : null}
        <div className="flex min-w-0 gap-2">
          <SelectInput
            aria-label="Country calling code"
            containerClassName="w-[170px] shrink-0"
            className="h-9"
            items={items}
            value={country}
            searchable
            disabled={disabled}
            onValueChange={(selectedCountry) => {
              const nextCountry = String(selectedCountry).toUpperCase()
              if (!isPhoneCountryCode(nextCountry)) return

              setCountry(nextCountry)
              emitValue(toE164(nationalNumber, nextCountry))
            }}
            onBlur={onBlur}
          />
          <Input
            ref={ref}
            id={inputId}
            name={name}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={placeholder}
            value={nationalNumber}
            disabled={disabled}
            required={required}
            aria-invalid={Boolean(error) || undefined}
            onBlur={onBlur}
            onChange={(event) => {
              const nextNumber = event.target.value
              if (!/^[+\d\s().-]*$/.test(nextNumber)) return

              if (nextNumber.startsWith('+')) {
                const parsed = parsePhoneNumberFromString(nextNumber)
                if (parsed?.country && isPhoneCountryCode(parsed.country)) setCountry(parsed.country)
              }

              setNationalNumber(nextNumber)
              emitValue(toE164(nextNumber, country))
            }}
          />
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    )
  },
)
PhoneInput.displayName = 'PhoneInput'

export { PhoneInput }
export type { PhoneInputProps }
