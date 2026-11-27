import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { SelectInputAsync } from '@/components/ui/select-input'
import { usersQueryKeys } from '@/features/users/query-keys'
import { getUserMergeCandidatesRequest, mergeUsersRequest, previewUserMergeRequest, type UserMergeCandidate } from '@/features/users/api'
import type { User } from '@/types/user'

function userLabel(user: UserMergeCandidate) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return [name || user.id, user.email, user.phone].filter(Boolean).join(' · ')
}

export function MergeUserDrawer({ keptUser, onOpenChange }: { keptUser: User | null; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const [sourceUserId, setSourceUserId] = useState('')
  const [sourceUser, setSourceUser] = useState<UserMergeCandidate>()
  const targetUserId = keptUser ? String(keptUser.id) : ''
  useEffect(() => { setSourceUserId(''); setSourceUser(undefined) }, [targetUserId])

  const preview = useQuery({
    queryKey: ['users', 'merge-preview', targetUserId, sourceUserId],
    queryFn: () => previewUserMergeRequest(targetUserId, sourceUserId),
    enabled: Boolean(keptUser && sourceUserId),
    staleTime: 0,
  })
  const merge = useMutation({
    mutationFn: async () => {
      const fresh = await previewUserMergeRequest(targetUserId, sourceUserId)
      if (fresh.conflicts.length) throw new Error(fresh.conflicts.join(' '))
      return mergeUsersRequest(targetUserId, sourceUserId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKeys.all })
      toast.success('Accounts merged. The selected account was absorbed into the kept account.')
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not merge accounts.'),
  })

  return <AppDrawer open={Boolean(keptUser)} onOpenChange={onOpenChange} title="Merge accounts"
    description="This account is kept. Select the other account to absorb into it."
    contentClassName="sm:max-w-xl">
    {({ containerRef }) => <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div className="rounded-md border bg-muted/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account 1 · Keep</p>
          <p className="mt-1 font-medium">{keptUser ? userLabel({ id: targetUserId, firstName: keptUser.firstName,
            lastName: keptUser.lastName, email: keptUser.email, phone: keptUser.phone ?? null }) : ''}</p>
        </div>
        <SelectInputAsync<UserMergeCandidate>
          label="Account 2 · Merge into account 1"
          placeholder="Search by name, email or phone"
          queryKey={['user-merge-candidates', targetUserId]}
          queryFn={async (search) => (await getUserMergeCandidatesRequest(search)).filter((user) => user.id !== targetUserId)}
          getOption={(user) => ({ value: user.id, label: userLabel(user) })}
          selectedItems={sourceUser ? [sourceUser] : []}
          value={sourceUserId}
          onValueChange={(value) => setSourceUserId(String(value))}
          onSelectedItemsChange={(items) => setSourceUser(items[0])}
          emptyMessage="No other customer account found."
          container={containerRef}
        />
        {preview.isPending && sourceUserId ? <p className="text-sm text-muted-foreground">Checking accounts…</p> : null}
        {preview.isError ? <p className="text-sm text-destructive">{preview.error instanceof Error ? preview.error.message : 'Could not check accounts.'}</p> : null}
        {preview.data ? <div className="space-y-3 rounded-md border p-3 text-sm">
          <p><strong>Kept:</strong> {userLabel(preview.data.target)}</p>
          <p><strong>Absorbed:</strong> {userLabel(preview.data.source)}</p>
          <p className="text-muted-foreground">Bookings, orders, payments, contracts, credits, conversations and channels from account 2 move to account 1.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            {Object.entries(preview.data.counts).filter(([, count]) => count > 0).map(([key, count]) => <span key={key}>{key}: {count}</span>)}
          </div>
          {preview.data.warnings.map((warning) => <p key={warning} className="text-amber-700">{warning}</p>)}
          {preview.data.conflicts.map((conflict) => <p key={conflict} className="text-destructive">{conflict}</p>)}
          {!preview.data.conflicts.length ? <p className="font-medium">Account 1 keeps its email and phone; any empty field is filled from account 2. Account 2 is archived after the merge.</p> : null}
        </div> : null}
      </div>
      <div className="flex justify-end gap-2 border-t p-5">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={merge.isPending}>Cancel</Button>
        <Button type="button" variant="destructive" disabled={!preview.data || !!preview.data.conflicts.length || preview.isFetching || merge.isPending}
          onClick={() => merge.mutate()}>{merge.isPending ? 'Merging…' : 'Merge account 2 into account 1'}</Button>
      </div>
    </div>}
  </AppDrawer>
}
