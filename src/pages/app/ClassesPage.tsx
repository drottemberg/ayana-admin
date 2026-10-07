import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { getCustomersListRequest } from '@/features/customers/api'
import { getClassTypesRequest, getClassTypeLocationOptions, getClassCategoryOptions } from '@/features/classes/api'
import { getClassTypeColumns } from '@/features/classes/class-type-columns'
import { classTypesQueryKeys } from '@/features/classes/query-keys'
import { ClassTypeService } from '@/features/classes/class-type-service'
import { ClassTypeEditDrawer } from '@/features/classes/ClassTypeEditDrawer'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import type { ClassType } from '@/types/class-type'

const statusOptions = ['ACTIVE', 'DISABLED']

export default function ClassesPage() {
  const [editingClassType, setEditingClassType] = useState<ClassType | null>(null)
  const { session } = useConnect()
  const isAdminContext = getAppMode() === 'admin'
  const currentCustomerId = session?.currentOrganization?.id
  const [searchParams] = useSearchParams()
  const filterCustomerId = searchParams.get('filterCustomerId')
  const filterLocationId = searchParams.get('filterLocationId')
  const initialFilters = {
    ...(isAdminContext && filterCustomerId ? { customerId: [filterCustomerId] } : {}),
    ...(filterLocationId ? { locationId: [filterLocationId] } : {}),
  }
  const columns = useMemo(() => getClassTypeColumns({ showCustomer: isAdminContext, showLocation: true }), [isAdminContext])

  return (
    <>
      <PageHeader title="Classes" subtitle="Manage class types across customers and locations." />
      <section className="p-4 md:p-6">
        <DataTableAsync
          queryKey={[...classTypesQueryKeys.all, 'table']}
          loadData={(state: DataTableState<ClassType>) => getClassTypesRequest(state, !isAdminContext && currentCustomerId ? { customerId: currentCustomerId } : undefined)}
          refetchOnMount="always"
          tableKey="class-types.root"
          initialFilters={Object.keys(initialFilters).length ? initialFilters : undefined}
          columns={columns}
          getRowCommands={(classType) => ClassTypeService.getRowActions(classType, {
            canEdit: Boolean(session?.permissions.customers?.edit),
            onEdit: setEditingClassType,
          })}
          disabledSelection
          searchPlaceholder="Search by name or ID"
          searchColumns={['id', 'name', 'category']}
          filters={[
            {
              id: 'category', label: 'Category', column: 'category' as const,
              selectionMode: 'single' as const,
              queryFn: getClassCategoryOptions,
              getValue: (classType: ClassType) => classType.category,
            },
            ...(!isAdminContext ? [] : [{
              id: 'customerId',
              label: 'Customer',
              column: 'customerId' as const,
              selectionMode: 'single' as const,
              queryFn: async (search: string) => {
                const customers = await getCustomersListRequest(undefined, search)
                return { items: customers.map((customer) => ({ id: customer.id, label: customer.name })), total: customers.length }
              },
              getValue: (classType: ClassType) => classType.customerId,
            }]),
            {
              id: 'locationId',
              label: 'Location',
              column: 'locationId' as const,
              selectionMode: 'single' as const,
              queryFn: getClassTypeLocationOptions,
              getValue: (classType: ClassType) => classType.locationId,
            },
            {
              id: 'status',
              label: 'Status',
              column: 'status' as const,
              options: statusOptions,
              getValue: (classType: ClassType) => classType.status,
            },
          ]}
          loadingMessage="Loading classes..."
          emptyMessage="No classes found."
          errorMessage="Failed to load classes."
        />
      </section>
      <ClassTypeEditDrawer
        classType={editingClassType}
        open={Boolean(editingClassType)}
        onOpenChange={(open) => { if (!open) setEditingClassType(null) }}
      />
    </>
  )
}
