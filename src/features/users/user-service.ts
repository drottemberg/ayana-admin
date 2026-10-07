import { UserRole, UserRoleValues, UserStatus, UserStatusValues } from '@/types/user'
import { CustomerRole, CustomerRoleValues, StaffRole, StaffRoleValues } from '@/types/membership'
import type { DataTableCommand } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import type { PageHeaderProps } from '@/components/ui/page-header'
import { toast } from 'sonner'

import {
  activateUserRequest,
  archiveUserRequest,
  deactivateUserRequest,
  deleteUserRequest,
  resetUserPasswordRequest,
  unarchiveUserRequest,
} from '@/features/users/api'
import { usersQueryKeys } from '@/features/users/query-keys'
import { queryClient } from '@/lib/query-client'
import type { EntityPermissions } from '@/lib/entities/app-connect.entity'
import { Drawer, DrawerId } from '@/providers/drawer'
import { Modals } from '@/providers/modal'
import type { User } from '@/types/user'

export const UserRoleLabel: Record<UserRole, string> = {
  [UserRole.OWNER]: 'Owner',
  [UserRole.ADMIN]: 'Admin',
  [UserRole.MODERATOR]: 'Moderator',
  [UserRole.MEMBER]: 'Member',
  [UserRole.DISABLED]: 'Disabled',
}

export const StaffRoleLabel: Record<StaffRole, string> = {
  [StaffRole.SUPER_ADMIN]: 'Super admin',
  [StaffRole.ADMIN]: 'Admin',
  [StaffRole.SUPPORT]: 'Support',
}

export const CustomerRoleLabel: Record<CustomerRole, string> = {
  [CustomerRole.OWNER]: 'Owner',
  [CustomerRole.ADMIN]: 'Admin',
  [CustomerRole.MANAGER]: 'Manager',
  [CustomerRole.FRONT_DESK]: 'Front Desk',
  [CustomerRole.INSTRUCTOR]: 'Instructor',
  [CustomerRole.MEMBER]: 'Member',
}

export const UserStatusLabel: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: 'Active',
  [UserStatus.DISABLED]: 'Disabled',
  [UserStatus.ARCHIVED]: 'Archived',
  [UserStatus.DELETED]: 'Deleted',
}

export const UserService = {
  roleKeys(): UserRole[] {
    return [...UserRoleValues]
  },

  roleToString(role: UserRole): string {
    return UserRoleLabel[role] ?? role
  },

  staffRoleKeys(): StaffRole[] {
    return [...StaffRoleValues]
  },

  staffRoleToString(role: StaffRole): string {
    return StaffRoleLabel[role] ?? role
  },

  customerRoleKeys(): CustomerRole[] {
    return [...CustomerRoleValues]
  },

  customerRoleToString(role: CustomerRole): string {
    return CustomerRoleLabel[role] ?? role
  },

  userStatusKeys(): UserStatus[] {
    return [...UserStatusValues]
  },

  userStatusToString(status: UserStatus): string {
    return UserStatusLabel[status] ?? status
  },

  // Backend now sends `status` directly (UserEntity.getStatus()) — trust it when present.
  // Precedence for the client-side fallback: deleted > archived > active/disabled (a user can
  // be all three flags at once — disabled, then archived, then deleted — only the most
  // terminal one should show).
  getUserStatus(user: User): UserStatus {
    if (user.status) return user.status
    if (user.isDeleted) return UserStatus.DELETED
    if (user.isArchived) return UserStatus.ARCHIVED
    return user.isActive ? UserStatus.ACTIVE : UserStatus.DISABLED
  },

  async deleteUsers(users: User[]) {
    if (!users.length) return

    const confirmed = await Modals.confirm({
      operation: `delete ${users.length} user(s)`,
      okButtonProps: { variant: 'destructive' },
    })
    if (!confirmed) return

    await Promise.all(users.map((user) => deleteUserRequest(String(user.id))))
    await queryClient.invalidateQueries({ queryKey: usersQueryKeys.all })
  },

  async setActive(users: User[], isActive: boolean) {
    if (!users.length) return

    await Promise.all(
      users.map((user) => (isActive ? activateUserRequest(String(user.id)) : deactivateUserRequest(String(user.id)))),
    )
    await queryClient.invalidateQueries({ queryKey: usersQueryKeys.all })
  },

  async setArchived(users: User[], isArchived: boolean) {
    if (!users.length) return

    await Promise.all(
      users.map((user) => (isArchived ? archiveUserRequest(String(user.id)) : unarchiveUserRequest(String(user.id)))),
    )
    await queryClient.invalidateQueries({ queryKey: usersQueryKeys.all })
  },

  // POST /users/:id/reset-password — super-admin only (backend-enforced, ADMIN app context).
  // Forces a new temp password on the target and emails it to them directly (not a reset link).
  async resetPassword(user: User) {
    const confirmed = await Modals.confirm({
      title: 'Reset password?',
      content: `${user.email} will be emailed a new temporary password.`,
      okText: 'Reset',
    })
    if (!confirmed) return

    await resetUserPasswordRequest(String(user.id))
    toast.success(`Temporary password emailed to ${user.email}.`)
  },

  // Row/bulk actions are gated by the "users" entity permissions returned from app/connect
  // (spec §6.10: "row action based on permissions received with app.connect") — not a fixed
  // set of buttons. Disable/Enable rides on `edit` since PermissionResolver has no dedicated
  // bit for it (activate/deactivate require the same org role tier as edit on the backend).
  getActions(user: User, permissions?: EntityPermissions): DropdownActionItem[] {
    const actions: DropdownActionItem[] = []

    if (permissions?.edit) {
      actions.push({ label: 'Edit details', onClick: () => Drawer.show(DrawerId.CreateUser, { mode: 'edit-details', user }) })
      actions.push({ label: 'Edit permissions', onClick: () => Drawer.show(DrawerId.CreateUser, { mode: 'edit-permissions', user }) })
      actions.push({ label: 'Reset password', onClick: () => void this.resetPassword(user) })
      actions.push(
        user.isActive
          ? { label: 'Disable', onClick: () => void this.setActive([user], false) }
          : { label: 'Enable', onClick: () => void this.setActive([user], true) },
      )
    }

    if (permissions?.archive) {
      actions.push(
        user.isArchived
          ? { label: 'Unarchive', onClick: () => void this.setArchived([user], false) }
          : { label: 'Archive', onClick: () => void this.setArchived([user], true) },
      )
    }

    if (permissions?.delete) {
      actions.push({ label: 'Delete', variant: 'destructive', onClick: () => void this.deleteUsers([user]) })
    }

    return actions
  },

  getDetailActions(user: User, permissions?: EntityPermissions): DropdownActionItem[] {
    return [
      { type: 'label', label: 'User' },
      ...this.getActions(user, permissions),
    ]
  },

  getDetailHeaderActions(
    user: User,
    permissions?: EntityPermissions,
  ): Pick<PageHeaderProps, 'options'> {
    return {
      options: this.getDetailActions(user, permissions),
    }
  },

  getTableActions(users: User[], permissions?: EntityPermissions): DataTableCommand<User>[] {
    if (!permissions?.delete) return []

    return [
      {
        label: 'Delete',
        disabled: users.length === 0,
        variant: 'destructive',
        onClick: (usersToDelete) => void this.deleteUsers(usersToDelete),
      },
    ]
  },
}
