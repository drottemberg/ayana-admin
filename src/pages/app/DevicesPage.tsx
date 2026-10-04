import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getDevicesRequest } from '@/features/devices/api'
import { deviceColumns } from '@/features/devices/device-columns'
import { DeviceService } from '@/features/devices/device-service'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { useConnect } from '@/features/app/use-connect'
import { apiClient } from '@/lib/api-client'
import { Drawer, DrawerId } from '@/providers/drawer'
import type { Device } from '@/types/device'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

type DeviceFilterDimension = 'status' | 'type' | 'typeGroup' | 'store' | 'customer' | 'contract' | 'product'

async function fetchDeviceFilterOptions(
  filter: DeviceFilterDimension,
  search: string,
  page: number,
  filters?: Record<string, unknown>,
) {
  return apiClient.post<{ items: { id: string; label: string }[]; total: number }>('/devices/list/filters', {
    filter,
    filters,
    search: search.trim() || undefined,
    page,
    limit: 20,
  })
}

export default function DevicesPage() {
  const navigate = useNavigate()
  const { session } = useConnect()
  const portal = getPortalSafe()
  const currentOrganizationId = session?.currentOrganization?.id
  const [activeTab, setActiveTab] = useState<'all' | 'set' | 'device'>('all')
  const hiddenFilters = useMemo(() => {
    const filters: Record<string, unknown> = {}
    if (activeTab === 'set') filters.isSet = true
    if (activeTab === 'device') filters.isSet = false
    if (portal === Portal.CUSTOMER && currentOrganizationId) filters.customerId = currentOrganizationId
    return Object.keys(filters).length ? filters : undefined
  }, [activeTab, currentOrganizationId, portal])
  const loadDevices = useCallback(
    (tableState: DataTableState<Device>) => getDevicesRequest(tableState, hiddenFilters),
    [hiddenFilters],
  )
  const handleGetCommands = useCallback(
    (devices: Device[]) => {
      return DeviceService.getTableActions({ navigate, devices })
    },
    [navigate],
  )
  return (
    <>
      <PageHeader
        title="Devices"
        primaryAction={
          portal === Portal.ADMIN
            ? {
                children: 'Create device set',
                onClick: () => Drawer.show(DrawerId.CreateDevice, { isSet: true }),
              }
            : undefined
        }
        secondaryAction={
          portal === Portal.ADMIN
            ? {
                children: 'Add device',
                onClick: () => Drawer.show(DrawerId.CreateDevice, {}),
              }
            : undefined
        }
      />

      <section className="space-y-5 p-4 md:p-6">
        <DeviceTypeTabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as typeof activeTab)}
          tabs={[
            {
              value: 'all',
              name: 'All',
            },
            {
              value: 'set',
              name: 'Device set',
            },
            {
              value: 'device',
              name: 'Device',
            },
          ]}
        />
        <DataTableAsync
          key={activeTab}
          queryKey={[...devicesQueryKeys.all, 'table', activeTab]}
          loadData={loadDevices}
          refetchInterval={10_000}
          tableKey="devices.root"
          columns={deviceColumns}
          searchPlaceholder="Search by id, name, serial"
          searchColumns={['id', 'name', 'serialNumber']}
          filters={[
            {
              id: 'status',
              label: 'Status',
              column: 'status',
              options: DeviceService.statusKeys(),
              getValue: (device) => device.status,
            },
            ...(portal === Portal.CUSTOMER
              ? []
              : [
                  {
                    id: 'customerId',
                    label: 'Customer',
                    column: 'customer' as const,
                    selectionMode: 'single' as const,
                    queryFn: (search: string, page: number) =>
                      fetchDeviceFilterOptions('customer', search, page, hiddenFilters),
                  },
                ]),
            {
              id: 'storeId',
              label: 'Store',
              column: 'store',
              selectionMode: 'single',
              queryFn: (search, page) => fetchDeviceFilterOptions('store', search, page, hiddenFilters),
            },
            {
              id: 'productId',
              label: 'Product',
              column: 'activeProduct',
              selectionMode: 'single',
              queryFn: (search, page) => fetchDeviceFilterOptions('product', search, page, hiddenFilters),
            },
            {
              id: 'contractId',
              label: 'Contract',
              column: 'contract',
              selectionMode: 'single',
              queryFn: (search, page) => fetchDeviceFilterOptions('contract', search, page, hiddenFilters),
            },
            {
              id: 'typeGroupId',
              label: 'Type group',
              column: 'typeGroupId',
              selectionMode: 'single',
              queryFn: (search, page) => fetchDeviceFilterOptions('typeGroup', search, page, hiddenFilters),
            },
            {
              id: 'type',
              label: 'Type',
              column: 'type',
              selectionMode: 'single',
              queryFn: (search, page) => fetchDeviceFilterOptions('type', search, page, hiddenFilters),
            },
          ]}
          getCommands={portal === Portal.ADMIN ? handleGetCommands : undefined}
          getRowCommands={portal === Portal.ADMIN ? (device) => DeviceService.getActions(device, navigate) : undefined}
          loadingMessage="Loading devices..."
          emptyMessage="No devices found."
          errorMessage="Failed to load devices."
        />
      </section>
    </>
  )
}

function DeviceTypeTabs({
  value,
  tabs,
  onValueChange,
}: {
  value: string
  tabs: { value: string; name: string; count?: number }[]
  onValueChange: (value: string) => void
}) {
  return (
    <Tabs value={value} onValueChange={(value) => onValueChange(value as typeof value)}>
      <TabsList
        aria-label="Device list type"
        className="h-8 overflow-hidden rounded-lg border border-border bg-background p-0 text-foreground max-sm:w-full"
      >
        {tabs.map((tab) => {
          return (
            <TabsTrigger
              key={tab.name}
              value={tab.value}
              className="group h-full rounded-none border-0 border-r border-border px-4 text-sm font-semibold data-active:bg-foreground data-active:text-background data-active:after:hidden"
            >
              {tab.name} {typeof tab.count === 'number' ? <TabCount>{tab.count}</TabCount> : null}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

function TabCount({ children }: { children: number }) {
  return (
    <span className="rounded-md bg-muted px-1.5 text-xs text-muted-foreground group-data-[active]:bg-lime-300 group-data-[active]:text-foreground">
      {children}
    </span>
  )
}
