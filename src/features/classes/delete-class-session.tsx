import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Modals } from '@/providers/modal'
import type { ClassSession } from '@/types/class-type'
import { deleteClassSessionRequest } from './api'
import { classSessionsQueryKeys } from './query-keys'
import { DeleteClassSessionConfirmation, type ClassSessionDeleteScope } from './DeleteClassSessionConfirmation'

export async function deleteClassSessionWithConfirmation(
  session: Pick<ClassSession, 'id' | 'scheduleId'>,
  locationId: string,
  queryClient: QueryClient,
  extraQueryKeys: readonly (readonly unknown[])[] = [],
) {
  const scopeRef: { current: ClassSessionDeleteScope } = { current: 'THIS' }
  const confirmed = await Modals.confirm({
    title: 'Delete this class session?',
    content: <DeleteClassSessionConfirmation scopeRef={scopeRef} />,
    okText: 'Delete session',
    cancelText: 'Keep session',
    okButtonProps: { variant: 'destructive' },
  })
  if (!confirmed) return null

  const result = await deleteClassSessionRequest(session.id, locationId, scopeRef.current)
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: classSessionsQueryKeys.all }),
    ...extraQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ])
  toast.success(
    `${result.softDeleted} session(s) marked as deleted. ${result.bookingsCancelled} booking(s) cancelled; ${result.creditsReturned} credit(s) returned.`,
  )
  return result
}
