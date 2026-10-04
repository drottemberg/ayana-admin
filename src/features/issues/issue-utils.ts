import { DeviceService } from '@/features/devices/device-service'
import type { Device } from '@/types/device'
import type { Issue } from '@/types/issue'

export function getIssueTypeLabels(issue: Issue): string[] {
  if (issue.device) return DeviceService.getTypeLabelsFromQuery(issue.device)
  if (!issue.deviceType) return []

  return [DeviceService.getTypeLabel(issue.deviceType as Device['type'])]
}
