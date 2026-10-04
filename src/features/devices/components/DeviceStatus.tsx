import { Badge } from '@/components/ui/badge'
import { DeviceService } from '@/features/devices/device-service'
import { cn } from '@/lib/utils'
import {
  DeviceEntityStatus,
  DeviceEntityStatusLabel,
  DeviceStatus as DS,
  type DeviceEntityStatus as DeviceEntityStatusType,
  type DeviceStatus as DeviceStatusType,
} from '@/types/device'

type DeviceStatusProps = {
  status: DeviceStatusType
}

export function DeviceStatus({ status }: DeviceStatusProps) {
  return (
    <Badge variant="outline" className="gap-1.5 bg-background text-foreground">
      <span
        className={cn(
          'size-2 rounded-full',
          status === DS.Online && 'bg-green-500',
          status === DS.Rebooting && 'bg-orange-500',
          status === DS.Disconnected && 'bg-red-500',
          status === DS.NotConnected && 'border border-dashed border-muted-foreground/30',
        )}
      />
      {DeviceService.statusToString(status)}
    </Badge>
  )
}

const entityStatusClassName: Record<DeviceEntityStatusType, string> = {
  [DeviceEntityStatus.Provisioning]: 'bg-blue-100 text-blue-800 border-blue-200',
  [DeviceEntityStatus.Active]: 'bg-green-100 text-green-800 border-green-200',
  [DeviceEntityStatus.Maintenance]: 'bg-orange-100 text-orange-800 border-orange-200',
  [DeviceEntityStatus.Disabled]: 'bg-muted text-muted-foreground border-border',
  [DeviceEntityStatus.Archived]: 'bg-muted text-muted-foreground border-border',
  [DeviceEntityStatus.Deleted]: 'bg-red-100 text-red-800 border-red-200',
}

export function DeviceEntityStatusBadge({ status }: { status: DeviceEntityStatusType }) {
  return (
    <Badge variant="outline" className={entityStatusClassName[status]}>
      {DeviceEntityStatusLabel[status] ?? status}
    </Badge>
  )
}
