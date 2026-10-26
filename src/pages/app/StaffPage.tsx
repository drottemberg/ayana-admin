import { PageHeader } from '@/components/ui/page-header'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import { UsersTable } from '@/pages/app/UsersPage'
import { Drawer, DrawerId } from '@/providers/drawer'

export default function StaffPage() {
  const { session } = useConnect()
  const isCustomerContext = getAppMode() === 'customer'
  const customerId = session?.currentOrganization?.id
  const canInvite = Boolean(session?.can('users', 'create')) && (!isCustomerContext || Boolean(customerId))
  const hiddenFilters = {
    userDirectory: 'staff',
    ...(isCustomerContext && customerId ? { organizationId: customerId } : {}),
  }

  return (
    <>
      <PageHeader
        title="Staff"
        primaryAction={canInvite ? {
          children: 'Invite staff',
          onClick: () => Drawer.show(DrawerId.CreateUser, isCustomerContext
            ? { mode: 'invite', customerId }
            : { mode: 'invite-staff' }),
        } : undefined}
      />
      <section className="p-4 md:p-6">
        <UsersTable
          userDirectory="staff"
          hiddenFilters={hiddenFilters}
          tableKey="staff.root"
        />
      </section>
    </>
  )
}
