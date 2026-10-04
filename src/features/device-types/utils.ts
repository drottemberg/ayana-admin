export function getDeviceTypeLabel(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
