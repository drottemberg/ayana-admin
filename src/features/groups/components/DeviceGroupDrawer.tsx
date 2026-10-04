import NiceModal from '@ebay/nice-modal-react'
import { useCallback, useRef } from 'react'

import { GroupDrawerBase } from '@/features/groups/components/GroupDrawerBase'
import { createDeviceGroupRequest, renameDeviceGroupRequest } from '@/features/groups/api'
import { deviceGroupsQueryKeys } from '@/features/groups/query-keys'
import { Modals } from '@/providers/modal'
import { useDrawerController } from '@/providers/use-overlay-controller'
import type { DeviceGroup } from '@/types/group'

export type DeviceGroupDrawerProps = {
  group?: DeviceGroup
}

export const DeviceGroupDrawer = NiceModal.create(({ group }: DeviceGroupDrawerProps) => {
  const isFormDirtyRef = useRef(false)
  const canClose = useCallback(() => {
    if (!isFormDirtyRef.current) return true

    return Modals.confirm({
      title: 'Discard changes?',
      content: 'You have unsaved changes. If you close this drawer, they will be lost.',
      okText: 'Discard',
      cancelText: 'Keep editing',
      okButtonProps: { variant: 'destructive' },
    })
  }, [])
  const drawer = useDrawerController({ canClose })

  return (
    <GroupDrawerBase
      key={`${group?.id ?? 'create'}:${group?.name ?? ''}`}
      open={drawer.open}
      group={group}
      entityLabel="Device Group"
      queryKey={deviceGroupsQueryKeys.all}
      detailQueryKey={deviceGroupsQueryKeys.detail}
      onOpenChange={drawer.onOpenChange}
      onCancel={() => {
        void drawer.requestClose(false)
      }}
      onSaved={async () => {
        await drawer.forceClose()
      }}
      onDirtyChange={(dirty) => {
        isFormDirtyRef.current = dirty
      }}
      dismissible={!isFormDirtyRef.current}
      createGroup={createDeviceGroupRequest}
      renameGroup={renameDeviceGroupRequest}
    />
  )
})
