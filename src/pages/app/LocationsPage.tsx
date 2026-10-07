import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { fetchLocationFilterOptions, getLocationsRequest } from '@/features/locations/api'
import { locationColumns } from '@/features/locations/location-columns'
import { LocationService } from '@/features/locations/location-service'
import { locationsQueryKeys } from '@/features/locations/query-keys'
import { useConnect } from '@/features/app/use-connect'
import { Drawer, DrawerId } from '@/providers/drawer'
import type { Location } from '@/types/location'
import { TimezoneUtils } from '@/utils'

const timezoneOptions = TimezoneUtils.getTimezones().map((timezone) => timezone.name)

export default function LocationsPage() {
  const { session } = useConnect()
  const customerId = session?.orgId && session.orgId !== 'MASTER' ? session.orgId : undefined
  const permissions = session?.permissions
  const actionPermissions = {
    edit: Boolean(permissions?.customers?.edit || permissions?.users?.edit),
    manageStatus: Boolean(permissions?.customers?.edit),
    delete: Boolean(permissions?.customers?.delete),
  }
  const canCreateLocation = Boolean(permissions?.customers?.create || permissions?.users?.create)
  const filters = [
    ...(!customerId
      ? [
          {
            id: 'customerId',
            label: 'Customer',
            column: 'parentId' as const,
            queryFn: (search: string, page: number) => fetchLocationFilterOptions('customer', search, page),
            getValue: (location: Location) => location.parentId,
          },
        ]
      : []),
    {
      id: 'timezone',
      label: 'Timezone',
      column: 'timezone' as const,
      options: timezoneOptions,
      getValue: (location: Location) => location.timezone,
    },
  ]

  return (
    <>
      <PageHeader
        title="Locations"
        primaryAction={
          canCreateLocation
            ? {
                children: 'Create new location',
                onClick: () => Drawer.show(DrawerId.CreateLocation, { customerId }),
              }
            : undefined
        }
      />
      <section className="p-4 md:p-6">
        <DataTableAsync
          queryKey={[...locationsQueryKeys.all, 'table', customerId]}
          loadData={(tableState: DataTableState<Location>) => getLocationsRequest(tableState, { customerId })}
          tableKey="locations.root"
          columns={locationColumns}
          searchPlaceholder="Search by name, email, or customer..."
          searchColumns={['name', 'email', 'customerName']}
          filters={filters}
          getCommands={(locations) => LocationService.getTableActions(actionPermissions, locations)}
          getRowCommands={(location) => LocationService.getRowActions(location, actionPermissions)}
          loadingMessage="Loading locations..."
          emptyMessage="No locations found."
          errorMessage="Failed to load locations."
        />
      </section>
    </>
  )
}
