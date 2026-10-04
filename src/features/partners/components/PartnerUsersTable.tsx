import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { useConnect } from '@/features/app/use-connect'
import { getUsersRequest } from '@/features/users/api'
import { usersQueryKeys } from '@/features/users/query-keys'
import { getUserListColumns } from '@/features/users/user-columns'
import { Drawer, DrawerId } from '@/providers/drawer'
import type { MaintenancePartner } from '@/types/partner'
import { type User } from '@/types/user'
import { getPortalSafe } from '@/utils/portal-utils'

type PartnerUsersTableProps = {
  partner: MaintenancePartner
}

export function PartnerUsersTable({ partner }: PartnerUsersTableProps) {
  const { session } = useConnect()

  return (
    <DataTableAsync
      queryKey={usersQueryKeys.organization(partner.id)}
      loadData={(tableState: DataTableState<User>) => getUsersRequest(tableState, { partnerId: partner.id })}
      tableKey="partners.detail.users"
      columns={getUserListColumns({
        usage: 'partner-details',
        portal: getPortalSafe(),
        partnerId: partner.id,
        canEditPermissions: session?.permissions.users?.edit,
      })}
      searchPlaceholder="Search by name..."
      searchColumns={['firstName', 'lastName', 'email']}
      filters={[
        {
          id: 'role',
          label: 'Role',
          column: 'role',
          getValue: (user) =>
            user.technicianMemberships?.find((membership) => membership.partnerId === partner.id)?.role,
        },
      ]}
      getCommands={() => []}
      loadingMessage="Loading users..."
      emptyMessage="No users found"
      emptyAction={{
        name: 'Add user',
        onClick: () => Drawer.show(DrawerId.CreateUser, { customerId: partner.id }),
      }}
    />
  )
}
