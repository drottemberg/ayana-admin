import { DataTableAsync } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { OrganizationService } from '@/features/organizations/organization-service'
import { getPartnersRequest } from '@/features/partners/api'
import { partnerColumns } from '@/features/partners/partner-columns'
import { partnersQueryKeys } from '@/features/partners/query-keys'
import { Drawer, DrawerId } from '@/providers/drawer'

export default function PartnersPage() {
  return (
    <>
      <PageHeader
        title="Maintenance Partners"
        primaryAction={{
          children: 'Create new partner',
          onClick: () => Drawer.show(DrawerId.CreatePartner, {}),
        }}
      />
      <section className="p-4 md:p-6">
        <DataTableAsync
          queryKey={[...partnersQueryKeys.all, 'table']}
          loadData={getPartnersRequest}
          tableKey="partners.root"
          columns={partnerColumns}
          searchPlaceholder="Search by name..."
          searchColumns={['name']}
          getCommands={(partners) =>
            OrganizationService.getTableActions({
              kind: 'partner',
              organizations: partners,
            })
          }
          getRowCommands={(partner) =>
            OrganizationService.getActions({
              kind: 'partner',
              organization: partner
            })
          }
          loadingMessage="Loading partners..."
          emptyMessage="No maintenance partners found."
          emptyAction={{ name: 'Create new partner', onClick: () => Drawer.show(DrawerId.CreatePartner, {}) }}
          errorMessage="Failed to load partners."
        />
      </section>
    </>
  )
}
