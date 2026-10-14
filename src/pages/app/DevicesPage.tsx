import { useState } from 'react'

import { DataTableAsync } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { accessDeviceColumns } from '@/features/devices/access-device-columns'
import { getAccessDevicesRequest, type AccessDevice } from '@/features/devices/access-device-api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { AccessDeviceDrawer } from '@/features/devices/AccessDeviceDrawer'
import { useConnect } from '@/features/app/use-connect'
import { readSelectedLocationScope } from '@/features/organizations/storage'
import { getPortalSafe, Portal } from '@/utils/portal-utils'
import type { Customer } from '@/types/customer'

const DEVICE_TYPES = ['GENERIC', 'AC600', 'STRIPE_TERMINAL']

export default function DevicesPage() {
  const { session } = useConnect()
  const portal = getPortalSafe()
  const customerId = session?.currentOrganization?.id
  const locationScope = portal === Portal.CUSTOMER && customerId ? readSelectedLocationScope(customerId) : null
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
  const customer = portal === Portal.CUSTOMER && session?.currentOrganization?.id
    ? { id: session.currentOrganization.id, name: session.currentOrganization.name ?? '' } as Customer
    : undefined

  return (
    <>
      <PageHeader
        title="Devices"
        primaryAction={portal === Portal.ADMIN || session?.permissions.devices?.create ? {
          children: 'Add device',
          onClick: () => setIsCreateDrawerOpen(true),
        } : undefined}
      />

      <AccessDeviceDrawer
        open={isCreateDrawerOpen}
        onOpenChange={setIsCreateDrawerOpen}
        fixedCustomer={customer}
      />

      <section className="space-y-5 p-4 md:p-6">
        <DataTableAsync<AccessDevice>
          queryKey={[...devicesQueryKeys.all, 'access-device-list', customerId, locationScope]}
          loadData={(state) => getAccessDevicesRequest(state)}
          tableKey="devices.root"
          columns={accessDeviceColumns}
          searchPlaceholder="Search by device ID or name"
          searchColumns={['deviceId', 'name']}
          filters={[
            {
              id: 'type',
              label: 'Type',
              column: 'type',
              selectionMode: 'multiple',
              options: DEVICE_TYPES,
            },
            {
              id: 'isActive',
              label: 'Status',
              column: 'isActive',
              selectionMode: 'single',
              options: ['true', 'false'],
              getValue: (device) => String(device.isActive),
            },
            {
              id: 'purpose',
              label: 'Purpose',
              column: 'purpose',
              selectionMode: 'multiple',
              options: ['ACCESS', 'CHECK_IN', 'PAYMENT'],
            },
          ]}
          loadingMessage="Loading devices..."
          emptyMessage="No devices found."
          errorMessage="Failed to load devices."
        />
      </section>
    </>
  )
}
