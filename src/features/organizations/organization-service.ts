import type { DataTableCommand } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import {
  archiveCustomerRequest,
  deleteCustomerRequest,
  setCustomerStatusRequest,
  unarchiveCustomerRequest,
} from '@/features/customers/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import {
  archiveStoreRequest,
  deleteStoreRequest,
  setStoreStatusRequest,
  unarchiveStoreRequest,
} from '@/features/stores/api'
import { storesQueryKeys } from '@/features/stores/query-keys'
import { queryClient } from '@/lib/query-client'
import type { EntityPermissions } from '@/lib/entities/app-connect.entity'
import { Drawer, DrawerId } from '@/providers/drawer'
import { Modals } from '@/providers/modal'
import type { Store } from '@/types/customer'
import { OrganizationStatus, OrganizationType, type Organization } from '@/types/organization'

type OrganizationListKind = 'customer' | 'store'

type OrganizationListConfig<TOrganization extends Organization> = {
  kind: OrganizationListKind
  organizations: TOrganization[]
  /** Omit to keep showing every action — pass to gate by app/connect permissions. */
  permissions?: EntityPermissions
}

type OrganizationActionsConfig<TOrganization extends Organization> = {
  kind: OrganizationListKind
  organization: TOrganization
  permissions?: EntityPermissions
}

const organizationQueryKeyByKind: Record<OrganizationListKind, readonly unknown[]> = {
  customer: customersQueryKeys.all,
  store: storesQueryKeys.all,
}

const organizationLabelByKind: Record<OrganizationListKind, string> = {
  customer: 'customer',
  store: 'store',
}

const deleteRequestByKind: Record<OrganizationListKind, (id: string) => Promise<void>> = {
  customer: deleteCustomerRequest,
  store: deleteStoreRequest,
}

const setStatusRequestByKind: Record<OrganizationListKind, (id: string, status: OrganizationStatus) => Promise<void>> =
  {
    customer: setCustomerStatusRequest,
    store: setStoreStatusRequest,
  }

const archiveRequestByKind: Partial<Record<OrganizationListKind, (id: string) => Promise<void>>> = {
  customer: archiveCustomerRequest,
  store: archiveStoreRequest,
}

const unarchiveRequestByKind: Partial<Record<OrganizationListKind, (id: string) => Promise<void>>> = {
  customer: unarchiveCustomerRequest,
  store: unarchiveStoreRequest,
}

export const OrganizationService = {
  async deleteOrganizations(organizations: Organization[], kind: OrganizationListKind) {
    if (!organizations.length) return

    const label = organizationLabelByKind[kind]
    const confirmed = await Modals.confirm({
      operation: `delete ${organizations.length} ${label}(s)`,
      okButtonProps: { variant: 'destructive' },
    })
    if (!confirmed) return

    const deleteRequest = deleteRequestByKind[kind]
    await Promise.all(organizations.map((organization) => deleteRequest(organization.id)))
    await queryClient.invalidateQueries({ queryKey: organizationQueryKeyByKind[kind] })
  },

  async setStatus(organization: Organization, status: 'ACTIVE' | 'PENDING', kind: OrganizationListKind) {
    await setStatusRequestByKind[kind](organization.id, status)
    await queryClient.invalidateQueries({ queryKey: organizationQueryKeyByKind[kind] })
  },

  async setArchived(organizations: Organization[], isArchived: boolean, kind: OrganizationListKind) {
    if (!organizations.length) return

    const request = isArchived ? archiveRequestByKind[kind] : unarchiveRequestByKind[kind]
    if (!request) return

    await Promise.all(organizations.map((organization) => request(organization.id)))
    await queryClient.invalidateQueries({ queryKey: organizationQueryKeyByKind[kind] })
  },

  // Edit, Archive, Destroy, Disable/Enable are gated by app/connect permissions when supplied.
  getActions<TOrganization extends Organization>(
    config: OrganizationActionsConfig<TOrganization>,
  ): DropdownActionItem[] {
    const { kind, organization, permissions } = config
    const isDeleted = organization.isDeleted
    const isActive = !isDeleted && organization.status === OrganizationStatus.ACTIVE
    const canArchiveKind = Boolean(archiveRequestByKind[kind])

    const openEdit = () => {
      const type = organization.type
      if (type === OrganizationType.CUSTOMER) Drawer.show(DrawerId.CreateCustomer, { customer: organization })
      else if (type === OrganizationType.STORE)
        Drawer.show(DrawerId.CreateStore, { store: organization as unknown as Store })
    }

    // Deleted organizations have no actions until the backend provides an undelete route.
    if (isDeleted) return []

    const actions: DropdownActionItem[] = []

    if (!permissions || permissions.edit) {
      actions.push({ label: 'Edit', onClick: () => openEdit() })
      actions.push(
        isActive
          ? { label: 'Disable', onClick: () => void this.setStatus(organization, 'PENDING', kind) }
          : { label: 'Enable', onClick: () => void this.setStatus(organization, 'ACTIVE', kind) },
      )
    }

    if (canArchiveKind && (!permissions || permissions.archive)) {
      actions.push(
        organization.isArchived
          ? { label: 'Unarchive', onClick: () => void this.setArchived([organization], false, kind) }
          : { label: 'Archive', onClick: () => void this.setArchived([organization], true, kind) },
      )
    }

    if (!permissions || permissions.delete) {
      actions.push({
        label: 'Delete',
        variant: 'destructive',
        onClick: () => void this.deleteOrganizations([organization], kind),
      })
    }

    return actions
  },

  getTableActions<TOrganization extends Organization>(
    config: OrganizationListConfig<TOrganization>,
  ): DataTableCommand<TOrganization>[] {
    const { kind, organizations, permissions } = config
    if (permissions && !permissions.delete) return []

    const noSelection = organizations.length === 0

    return [
      {
        label: 'Delete',
        disabled: noSelection,
        variant: 'destructive',
        onClick: (organizations) => void this.deleteOrganizations(organizations, kind),
      },
    ]
  },
}
