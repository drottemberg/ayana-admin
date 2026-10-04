import countries, { type Country } from 'world-countries'

type GetCountriesOptions = {
  locale?: string
}

type CountryOption = {
  value: string
  label: string
  flag: string
  name: string
}

function normalizeCountryId(countryId?: string | null) {
  return countryId?.trim().toUpperCase() || ''
}

function getCountryById(countryId?: string | null) {
  const normalizedCountryId = normalizeCountryId(countryId)

  if (!normalizedCountryId) return undefined

  return countries.find((country) => country.cca2 === normalizedCountryId)
}

function getLocalizedCountryName(country: Country, locale = 'en') {
  const normalizedLocale = locale.trim().toLowerCase()
  const language = normalizedLocale.split('-')[0]

  return country.translations[normalizedLocale]?.common ?? country.translations[language]?.common ?? country.name.common
}

export function getCountries(options: GetCountriesOptions = {}): CountryOption[] {
  const locale = options.locale ?? 'en'

  return countries
    .map((country) => {
      const value = normalizeCountryId(country.cca2)
      const name = getLocalizedCountryName(country, locale)

      return {
        value,
        label: `${country.flag} ${name}`,
        flag: country.flag,
        name,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, locale))
}

export function getCountryName(countryId?: string | null, locale = 'en') {
  const country = getCountryById(countryId)

  return country ? getLocalizedCountryName(country, locale) : undefined
}

export function getCountryFlag(countryId?: string | null) {
  return getCountryById(countryId)?.flag
}

export function getCountryOption(countryId?: string | null, locale = 'en') {
  const country = getCountryById(countryId)

  if (!country) return undefined

  const value = normalizeCountryId(country.cca2)
  const name = getLocalizedCountryName(country, locale)

  return {
    value,
    label: `${country.flag} ${name}`,
    flag: country.flag,
    name,
  }
}

export async function getCurrentPosition(): Promise<GeolocationPosition> {
  return await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject)
  })
}
