import NiceModal from '@ebay/nice-modal-react'
import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { MultiselectInputAsync } from '@/components/ui/select-input'
import type { SelectInputItem } from '@/components/ui/select-input'
import { FormError } from '@/components/form-error'
import { useDrawerController } from '@/providers/use-overlay-controller'
import { assignDevicesToSetRequest, getDevicesListRequest } from '@/features/devices/api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import type { Device } from '@/types/device'

export type AddDevicesToSetDrawerProps = {
  deviceSetId: string
  existingDeviceIds?: string[]
}

const getDeviceOption = (device: Device): SelectInputItem => ({
  value: device.id,
  label: `${device.name} (${device.serialNumber})`,
})

const AddDevicesToSetDrawer = NiceModal.create(
  ({ deviceSetId, existingDeviceIds = [] }: AddDevicesToSetDrawerProps) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const queryClient = useQueryClient()
    const drawer = useDrawerController()
    const existingDeviceIdSet = useMemo(() => new Set(existingDeviceIds), [existingDeviceIds])

    const mutation = useMutation({
      mutationFn: () => assignDevicesToSetRequest(selectedIds, deviceSetId),
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: [...devicesQueryKeys.all, 'set-items', deviceSetId] }),
          queryClient.invalidateQueries({ queryKey: [...devicesQueryKeys.all, 'set-module', deviceSetId] }),
          queryClient.invalidateQueries({ queryKey: devicesQueryKeys.detail(deviceSetId) }),
          queryClient.invalidateQueries({ queryKey: devicesQueryKeys.all }),
        ])
        await drawer.forceClose()
      },
    })

    const queryFn = useCallback(
      async (search: string) => {
        const devices = await getDevicesListRequest({ isSet: false }, search)
        return devices.filter((device) => !existingDeviceIdSet.has(device.id))
      },
      [existingDeviceIdSet],
    )

    const errorMessage = mutation.error instanceof Error ? mutation.error.message : undefined
    const canSave = selectedIds.length > 0 && !mutation.isPending

    return (
      <AppDrawer title="Add devices to set" open={drawer.open} onOpenChange={drawer.onOpenChange}>
        {({ containerRef }) => (
          <>
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
              <MultiselectInputAsync
                label="Devices"
                placeholder="Select devices"
                required
                queryKey={[...devicesQueryKeys.all, 'assignable']}
                queryFn={queryFn}
                getOption={getDeviceOption}
                loadingMessage="Loading devices..."
                errorMessage="Failed to load devices."
                emptyMessage="No devices found."
                value={selectedIds}
                onValueChange={setSelectedIds}
                container={containerRef}
              />
            </div>

            <div className="flex flex-col gap-3 border-t px-6 py-4">
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => drawer.requestClose(false)}>
                  Cancel
                </Button>
                <Button onClick={() => mutation.mutate()} disabled={!canSave}>
                  {mutation.isPending
                    ? 'Adding…'
                    : `Add ${selectedIds.length || ''} device${selectedIds.length === 1 ? '' : 's'}`}
                </Button>
              </div>
              <FormError message={errorMessage} />
            </div>
          </>
        )}
      </AppDrawer>
    )
  },
)

export { AddDevicesToSetDrawer }
