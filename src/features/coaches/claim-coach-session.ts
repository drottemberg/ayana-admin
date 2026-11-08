import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { claimCoachSessionRequest } from '@/features/coaches/api'
import { coachesQueryKeys } from '@/features/coaches/query-keys'
import { classSessionsQueryKeys } from '@/features/classes/query-keys'
import type { ClassSession } from '@/types/class-type'
import { Modals } from '@/providers/modal'

const pendingClaims = new Set<string>()

export async function claimCoachSession(
  session: Pick<ClassSession, 'id' | 'className' | 'startTime' | 'locationName'>,
  queryClient: QueryClient,
  onPendingChange?: (sessionId: string | null) => void,
): Promise<void> {
  if (pendingClaims.size > 0) return
  pendingClaims.add(session.id)

  const className = session.className || 'this class'
  const startsAt = new Date(session.startTime).toLocaleString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  const details = [className, startsAt, session.locationName].filter(Boolean).join(' · ')

  try {
    const confirmed = await Modals.confirm({
      title: 'Claim this session?',
      content: `This will assign ${details} to you and notify you by email.`,
      okText: 'Claim session',
      cancelText: 'Cancel',
    })
    if (!confirmed) return

    onPendingChange?.(session.id)
    await claimCoachSessionRequest(session.id)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: coachesQueryKeys.all }),
    ])
    toast.success('Session assigned to you.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not claim this session.')
  } finally {
    onPendingChange?.(null)
    pendingClaims.delete(session.id)
  }
}
