import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailPageLayout, DetailSidePanel, type DetailPanelSection } from '@/components/app/detail-page-layout'
import { PageHeader } from '@/components/ui/page-header'
import { useDetailQuery } from '@/lib/query-hooks'
import { bookingsQueryKeys } from '@/features/bookings/query-keys'
import { getBookingManagementDetailsRequest } from '@/features/bookings/api'
import type { BookingManagementDetails } from '@/types/booking'
import { NO_VALUE_STR } from '@/constants'

const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : NO_VALUE_STR
const personName = (user?: BookingManagementDetails['user'] | null) => user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.id : NO_VALUE_STR

function getSections(booking?: BookingManagementDetails): DetailPanelSection[] {
  return [{
    title: 'Booking',
    fields: [
      { label: 'Status', value: booking ? <Badge variant="outline">{booking.status.replaceAll('_', ' ')}</Badge> : NO_VALUE_STR },
      { label: 'Booking ID', value: booking?.id ?? NO_VALUE_STR },
      { label: 'Booked', value: formatDateTime(booking?.createdAt) },
      { label: 'Checked in', value: formatDateTime(booking?.checkInAt) },
      { label: 'Cancelled', value: formatDateTime(booking?.cancelledAt) },
      { label: 'Late cancellation penalty', value: booking?.penaltyApplied ? 'Applied' : 'No' },
    ],
  }, {
    title: 'People and organization',
    fields: [
      { label: 'Member', value: booking?.user ? <Link to={`/users/${booking.user.id}`} className="underline-offset-2 hover:underline">{personName(booking.user)}</Link> : NO_VALUE_STR },
      { label: 'Email', value: booking?.user.email ? <a href={`mailto:${booking.user.email}`} className="underline-offset-2 hover:underline">{booking.user.email}</a> : NO_VALUE_STR },
      { label: 'Phone', value: booking?.user.phone ? <a href={`tel:${booking.user.phone}`} className="underline-offset-2 hover:underline">{booking.user.phone}</a> : NO_VALUE_STR },
      { label: 'Customer', value: booking?.customer ? <Link to={`/customers/${booking.customer.id}`} className="underline-offset-2 hover:underline">{booking.customer.name}</Link> : NO_VALUE_STR },
      { label: 'Location', value: booking?.location ? <Link to={`/locations/${booking.location.id}`} className="underline-offset-2 hover:underline">{booking.location.name}</Link> : NO_VALUE_STR },
    ],
  }]
}

export default function BookingPage() {
  const { bookingId = '' } = useParams()
  const { data, isError, isLoading } = useDetailQuery({
    queryKey: bookingsQueryKeys.detail(bookingId),
    queryFn: () => getBookingManagementDetailsRequest(bookingId),
    enabled: Boolean(bookingId),
  })

  if (isLoading) return <DetailPageLayout header={{ title: 'Booking', subtitle: 'Loading...', backTo: '/bookings' }} aside={<DetailSidePanel sections={getSections()} isLoading />}>
    <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Loading booking details...</div>
  </DetailPageLayout>

  if (isError || !data) return <>
    <PageHeader title="Booking not found" subtitle={bookingId} backTo="/bookings" />
    <section className="p-4 md:p-6"><div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Failed to load this booking.</div></section>
  </>

  const { session, clientContract, creditMovements } = data
  return <DetailPageLayout
    header={{ title: `Booking · ${personName(data.user)}`, subtitle: data.id, backTo: '/bookings' }}
    modules={[{ key: 'session', label: 'Class session' }, { key: 'credits', label: 'Credit usage', count: creditMovements.length }]}
    aside={<DetailSidePanel sections={getSections(data)} />}
  >
    <Card id="module-session" className="border border-border p-0 ring-0">
      <CardHeader className="border-b p-5"><CardTitle>Class session</CardTitle></CardHeader>
      <CardContent className="grid gap-3 p-5 text-sm sm:grid-cols-2">
        <div><p className="text-muted-foreground">Class</p><p className="font-medium">{session.class.name}</p></div>
        <div><p className="text-muted-foreground">Category</p><p>{session.class.category || NO_VALUE_STR}</p></div>
        <div><p className="text-muted-foreground">Starts</p><p>{formatDateTime(session.startsAt)}</p></div>
        <div><p className="text-muted-foreground">Ends</p><p>{formatDateTime(session.endsAt)}</p></div>
        <div><p className="text-muted-foreground">Session status</p><p>{session.status}</p></div>
        <div><p className="text-muted-foreground">Capacity</p><p>{session.bookedCount} / {session.capacity}</p></div>
        {session.class.conditions ? <div className="sm:col-span-2"><p className="text-muted-foreground">Class conditions</p><p className="whitespace-pre-wrap">{session.class.conditions}</p></div> : null}
        <Link to={`/class-sessions/${session.id}?locationId=${encodeURIComponent(data.location.id)}`} className="underline-offset-2 hover:underline sm:col-span-2">Open class session details</Link>
      </CardContent>
    </Card>

    <Card id="module-credits" className="border border-border p-0 ring-0">
      <CardHeader className="border-b p-5"><CardTitle>Credit usage</CardTitle></CardHeader>
      <CardContent className="p-0">
        {creditMovements.length ? <ol className="divide-y">
          {creditMovements.map((movement) => <li key={movement.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{movement.type.replaceAll('_', ' ')}</Badge><span className="font-medium">{movement.contract?.pricingOption?.name ?? clientContract?.pricingOption?.name ?? 'Manual or unlinked credits'}</span></div>
              <p className="mt-1 text-sm text-muted-foreground">Contract {movement.contract?.id ?? clientContract?.id ?? NO_VALUE_STR}{movement.contract?.location ? ` · ${movement.contract.location.name}` : ''}</p>
              {movement.reason ? <p className="mt-1 text-sm text-muted-foreground">{movement.reason}</p> : null}
            </div>
            <div className="text-right">
              <p className="font-medium">{Math.abs(movement.amount)} credits</p>
              {movement.balanceAfter !== null && movement.balanceAfter !== undefined ? <p className="text-xs text-muted-foreground">Contract balance after: {movement.balanceAfter}</p> : null}
              <time className="text-sm text-muted-foreground">{formatDateTime(movement.createdAt)}</time>
            </div>
          </li>)}
        </ol> : <div className="p-5 text-sm text-muted-foreground">
          {clientContract
            ? `This booking is linked to ${clientContract.pricingOption?.name ?? clientContract.id}. The class credit cost is ${session.class.creditCost}; no individual ledger movement was recorded.`
            : 'No credit ledger movement is linked to this booking.'}
        </div>}
        {clientContract ? <div className="border-t px-5 py-4 text-sm">
          <p className="font-medium">Booking contract reference</p>
          <p className="text-muted-foreground">{clientContract.pricingOption?.name ?? clientContract.id} · {clientContract.status} · {clientContract.creditsRemaining === null || clientContract.creditsRemaining === undefined ? 'Unlimited credits' : `${clientContract.creditsRemaining} remaining`}</p>
          <p className="text-muted-foreground">Contract location: {clientContract.location.name}</p>
        </div> : null}
      </CardContent>
    </Card>
  </DetailPageLayout>
}
