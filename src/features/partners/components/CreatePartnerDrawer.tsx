import NiceModal from '@ebay/nice-modal-react'
import { useCallback, useMemo, useRef, useState } from 'react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { CreatePartnerForm } from '@/features/partners/components/CreatePartnerForm'
import { UserPermissionsStep } from '@/features/users/components/user-drawer-steps/UserPermissionsStep'
import { useLazyOrganizationTreeQuery } from '@/features/organizations/use-organization-tree'
import {
  getOverlayStepDescription,
  getOverlayStepTitle,
  useOverlaySteps,
  type OverlayStepDefinition,
} from '@/hooks/use-overlay-steps'
import { Modals } from '@/providers/modal'
import { useDrawerController } from '@/providers/use-overlay-controller'
import { UserRole } from '@/types/user'
import type { UserOrganizationPermission, UserRole as UserRoleType } from '@/types/user'
import type { MaintenancePartner } from '@/types/partner'

type PartnerDrawerStep = 'form' | 'permissions'

type PartnerDrawerData = {
  permissions?: UserOrganizationPermission[]
  formValues?: { name: string }
}

export type CreatePartnerDrawerProps = {
  partner?: MaintenancePartner
}

const CreatePartnerDrawer = NiceModal.create(({ partner }: CreatePartnerDrawerProps) => {
  const isFormDirtyRef = useRef(false)
  const isEditMode = !!partner?.id
  const [flowRole, setFlowRole] = useState<UserRoleType>(UserRole.MEMBER)
  const initialPermissions = useMemo(() => partner?.permissions ?? [], [partner?.permissions])
  const treeQuery = useLazyOrganizationTreeQuery()

  const stepsConfig = useMemo<OverlayStepDefinition<PartnerDrawerStep, PartnerDrawerData>[]>(
    () => [
      {
        id: 'form',
        title: isEditMode ? 'Edit maintenance partner' : 'Create maintenance partner',
        description: isEditMode ? 'Update partner name and access.' : 'Create a new maintenance partner.',
      },
      {
        id: 'permissions',
        title: 'Permissions',
        description: 'Select organizations this partner can access.',
      },
    ],
    [isEditMode],
  )

  const steps = useOverlaySteps<PartnerDrawerStep, PartnerDrawerData>({
    initialStep: 'form',
    initialData: { permissions: initialPermissions },
    steps: stepsConfig,
  })

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
  const title = getOverlayStepTitle(steps.current, steps.data)
  const description = getOverlayStepDescription(steps.current, steps.data)

  return (
    <AppDrawer
      title={title}
      description={description}
      showBackButton={steps.canGoBack}
      onBack={steps.pop}
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      dismissible={!isFormDirtyRef.current}
    >
      {steps.currentId === 'form' ? (
        <CreatePartnerForm
          partner={partner}
          role={flowRole}
          onRoleChange={setFlowRole}
          permissions={steps.data.permissions}
          tree={treeQuery.data ?? null}
          initialFormValues={steps.data.formValues}
          onOpenPermissions={(formValues) => {
            steps.patchData({ formValues })
            steps.push('permissions')
          }}
          onSaved={async () => {
            isFormDirtyRef.current = false
            await drawer.forceClose()
          }}
          onCancel={() => drawer.requestClose(false)}
          onDirtyChange={(dirty) => {
            isFormDirtyRef.current = dirty
          }}
        />
      ) : null}

      {steps.currentId === 'permissions' ? (
        <UserPermissionsStep
          role={flowRole}
          permissions={steps.data.permissions}
          onCancel={steps.pop}
          onConfirm={(permissions, role) => {
            setFlowRole(role as UserRole)
            steps.patchData({ permissions })
            steps.pop()
          }}
          showPosition={false}
        />
      ) : null}
    </AppDrawer>
  )
})

export { CreatePartnerDrawer }
