import { NO_VALUE_STR } from '@/constants'

const FILE_SIZE_UNITS = ['KB', 'MB', 'GB', 'TB'] as const

export function displayFileSize(sizeInKb?: number | null): string {
  if (typeof sizeInKb !== 'number' || !Number.isFinite(sizeInKb) || sizeInKb < 0) return NO_VALUE_STR

  let size = sizeInKb
  let unitIndex = 0

  while (size >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  const maximumFractionDigits = size < 10 && unitIndex > 0 ? 1 : 0
  const formattedSize = new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(size)

  return `${formattedSize} ${FILE_SIZE_UNITS[unitIndex]}`
}
