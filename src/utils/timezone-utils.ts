import { getAllTimezones, getTimezone, getTimezonesForCountry, type Timezone } from 'countries-and-timezones'

type GetTimezonesOptions = {
  countries?: string[]
}

function normalizeCountry(country: string) {
  return country.trim().toUpperCase()
}

export function getTimezones(options: GetTimezonesOptions = {}) {
  const countries = options.countries?.map(normalizeCountry).filter(Boolean)
  const timezones = new Map<string, Timezone>()

  if (countries?.length) {
    countries.forEach((country) => {
      getTimezonesForCountry(country)?.forEach((timezone) => {
        timezones.set(timezone.name, timezone)
      })
    })
  } else {
    Object.values(getAllTimezones()).forEach((timezone) => {
      timezones.set(timezone.name, timezone)
    })
  }

  return [...timezones.values()].sort((a, b) => {
    return a.utcOffset - b.utcOffset || a.dstOffset - b.dstOffset || a.name.localeCompare(b.name)
  })
}

export function getTimezoneLabel(timezone?: string | Timezone | null) {
  if (!timezone) return ''

  const timezoneInfo = typeof timezone === 'string' ? getTimezone(timezone) : timezone

  if (!timezoneInfo) return typeof timezone === 'string' ? timezone : timezone.name

  return `(UTC${timezoneInfo.utcOffsetStr}) ${timezoneInfo.name}`
}
