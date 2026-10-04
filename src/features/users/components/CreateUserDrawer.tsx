import NiceModal from '@ebay/nice-modal-react'
import { useCallback, useMemo, useRef, useState } from 'react'

import { AppDrawer } from '@/components/app/AppDrawer'

import { CreateUserStep } from '@/features/users/components/user-drawer-steps/CreateUserStep'
import { EditPermissionsStep } from '@/features/users/components/user-drawer-steps/EditPermissionsStep'
import { EditUserDetailsForm } from '@/features/users/components/EditUserDetailsForm'
import { InviteOpsStep } from '@/features/users/components/user-drawer-steps/InviteOpsStep'
import { InviteStaffStep } from '@/features/users/components/user-drawer-steps/InviteStaffStep'
import { InviteUserStep } from '@/features/users/components/user-drawer-steps/InviteUserStep'
import { InviteUserSuccessStep } from '@/features/users/components/user-drawer-steps/InviteUserSuccessStep'
import { OpsPermissionsStep } from '@/features/users/components/user-drawer-steps/OpsPermissionsStep'
import { UserActionStep } from '@/features/users/components/user-drawer-steps/UserActionStep'
import { UserPermissionsStep } from '@/features/users/components/user-drawer-steps/UserPermissionsStep'
import type {
  UserDrawerData,
  UserDrawerStep,
  UserFlowAction,
} from '@/features/users/components/user-drawer-steps/types'
import {
  getOverlayStepDescription,
  getOverlayStepTitle,
  useOverlaySteps,
  type OverlayStepDefinition,
} from '@/hooks/use-overlay-steps'
import { Drawer, DrawerId } from '@/providers/drawer'
import { Modals } from '@/providers/modal'
import { useDrawerController } from '@/providers/use-overlay-controller'
import { UserRole, type User } from '@/types/user'
import { CustomerRole, TechnicianRole } from '@/types/membership'
import { UserService } from '@/features/users/user-service'
import { createOrganizationPermission } from '@/features/users/components/user-drawer-steps/organization-permissions'

export type CreateUserDrawerProps = {
  user?: User
  customerId?: string
  mode?: 'create' | 'invite' | 'permissions' | 'edit-details' | 'edit-permissions' | 'view-permissions'
  permissionScope?: {
    kind: 'customer' | 'partner'
    organizationId: string
    readOnly?: boolean
    canEdit?: boolean
  }
}

