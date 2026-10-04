import {
  format,
  isSameDay,
  isSameMonth,
  isSameWeek,
  isSameYear,
  isTomorrow,
  isValid,
  isYesterday,
  parse,
} from 'date-fns'

import { NO_VALUE_STR } from '@/constants'

type DateInput = Date | string | number | null | undefined

type FormatHumanDateOptions = {
  lastWeek?: string
  lastDay?: string
  sameDay?: string
  nextDay?: string
  nextWeek?: string
  sameElse?: string | ((now: Date, date: Date) => string)
}

const API_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const API_DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}/

function toDate(date: DateInput) {
  if (!date) return null

  if (typeof date === 'string' && API_DATE_PATTERN.test(date)) {
    const apiDate = parseApiDate(date)

    if (apiDate) return apiDate
  }

  const nextDate = date instanceof Date ? date : new Date(date)

  return isValid(nextDate) ? nextDate : null
}

export function formatDateForApi(date: DateInput) {
  if (!date) return date

  const nextDate = toDate(date)

  return nextDate ? format(nextDate, 'yyyy-MM-dd') : ''
}

export function parseApiDate(value?: string | null) {
  if (!value) return undefined

  const date = parse(value, 'yyyy-MM-dd', new Date())

  return isValid(date) ? date : undefined
}

export function formatDisplayDate(date: DateInput, fallback = NO_VALUE_STR) {
  if (typeof date === 'string' && API_DATE_PREFIX_PATTERN.test(date)) {
    const datePart = date.slice(0, 10)

    return parseApiDate(datePart) ? datePart : fallback
  }

  const nextDate = toDate(date)

  return nextDate ? format(nextDate, 'yyyy-MM-dd') : fallback
}

export function formatDateTime(date: DateInput, fallback = '') {
  const nextDate = toDate(date)

  return nextDate ? format(nextDate, 'yyyy-MM-dd HH:mm:ss') : fallback
}

export function formatChartDate(date: DateInput, fallback = '') {
  const nextDate = toDate(date)

  return nextDate ? format(nextDate, 'MMM d') : fallback
}

export function formatPeriodName(startDate: DateInput, endDate: DateInput, fallback = NO_VALUE_STR) {
  const start = toDate(startDate)
  const end = toDate(endDate)

  if (!start || !end) return fallback

  if (!isSameYear(start, end)) {
    return `${format(start, 'd MMM yyyy')} - ${format(end, 'd MMM yyyy')}`
  }

  if (isSameMonth(start, end)) {
    return `${format(start, 'd')} - ${format(end, 'd MMM yyyy')}`
  }

  return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`
}

export function formatHumanDate(date: DateInput, options: FormatHumanDateOptions = {}) {
  const nextDate = toDate(date)

  if (!date || !nextDate) return date

  const now = new Date()

  if (isYesterday(nextDate)) return options.lastDay ?? 'Yesterday'
  if (isSameDay(nextDate, now)) return options.sameDay ?? 'Today'
  if (isTomorrow(nextDate)) return options.nextDay ?? 'Tomorrow'
  if (isSameWeek(nextDate, now)) return format(nextDate, options.nextWeek ?? 'EEEE')

  if (options.sameElse) {
    const formatString = typeof options.sameElse === 'function' ? options.sameElse(now, nextDate) : options.sameElse

    return format(nextDate, formatString)
  }

  return format(nextDate, isSameYear(nextDate, now) ? 'MMM d' : 'MMM d, yyyy')
}
