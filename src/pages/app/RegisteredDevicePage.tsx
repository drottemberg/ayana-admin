import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { AccessDeviceDrawer } from '@/features/devices/AccessDeviceDrawer'
import { getAccessDeviceOrganization, getRegisteredDeviceRequest } from '@/features/devices/access-device-api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { useConnect } from '@/features/app/use-connect'

export default function RegisteredDevicePage() {
  const { deviceId = '' } = useParams()
  const { session } = useConnect()
  const [editing, setEditing] = useState(false)
  const { data: device, isPending, isError } = useQuery({
    queryKey: [...devicesQueryKeys.all, 'registered', deviceId],
    queryFn: () => getRegisteredDeviceRequest(deviceId),
    enabled: Boolean(deviceId),
  })

  return (
    <>
      <PageHeader title={device?.name ?? 'Device'} />
      <section className="space-y-5 p-4 md:p-6">
        <Link className="text-sm underline underline-offset-2" to="/devices">Back to devices</Link>
        {isPending ? <p>Loading device…</p> : isError || !device ? <p>Device could not be loaded.</p> : (
          <div className="max-w-2xl space-y-4 rounded-xl border bg-background p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{device.name}</h2>
                <p className="text-sm text-muted-foreground">{device.deviceId}</p>
              </div>
              {session?.permissions.devices?.edit ? <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button> : null}
            </div>
            <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Status</dt><dd>{device.isActive ? 'Active' : 'Disabled'}</dd>
              <dt className="text-muted-foreground">Group</dt><dd>{device.group === 'PAYMENT_TERMINAL' ? 'Payment terminal' : 'Access'}</dd>
              <dt className="text-muted-foreground">Type</dt><dd>{device.type}</dd>
              <dt className="text-muted-foreground">Purpose</dt><dd>{device.purpose}</dd>
              <dt className="text-muted-foreground">Customer / location</dt><dd>{device.organization?.name ?? '—'}</dd>
            </dl>
          </div>
        )}
      </section>
      {device ? <AccessDeviceDrawer
        open={editing}
        onOpenChange={setEditing}
        fixedOrganization={getAccessDeviceOrganization(device)}
        device={device}
      /> : null}
    </>
  )
}