const CreateUserDrawer = NiceModal.create(({ user, customerId, mode, permissionScope }: CreateUserDrawerProps) => {
  const isFormDirtyRef = useRef(false)
  const isEditMode = !!user?.id
  const initialStep: UserDrawerStep =
    mode === 'edit-details'
      ? 'edit-details'
      : mode === 'edit-permissions' || mode === 'view-permissions'
        ? 'edit-permissions'
        : mode === 'permissions'
          ? 'permissions'
          : isEditMode
            ? 'create'
            : mode === 'create' || mode === 'invite'
              ? mode
              : 'action'
  const initialAction: UserFlowAction | undefined = mode === 'create' || mode === 'invite' ? mode : undefined
  const initialRole = user?.role ?? UserRole.MEMBER
  const [flowRole, setFlowRole] = useState(initialRole)
  const [customerInviteRole, setCustomerInviteRole] = useState<CustomerRole>(CustomerRole.MEMBER)
  const [opsInviteRole, setOpsInviteRole] = useState<TechnicianRole>(TechnicianRole.TECHNICIAN)
  const [flowPosition, setFlowPosition] = useState(user?.position ?? '')
  const initialPermissions = useMemo(() => {
    if (user?.permissions?.length) return user.permissions
    if (customerId) return [createOrganizationPermission(customerId, initialRole)]

    return []
  }, [customerId, initialRole, user?.permissions])
  const stepsConfig = useMemo<OverlayStepDefinition<UserDrawerStep, UserDrawerData>[]>(
    () => [
      {
        id: 'action',
        title: 'Add user',
        description: 'Choose how this user should be added.',
      },
      {
        id: 'invite',
        title: 'Invite Customer User',
        description: 'Send an invitation to a customer contact.',
      },
      {
        id: 'invite-staff',
        title: 'Invite Staff',
        description: 'Send an invitation to a Gaudier staff member.',
      },
      {
        id: 'invite-ops',
        title: 'Invite Partner User',
        description: 'Send an invitation to a maintenance partner contact.',
      },
      {
        id: 'ops-permissions',
        title: 'Permissions',
        description: 'Choose which partners, customers, and stores this user can access.',
      },
      {
        id: 'create',
        title: isEditMode ? 'Edit user' : 'Create user',
        description: isEditMode ? 'Update user profile and access role.' : 'Create a user profile directly.',
      },
      {
        id: 'edit-details',
        title: 'Edit user details',
        description: 'Update name, phone, and password.',
      },
      {
        id: 'edit-permissions',
        title: mode === 'view-permissions' ? 'View permissions' : 'Edit permissions',
        description: mode === 'view-permissions' ? 'View this user’s access.' : 'Update this user’s access.',
      },
      {
        id: 'permissions',
        title: 'Permissions',
        description: 'Choose the user role for this workspace.',
      },
      {
        id: 'success',
        title: undefined,
        showHeader: false,
      },
    ],
    [isEditMode, mode],
  )
  const steps = useOverlaySteps<UserDrawerStep, UserDrawerData>({
    initialStep,
    initialData: { action: initialAction, permissions: initialPermissions },
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
      showHeader={steps.current.showHeader !== false}
      showBackButton={steps.canGoBack}
      onBack={steps.pop}
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      dismissible={!isFormDirtyRef.current}
    >
      {steps.currentId === 'action' ? (
        <UserActionStep
          onSelect={(action) => {
            steps.patchData({ action })
            steps.push(action)
          }}
        />
      ) : null}

      {steps.currentId === 'invite' ? (
        <InviteUserStep
          customerId={customerId}
          role={customerInviteRole}
          onRoleChange={setCustomerInviteRole}
          position={flowPosition}
          onPositionChange={setFlowPosition}
          permissions={steps.data.permissions}
          onOpenPermissions={(formValues) => {
            steps.patchData({ formValues: { email: formValues.email, position: formValues.position } })
            setFlowPosition(formValues.position)
            steps.push('permissions')
          }}
          onInvited={async () => {
            isFormDirtyRef.current = false
            steps.patchData({ action: 'invite', savedUser: undefined, savedPayload: undefined })
            steps.push('success')
          }}
          onCancel={() => drawer.requestClose(false)}
          onDirtyChange={(dirty) => {
            isFormDirtyRef.current = dirty
          }}
          initialFormValues={
            steps.data.formValues
              ? { email: steps.data.formValues.email, position: steps.data.formValues.position }
              : undefined
          }
        />
      ) : null}

      {steps.currentId === 'invite-staff' ? (
        <InviteStaffStep
          onInvited={async () => {
            isFormDirtyRef.current = false
            steps.patchData({ action: 'invite-staff', savedUser: undefined, savedPayload: undefined })
            steps.push('success')
          }}
          onCancel={() => drawer.requestClose(false)}
          onDirtyChange={(dirty) => {
            isFormDirtyRef.current = dirty
          }}
        />
      ) : null}

      {steps.currentId === 'invite-ops' ? (
        <InviteOpsStep
          role={opsInviteRole}
          onRoleChange={setOpsInviteRole}
          selectedIds={steps.data.opsSelectedIds ?? []}
          onOpenPermissions={(formValues) => {
            steps.patchData({ formValues: { email: formValues.email } })
            steps.push('ops-permissions')
          }}
          onInvited={async () => {
            isFormDirtyRef.current = false
            steps.patchData({ action: 'invite-ops', savedUser: undefined, savedPayload: undefined })
            steps.push('success')
          }}
          onCancel={() => drawer.requestClose(false)}
          onDirtyChange={(dirty) => {
            isFormDirtyRef.current = dirty
          }}
          initialFormValues={steps.data.formValues ? { email: steps.data.formValues.email } : undefined}
        />
      ) : null}

      {steps.currentId === 'ops-permissions' ? (
        <OpsPermissionsStep
          role={opsInviteRole}
          selectedIds={steps.data.opsSelectedIds ?? []}
          onCancel={steps.canGoBack ? steps.pop : () => drawer.requestClose(false)}
          onConfirm={(selectedIds, role) => {
            setOpsInviteRole(role)
            steps.patchData({ opsSelectedIds: selectedIds })
            steps.pop()
          }}
        />
      ) : null}

      {steps.currentId === 'edit-details' && user ? (
        <EditUserDetailsForm
          user={user}
          onSaved={async (savedUser) => {
            isFormDirtyRef.current = false
            await drawer.forceClose(savedUser)
          }}
          onCancel={() => drawer.requestClose(false)}
          onDirtyChange={(dirty) => {
            isFormDirtyRef.current = dirty
          }}
        />
      ) : null}

      {steps.currentId === 'edit-permissions' && user ? (
        <EditPermissionsStep
          user={user}
          permissionScope={permissionScope}
          onEditFullPermissions={
            mode === 'view-permissions' && permissionScope?.canEdit
              ? async () => {
                  await drawer.forceClose(user)
                  window.setTimeout(() => {
                    Drawer.show(DrawerId.CreateUser, { user, mode: 'edit-permissions' })
                  }, 120)
                }
              : undefined
          }
        />
      ) : null}

      {steps.currentId === 'create' && !user ? (
        <CreateUserStep
          customerId={customerId}
          role={flowRole}
          onRoleChange={setFlowRole}
          position={flowPosition}
          onPositionChange={setFlowPosition}
          permissions={steps.data.permissions}
          onOpenPermissions={(formValues) => {
            steps.patchData({ formValues })
            setFlowPosition(formValues.position)
            steps.push('permissions')
          }}
          onSaved={async (savedUser, savedPayload) => {
            isFormDirtyRef.current = false
            steps.patchData({ action: 'create', savedUser, savedPayload })
            steps.push('success')
          }}
          onCancel={() => drawer.requestClose(false)}
          onDirtyChange={(dirty) => {
            isFormDirtyRef.current = dirty
          }}
          initialFormValues={getUserFormValues(steps.data.formValues)}
        />
      ) : null}

      {steps.currentId === 'permissions' ? (
        <UserPermissionsStep
          user={user}
          role={steps.data.action === 'invite' ? customerInviteRole : flowRole}
          roleOptions={
            steps.data.action === 'invite'
              ? UserService.customerRoleKeys().map((r) => ({ value: r, label: UserService.customerRoleToString(r) }))
              : undefined
          }
          position={flowPosition}
          permissions={steps.data.permissions}
          onCancel={steps.canGoBack ? steps.pop : () => drawer.requestClose(false)}
          onConfirm={(permissions, role, position) => {
            if (steps.data.action === 'invite') {
              setCustomerInviteRole(role as CustomerRole)
            } else {
              setFlowRole(role as UserRole)
            }
            setFlowPosition(position)
            steps.patchData({ permissions })
            if (steps.canGoBack) {
              steps.pop()
              return
            }

            void drawer.forceClose(user)
          }}
        />
      ) : null}

      {steps.currentId === 'success' ? (
        <InviteUserSuccessStep
          action={steps.data.action}
          user={steps.data.savedUser}
          onCreateAnother={() => {
            steps.patchData((data) => ({
              action: data.action,
              permissions: initialPermissions,
              opsSelectedIds: [],
              savedUser: undefined,
              savedPayload: undefined,
            }))
            setFlowRole(initialRole)
            steps.popToRoot()
          }}
          onClose={() => drawer.forceClose(steps.data.savedUser)}
        />
      ) : null}
    </AppDrawer>
  )
})

export { CreateUserDrawer }

function getUserFormValues(values: UserDrawerData['formValues']) {
  if (!values) return undefined

  return {
    firstName: values.firstName ?? '',
    lastName: values.lastName ?? '',
    email: values.email,
    password: values.password,
    phone: values.phone ?? '',
    position: values.position ?? '',
  }
}
