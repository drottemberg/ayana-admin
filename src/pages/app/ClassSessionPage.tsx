import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { RelatedEntityModule, DetailPageLayout, DetailSidePanel, type DetailPanelSection } from '@/components/app/detail-page-layout'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { EntityIcon } from '@/components/app/entity-icons'
import { NO_VALUE_STR } from '@/constants'
import { classBookingColumns } from '@/features/classes/class-session-columns'
import { ClassSessionEditDrawer } from '@/features/classes/ClassSessionEditDrawer'
import { cancelClassSessionRequest, getClassBookingsRequest, getClassSessionRequest } from '@/features/classes/api'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import { useDetailQuery } from '@/lib/query-hooks'
import { useConnect } from '@/features/app/use-connect'
import { Modals } from '@/providers/modal'
import type { ClassSession } from '@/types/class-type'

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : NO_VALUE_STR
}

export default function ClassSessionPage() {
  const { sessionId = '' } = useParams()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const locationId = searchParams.get('locationId') ?? ''
  const { session: appSession } = useConnect()
  const { data, isLoading, isError } = useDetailQuery({
    queryKey: classSessionsQueryKeys.detail(sessionId),
    queryFn: () => getClassSessionRequest(sessionId, locationId),
    enabled: Boolean(sessionId && locationId),
  })
  const classSession = data as ClassSession | undefined
  const resolvedLocationId = classSession?.organizationId ?? locationId

  const cancelSession = async () => {
    if (!classSession) return
    const confirmed = await Modals.confirm({
      title: 'Cancel this class session?',
      content: <p>All bookings will be cancelled. Members with an email address will be notified, and used contract credits will be returned.</p>,
      okText: 'Cancel session',
      cancelText: 'Keep session',
      okButtonProps: { variant: 'destructive' },
    })
    if (!confirmed) return
    try {
      const result = await cancelClassSessionRequest(classSession.id, resolvedLocationId)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: [...classSessionsQueryKeys.detail(sessionId), 'bookings'] }),
      ])
      toast.success(`Session cancelled. ${result.bookingCount} booking(s) cancelled; ${result.creditsReturned} credit(s) returned.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cancel the class session.')
    }
  }

  const sections: DetailPanelSection[] = [{
    title: 'Session details',
    icon: EntityIcon.classes,
    fields: [
      { label: 'Status', value: classSession ? <Badge variant="outline">{classSession.status}</Badge> : NO_VALUE_STR },
      { label: 'ID', value: classSession?.id ?? sessionId },
      { label: 'Class', value: classSession?.classTypeId ? <Link to={`/classes/${classSession.classTypeId}?locationId=${encodeURIComponent(resolvedLocationId)}`} className="underline-offset-2 hover:underline">{classSession.className || classSession.classTypeId}</Link> : NO_VALUE_STR },
      { label: 'Category', value: classSession?.classCategory || NO_VALUE_STR },
      { label: 'Format', value: classSession?.type ?? NO_VALUE_STR },
      { label: 'Starts', value: formatDate(classSession?.startTime) },
      { label: 'Ends', value: formatDate(classSession?.endTime) },
      { label: 'Capacity', value: classSession ? `${classSession.bookedCount} / ${classSession.capacity}` : NO_VALUE_STR },
      { label: 'Coach', value: classSession?.coachName || classSession?.coachId || NO_VALUE_STR },
      { label: 'Schedule', value: classSession?.scheduleId ?? NO_VALUE_STR },
      { label: 'Location', value: resolvedLocationId ? <Link to={`/locations/${resolvedLocationId}`} className="underline-offset-2 hover:underline">{classSession?.locationName || resolvedLocationId}</Link> : NO_VALUE_STR },
    ],
  }]

  if (isError || (!isLoading && !classSession)) {
    return <><PageHeader title="Session not found" subtitle={sessionId} backTo="/class-sessions" /><section className="p-4 md:p-6"><div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Failed to load this class session.</div></section></>
  }

  return <DetailPageLayout
    header={{
      title: classSession?.className ?? 'Class session',
      subtitle: formatDate(classSession?.startTime),
      backTo: '/class-sessions',
      primaryAction: classSession?.status === 'SCHEDULED' && appSession?.permissions.classSessions?.edit
        ? { children: 'Edit session', onClick: () => setIsEditOpen(true) }
        : undefined,
      secondaryAction: (classSession?.status === 'SCHEDULED' || classSession?.status === 'PAUSED') && appSession?.permissions.classSessions?.delete
        ? { children: 'Cancel session', variant: 'destructive', onClick: cancelSession }
        : undefined,
    }}
    modules={[{ key: 'bookings', label: 'Bookings', count: classSession?.bookedCount }]}
    aside={<DetailSidePanel sections={sections} isLoading={isLoading} />}
  >
    <RelatedEntityModule
      id="module-bookings"
      title="Bookings"
      icon={EntityIcon.users}
      queryKey={[...classSessionsQueryKeys.detail(sessionId), 'bookings']}
      loadData={async (state) => {
        const rows = await getClassBookingsRequest(resolvedLocationId, sessionId)
        const { pageIndex, pageSize } = state.pagination
        return { items: rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), count: rows.length, pageCount: Math.ceil(rows.length / pageSize) }
      }}
      tableKey={`class-sessions.detail.bookings.${sessionId}`}
      columns={classBookingColumns}
      loadingMessage="Loading bookings..."
      emptyMessage="No bookings for this session."
      errorMessage="Failed to load bookings."
      showPagination
      refetchOnMount="always"
    />
    <ClassSessionEditDrawer
      session={classSession ?? null}
      locationId={resolvedLocationId}
      open={isEditOpen}
      onOpenChange={setIsEditOpen}
    />
  </DetailPageLayout>
}
