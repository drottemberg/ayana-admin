import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Link, useParams } from 'react-router-dom'

import { DetailPageLayout, DetailSidePanel, RelatedEntityModule, type DetailPanelSection } from '@/components/app/detail-page-layout'
import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { NO_VALUE_STR } from '@/constants'
import { useConnect } from '@/features/app/use-connect'
import { CoachProfileDrawer } from '@/features/coaches/CoachProfileDrawer'
import { getCoachProfileRequest } from '@/features/coaches/api'
import { coachesQueryKeys } from '@/features/coaches/query-keys'
import type { CoachClassQualification } from '@/features/coaches/types'
import { getAllLocationsForCustomerRequest } from '@/features/locations/api'
import { useDetailQuery } from '@/lib/query-hooks'
import { formatDateTime } from '@/utils/date-utils'

type CoachLocation = { id: string; name: string }

const classColumns: ColumnDef<CoachClassQualification>[] = [
  {
    accessorKey: 'name',
    header: 'Class',
    cell: ({ row }) => <Link className="font-medium underline-offset-2 hover:underline" to={`/classes/${row.original.id}`}>{row.original.name}</Link>,
  },
]

const locationColumns: ColumnDef<CoachLocation>[] = [
  {
    accessorKey: 'name',
    header: 'Location',
    cell: ({ row }) => <Link className="font-medium underline-offset-2 hover:underline" to={`/locations/${row.original.id}`}>{row.original.name}</Link>,
  },
]

function pageRows<T extends Record<string, unknown> & { name: string }>(items: T[], state: DataTableState<T>): DataTableAsyncResult<T> {
  const { pageIndex, pageSize } = state.pagination
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name) * (state.sorting[0]?.desc ? -1 : 1))
  return {
    items: sorted.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    count: sorted.length,
    pageCount: Math.max(1, Math.ceil(sorted.length / pageSize)),
  }
}

export default function CoachPage() {
  const { customerId = '', userId = '' } = useParams()
  const { session } = useConnect()
  const [editing, setEditing] = useState(false)
  const { data: coach, isLoading, isError } = useDetailQuery({
    queryKey: [...coachesQueryKeys.all, 'profile', customerId, userId],
    queryFn: () => getCoachProfileRequest(customerId, userId),
    enabled: Boolean(customerId && userId),
  })

  if (isLoading) {
    return <PageHeader title="Coach" subtitle="Loading…" backTo={`/customers/${customerId}`} />
  }
  if (isError || !coach) {
    return <PageHeader title="Coach not found" backTo={`/customers/${customerId}`} />
  }

  const sections: DetailPanelSection[] = [{
    title: 'Coach profile',
    fields: [
      { label: 'Customer', value: <Link className="underline-offset-2 hover:underline" to={`/customers/${customerId}`}>{coach.customerName || 'Customer'}</Link> },
      { label: 'User', value: <Link className="underline-offset-2 hover:underline" to={`/users/${userId}`}>{coach.coachName || coach.email || 'Instructor'}</Link> },
      { label: 'Email', value: coach.email || NO_VALUE_STR },
      { label: 'Locations', value: coach.locationScope === 'ALL' ? 'All locations' : `${coach.locations.length} assigned` },
      { label: 'Languages taught', value: coach.languages.join(', ') || NO_VALUE_STR },
      { label: 'Specialties', value: coach.specialties.join(', ') || NO_VALUE_STR },
      { label: 'Bio', value: coach.bio || NO_VALUE_STR },
      { label: 'Created', value: coach.createdAt ? formatDateTime(coach.createdAt) : NO_VALUE_STR },
    ],
  }]

  return <>
    <DetailPageLayout
      header={{
        title: coach.coachName || coach.email || 'Instructor',
        subtitle: coach.customerName || undefined,
        backTo: `/customers/${customerId}`,
        primaryAction: session?.permissions.coaches?.edit ? { children: 'Edit coach', onClick: () => setEditing(true) } : undefined,
      }}
      modules={[
        { key: 'class-types', label: 'Classes', count: coach.classTypes.length },
        { key: 'locations', label: 'Locations' },
      ]}
      aside={<DetailSidePanel sections={sections} />}
    >
      <RelatedEntityModule<CoachClassQualification>
        id="module-class-types"
        title="Classes"
        columns={classColumns}
        queryKey={[...coachesQueryKeys.all, 'profile-classes', customerId, userId, coach.updatedAt]}
        loadData={async (state) => pageRows(coach.classTypes, state)}
        tableKey={`coach.${customerId}.${userId}.classes`}
        emptyMessage="No classes assigned."
        showPagination
      />
      <RelatedEntityModule<CoachLocation>
        id="module-locations"
        title="Locations"
        columns={locationColumns}
        queryKey={[...coachesQueryKeys.all, 'profile-locations', customerId, userId, coach.updatedAt]}
        loadData={async (state) => {
          const locations = coach.locationScope === 'ALL'
            ? await getAllLocationsForCustomerRequest(customerId)
            : coach.locations
          return pageRows(locations, state)
        }}
        tableKey={`coach.${customerId}.${userId}.locations`}
        loadingMessage="Loading locations…"
        emptyMessage="No locations assigned."
        errorMessage="Could not load locations."
        showPagination
      />
    </DetailPageLayout>
    <CoachProfileDrawer
      customerId={customerId}
      customerName={coach.customerName}
      profile={coach}
      open={editing}
      onOpenChange={setEditing}
    />
  </>
}
