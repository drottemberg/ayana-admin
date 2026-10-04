import type { DataTableCommand } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import {
  archiveCustomerRequest,
  deleteCustomerRequest,
  setCustomerStatusRequest,
  unarchiveCustomerRequest,
} from '@/features/customers/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { deletePartnerRequest, setPartnerStatusRequest } from '@/features/partners/api'
import { partnersQueryKeys } from '@/features/partners/query-keys'
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

type OrganizationListKind = 'customer' | 'store' | 'partner'

type OrganizationListConfig<TOrganization extends Organization> = {
  kind: OrganizationListKind
  organizations: TOrganization[]
  /** Omit to keep showing every action (existing Store/Partner pages) — pass to gate by app/connect permissions (Customers page, per spec §6.2). */
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
  partner: partnersQueryKeys.all,
}

const organizationLabelByKind: Record<OrganizationListKind, string> = {
  customer: 'customer',
  store: 'store',
  partner: 'partner',
}

// Real, guarded per-entity routes (/customers/*, /stores/*, /maintenance-partners/*) — the
// generic /organizations/:id this service used to call was removed from the backend (see
// gkManager-backend/src/organizations/organizations.module.ts's comment).
const deleteRequestByKind: Record<OrganizationListKind, (id: string) => Promise<void>> = {
  customer: deleteCustomerRequest,
  store: deleteStoreRequest,
  partner: deletePartnerRequest,
}

const setStatusRequestByKind: Record<OrganizationListKind, (id: string, status: OrganizationStatus) => Promise<void>> =
  {
    customer: setCustomerStatusRequest,
    store: setStoreStatusRequest,
    partner: setPartnerStatusRequest,
  }

// No archive endpoint exists for partners yet (checked maintenance-partners.controller.ts) —
// archive/unarchive is simply unavailable for that kind until backend adds it.
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

  // §6.2/§6.3: Edit, Archive, Destroy, Disable/Enable — gated by app/connect permissions when
  // supplied (Ops on Customers is view-only: create/edit/delete/archive all false, per
  // PermissionResolver.opsResolve). Omitting `permissions` keeps every action visible, so
  // existing Store/Partner callers (which don't yet pass permissions) are unaffected.
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
      else if (type === OrganizationType.MAINTENANCE) Drawer.show(DrawerId.CreatePartner, { partner: organization })
      else if (type === OrganizationType.STORE)
        Drawer.show(DrawerId.CreateStore, { store: organization as unknown as Store })
    }

    // NOT YET AVAILABLE ON BACKEND: no restore/undelete endpoint exists for organizations
    // (checked customers/stores/maintenance-partners controllers — only DELETE :id, no
    // reverse; PATCH :id/status only ever writes the `status` column, never isDeleted). Flagged
    // for backend; a deleted row has no actions here until a real undelete route exists.
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
