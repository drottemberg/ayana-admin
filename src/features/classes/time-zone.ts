const DEFAULT_TIME_ZONE = 'Europe/Paris'

function getParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]))
}

export function formatClassSessionTime(value: string, timeZone?: string | null): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timeZone || DEFAULT_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function toClassSessionLocalInput(value: string, timeZone?: string | null): string {
  const parts = getParts(new Date(value), timeZone || DEFAULT_TIME_ZONE)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function classSessionLocalInputToIso(value: string, timeZone?: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new Error('Enter a valid local date and time.')

  const [, year, month, day, hour, minute] = match
  const wantedWallTime = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  const zone = timeZone || DEFAULT_TIME_ZONE
  let instant = wantedWallTime

  // Find the UTC instant whose clock reads as the requested wall time in the location zone.
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = getParts(new Date(instant), zone)
    const observedWallTime = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute),
    )
    const difference = wantedWallTime - observedWallTime
    instant += difference
    if (difference === 0) break
  }

  const iso = new Date(instant).toISOString()
  if (toClassSessionLocalInput(iso, zone) !== value) {
    throw new Error(`That local time does not exist in ${zone} because of a daylight-saving clock change.`)
  }
  return iso
}
