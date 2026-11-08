import { useQuery } from '@tanstack/react-query'
import { AppDrawer } from '@/components/app/AppDrawer'
import { Badge } from '@/components/ui/badge'
import { getCoachRosterMemberProfileRequest } from './api'

function displayPreference(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function CoachRosterMemberProfileDrawer({
  sessionId,
  userId,
  open,
  onOpenChange,
}: {
  sessionId: string
  userId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const profile = useQuery({
    queryKey: ['coaches', 'roster-member-profile', sessionId, userId],
    queryFn: () => getCoachRosterMemberProfileRequest(sessionId, userId!),
    enabled: open && Boolean(userId && sessionId),
  })
  const member = profile.data
  const name = [member?.firstName, member?.lastName].filter(Boolean).join(' ') || 'Roster member'
  const preferences = Object.entries(member?.preferences ?? {})

  return <AppDrawer
    open={open}
    onOpenChange={onOpenChange}
    title={name}
    description="Member profile and relevant saved preferences for this class."
    contentClassName="sm:max-w-xl"
  >
    <div className="space-y-5 overflow-y-auto px-5 pb-5">
      {profile.isLoading ? <p className="text-sm text-muted-foreground">Loading profile…</p> : null}
      {profile.isError ? <p role="alert" className="text-sm text-destructive">Could not load this roster member’s profile.</p> : null}
      {member ? <>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{member.visitInsight === 'FIRST_VISIT' ? 'First visit' : member.visitInsight === 'REGULAR' ? 'Regular' : 'Returning'}</Badge>
          <span className="text-sm text-muted-foreground">{member.previousStudioVisits ?? 0} previous visits</span>
          <Badge variant="secondary">{member.status}</Badge>
        </div>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Preferences</h3>
          {preferences.length ? <dl className="space-y-2">
            {preferences.map(([key, value]) => <div key={key} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 border-b border-border py-2 text-sm last:border-0">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="min-w-0 whitespace-pre-wrap break-words">{displayPreference(value)}</dd>
            </div>)}
          </dl> : <p className="text-sm text-muted-foreground">No relevant preferences saved.</p>}
        </section>
      </> : null}
    </div>
  </AppDrawer>
}
