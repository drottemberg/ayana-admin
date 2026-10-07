import { toast } from 'sonner'

import type { DataTableCommand } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import { deleteLocationRequest, setLocationStatusRequest } from '@/features/locations/api'
import { locationsQueryKeys } from '@/features/locations/query-keys'
import { queryClient } from '@/lib/query-client'
import { Drawer, DrawerId } from '@/providers/drawer'
import { Modals } from '@/providers/modal'
import type { Location } from '@/types/location'
import { OrganizationStatus } from '@/types/organization'

export type LocationActionPermissions = {
  edit: boolean
  manageStatus: boolean
  delete: boolean
}

export const LocationService = {
  async deleteLocations(locations: Location[]) {
    if (!locations.length) return

    const confirmed = await Modals.confirm({
      operation: `delete ${locations.length} location(s)`,
      okButtonProps: { variant: 'destructive' },
    })
    if (!confirmed) return

    await Promise.all(locations.map((location) => deleteLocationRequest(location.id)))
    await queryClient.invalidateQueries({ queryKey: locationsQueryKeys.all })
    toast.success(`${locations.length} location(s) deleted.`)
  },

  async setStatus(location: Location, status: OrganizationStatus) {
    await setLocationStatusRequest(location.id, status)
    await queryClient.invalidateQueries({ queryKey: locationsQueryKeys.all })
  },

  getRowActions(location: Location, permissions: LocationActionPermissions): DropdownActionItem[] {
    const actions: DropdownActionItem[] = []

    if (permissions.edit) {
      actions.push({ label: 'Edit', onClick: () => Drawer.show(DrawerId.CreateLocation, { location }) })
    }

    if (permissions.manageStatus && !location.isDeleted) {
      const isActive = location.status === OrganizationStatus.ACTIVE
      actions.push({
        label: isActive ? 'Disable' : 'Enable',
        onClick: () => void this.setStatus(location, isActive ? OrganizationStatus.PENDING : OrganizationStatus.ACTIVE),
      })
    }

    if (permissions.delete && !location.isDeleted) {
      actions.push({
        label: 'Delete',
        variant: 'destructive',
        onClick: () => void this.deleteLocations([location]),
      })
    }

    return actions
  },

  getTableActions(permissions: LocationActionPermissions, selectedLocations: Location[]): DataTableCommand<Location>[] {
    if (!permissions.delete) return []

    return [
      {
        label: 'Delete',
        disabled: selectedLocations.length === 0,
        variant: 'destructive',
        onClick: (locations) => void this.deleteLocations(locations),
      },
    ]
  },
}
