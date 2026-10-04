import { useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { DropdownActionsMenu } from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/ui/page-header'
import { getPartnerRequest } from '@/features/partners/api'
import { PartnerUsersTable } from '@/features/partners/components/PartnerUsersTable'
import { partnersQueryKeys } from '@/features/partners/query-keys'
import { useDetailQuery } from '@/lib/query-hooks'
import { Drawer, DrawerId } from '@/providers/drawer'
import type { MaintenancePartner } from '@/types/partner'

function showCreateUserDrawer(partner: MaintenancePartner) {
  Drawer.show(DrawerId.CreateUser, { customerId: partner.id })
}

export default function PartnerPage() {
  const { partnerId = '' } = useParams()
  const {
    data: partner,
    isError,
    isLoading,
  } = useDetailQuery({
    queryKey: partnersQueryKeys.detail(partnerId),
    queryFn: () => getPartnerRequest(partnerId),
    enabled: Boolean(partnerId),
  })

  if (isLoading) {
    return <PageHeader title="Partner name" subtitle="Loading..." backTo="/partners" />
  }

  if (isError || !partner) {
    return (
      <>
        <PageHeader title="Partner not found" subtitle={partnerId} backTo="/partners" />
        <section className="p-4 md:p-6">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Failed to load this partner.
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={partner.name}
        backTo="/partners"
        commands={
          <div className="flex items-center gap-2">
            <Button size="lg" onClick={() => showCreateUserDrawer(partner)}>
              Add user
            </Button>
            <DropdownActionsMenu
              items={[
                {
                  label: 'Edit partner',
                  onClick: () => Drawer.show(DrawerId.CreatePartner, { partner }),
                },
              ]}
              align="end"
              triggerRender={<Button variant="outline" size="icon-lg" />}
            >
              ...
            </DropdownActionsMenu>
          </div>
        }
      />
      <section className="p-4 md:p-6">
        <PartnerUsersTable partner={partner} />
      </section>
    </>
  )
}
