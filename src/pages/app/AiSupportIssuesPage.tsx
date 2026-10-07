import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { PageHeader } from '@/components/ui/page-header'
import { useConnect } from '@/features/app/use-connect'
import { getAiSupportIssueRequest, getAiSupportIssuesRequest, updateAiSupportIssueRequest } from '@/features/ai-support-issues/api'
import { aiSupportIssueQueryKeys } from '@/features/ai-support-issues/query-keys'
import type { AiSupportIssue, AiSupportIssueStatus, AiSupportIssueType } from '@/features/ai-support-issues/types'
import { NO_VALUE_STR } from '@/constants'

const statuses: AiSupportIssueStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']
const types: AiSupportIssueType[] = ['UNANSWERED', 'TOOL_FAILURE', 'INTERNAL_ERROR', 'ITERATION_LIMIT']

export default function AiSupportIssuesPage() {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [status, setStatus] = useState<AiSupportIssueStatus>('OPEN')
  const [note, setNote] = useState('')
  const [resolution, setResolution] = useState('')
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()
  const { session } = useConnect()

  const issueQuery = useQuery({
    queryKey: selectedIssueId ? aiSupportIssueQueryKeys.detail(selectedIssueId) : [...aiSupportIssueQueryKeys.all, 'no-selection'],
    queryFn: () => getAiSupportIssueRequest(selectedIssueId!),
    enabled: Boolean(selectedIssueId),
  })
  const issue = issueQuery.data

  useEffect(() => {
    if (!issue) return
    setStatus(issue.status)
  }, [issue?.id, issue?.status])

  useEffect(() => {
    if (!issue) return
    setResolution(issue.resolution ?? '')
    setNote('')
  }, [issue?.id, issue?.resolution])

  const columns = useMemo<ColumnDef<AiSupportIssue>[]>(() => [
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <IssueStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => labelType(row.original.type),
    },
    {
      accessorKey: 'summary',
      header: 'Summary',
      cell: ({ row }) => <span className="line-clamp-2 min-w-52">{row.original.summary}</span>,
    },
    {
      accessorKey: 'userName',
      header: 'User',
      cell: ({ row }) => row.original.userId ? (
        <Link className="underline-offset-2 hover:underline" to={`/users/${row.original.userId}`} onClick={(event) => event.stopPropagation()}>
          {row.original.userName || row.original.userEmail || row.original.userId}
        </Link>
      ) : row.original.userName || row.original.userEmail || NO_VALUE_STR,
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => row.original.customerId ? (
        <Link className="underline-offset-2 hover:underline" to={`/customers/${row.original.customerId}`} onClick={(event) => event.stopPropagation()}>
          {row.original.customerName || row.original.customerId}
        </Link>
      ) : row.original.customerName || NO_VALUE_STR,
    },
    {
      accessorKey: 'locationName',
      header: 'Location',
      cell: ({ row }) => row.original.locationId ? (
        <Link className="underline-offset-2 hover:underline" to={`/locations/${row.original.locationId}`} onClick={(event) => event.stopPropagation()}>
          {row.original.locationName || row.original.locationId}
        </Link>
      ) : row.original.locationName || NO_VALUE_STR,
    },
    {
      accessorKey: 'channel',
      header: 'Channel',
      cell: ({ row }) => `${row.original.channel ?? 'UNKNOWN'} · ${row.original.appContext}`,
    },
  ], [])

  const saveIssue = async (patch: Parameters<typeof updateAiSupportIssueRequest>[1]) => {
    if (!selectedIssueId) return
    const previousStatus = issue?.status ?? status
    setSaving(true)
    try {
      await updateAiSupportIssueRequest(selectedIssueId, patch)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: aiSupportIssueQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: aiSupportIssueQueryKeys.detail(selectedIssueId) }),
      ])
      setNote('')
      toast.success('Support issue updated.')
    } catch (error) {
      if (patch.status !== undefined) setStatus(previousStatus)
      toast.error(error instanceof Error ? error.message : 'Could not update the issue.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="AI support issues" subtitle="Review unanswered requests and failures from Ayana conversations." />
      <section className="p-4 md:p-6">
        <DataTableAsync
          queryKey={[...aiSupportIssueQueryKeys.all, 'table']}
          loadData={(state: DataTableState<AiSupportIssue>) => getAiSupportIssuesRequest(state)}
          refetchOnMount="always"
          tableKey="ai-support-issues.root"
          columns={columns}
          searchPlaceholder="Search summary, user, or issue ID"
          searchColumns={['id', 'summary', 'userName', 'userEmail']}
          filters={[
            { id: 'status', label: 'Status', column: 'status', options: statuses, getValue: (row) => row.status },
            { id: 'type', label: 'Type', column: 'type', options: types, getValue: (row) => row.type },
            { id: 'appContext', label: 'Context', column: 'appContext', options: ['ADMIN', 'CUSTOMER', 'MEMBER'], getValue: (row) => row.appContext },
          ]}
          getRowCommands={(row) => [{ label: 'View details', onClick: () => setSelectedIssueId(row.id) }]}
          loadingMessage="Loading support issues..."
          emptyMessage="No AI support issues found."
          errorMessage="Could not load AI support issues."
        />
      </section>

      <Drawer open={Boolean(selectedIssueId)} onOpenChange={(open) => { if (!open && !saving) setSelectedIssueId(null) }} direction="right">
        <DrawerContent className="data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-3xl">
          <DrawerHeader className="border-b px-6 pb-4">
            <DrawerTitle>{issue?.summary ?? 'AI support issue'}</DrawerTitle>
            <DrawerDescription>{issue ? `${issue.id} · ${formatDate(issue.createdAt)}` : 'Loading issue details...'}</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {issueQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading diagnostic details...</p> : null}
            {issue ? (
              <>
                <section className="grid gap-3 sm:grid-cols-2">
                  <Info label="Status"><IssueStatusBadge status={issue.status} /></Info>
                  <Info label="Issue type">{labelType(issue.type)}</Info>
                  <Info label="Channel / context">{issue.channel ?? 'Unknown'} · {issue.appContext}</Info>
                  <Info label="Conversation">{issue.conversationId ?? NO_VALUE_STR}</Info>
                  <Info label="User">
                    <span>{issue.userName || NO_VALUE_STR}</span>
                    {issue.userId ? <Link className="block underline-offset-2 hover:underline" to={`/users/${issue.userId}`}>{issue.userEmail || issue.userId}</Link> : issue.userEmail}
                    {issue.userPhone ? <span className="block">{issue.userPhone}</span> : null}
                    {issue.channelId ? <span className="block text-muted-foreground">Channel ID: {issue.channelId}</span> : null}
                  </Info>
                  <Info label="Customer / location">
                    {issue.customerId ? <Link className="block underline-offset-2 hover:underline" to={`/customers/${issue.customerId}`}>{issue.customerName || issue.customerId}</Link> : <span className="block">{issue.customerName || NO_VALUE_STR}</span>}
                    {issue.locationId ? <Link className="block underline-offset-2 hover:underline" to={`/locations/${issue.locationId}`}>{issue.locationName || issue.locationId}</Link> : <span className="block">{issue.locationName || NO_VALUE_STR}</span>}
                  </Info>
                  <Info label="AI model">{[issue.llmProvider, issue.llmModel].filter(Boolean).join(' / ') || NO_VALUE_STR}</Info>
                  <Info label="Assigned to">{issue.assignee ? `${issue.assignee.firstName} ${issue.assignee.lastName}` : 'Unassigned'}</Info>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Original message</h3>
                  <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 font-sans text-sm">{issue.userInput || NO_VALUE_STR}</pre>
                  <h3 className="text-sm font-semibold">Agent response</h3>
                  <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 font-sans text-sm">{issue.assistantResponse || NO_VALUE_STR}</pre>
                </section>

                {issue.failureMessage || issue.failureStack ? (
                  <JsonSection title="Internal failure" value={{ name: issue.failureName, message: issue.failureMessage, stack: issue.failureStack }} />
                ) : null}
                <JsonSection title="Tool calls and results" value={issue.toolTrace ?? []} />
                <JsonSection title="Conversation history" value={issue.conversation ?? []} />
                <JsonSection title="Available tools and agent context" value={{ tools: issue.availableTools ?? [], context: issue.diagnosticContext ?? {} }} />
                <JsonSection title="Resolution" value={issue.resolution ?? 'No resolution recorded.'} />

                <section className="space-y-3 rounded-lg border p-4">
                  <h3 className="text-sm font-semibold">Triage</h3>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Status
                    <select
                      value={status}
                      disabled={saving}
                      onChange={(event) => {
                        const nextStatus = event.currentTarget.value as AiSupportIssueStatus
                        setStatus(nextStatus)
                        void saveIssue({ status: nextStatus })
                      }}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {statuses.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={saving || !session?.user.id || issue.assignedToUserId === String(session.user.id)} onClick={() => { if (session?.user.id) void saveIssue({ assignedToUserId: String(session.user.id) }) }}>Assign to me</Button>
                    {issue.assignedToUserId ? <Button size="sm" variant="outline" disabled={saving} onClick={() => void saveIssue({ assignedToUserId: null })}>Unassign</Button> : null}
                  </div>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Resolution summary
                    <textarea className="min-h-20 rounded-md border border-input bg-background p-3 font-normal" value={resolution} onChange={(event) => setResolution(event.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Internal note
                    <textarea className="min-h-20 rounded-md border border-input bg-background p-3 font-normal" value={note} onChange={(event) => setNote(event.target.value)} />
                  </label>
                  <Button disabled={saving} onClick={() => void saveIssue({ status, resolution, ...(note.trim() ? { note: note.trim() } : {}) })}>{saving ? 'Saving...' : 'Save update'}</Button>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Activity</h3>
                  {issue.activities.length ? issue.activities.map((activity) => (
                    <div key={activity.id} className="border-l-2 pl-3 text-sm">
                      <div className="font-medium">{activity.type.replace('_', ' ')} · {activity.author ? `${activity.author.firstName} ${activity.author.lastName}` : 'System'}</div>
                      <div className="text-muted-foreground">{activity.content || [activity.fromValue, activity.toValue].filter(Boolean).join(' → ')}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(activity.createdAt)}</div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No activity yet.</p>}
                </section>
              </>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 space-y-1 text-sm"><div className="text-xs text-muted-foreground">{label}</div><div className="break-words">{children}</div></div>
}

function JsonSection({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="rounded-lg border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">{title}</summary>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words border-t bg-muted/30 p-3 text-xs">{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</pre>
    </details>
  )
}

function IssueStatusBadge({ status }: { status: AiSupportIssueStatus }) {
  const variant = status === 'OPEN' ? 'destructive' : status === 'IN_PROGRESS' ? 'secondary' : 'outline'
  return <Badge variant={variant}>{status.replace('_', ' ')}</Badge>
}

function labelType(type: AiSupportIssueType) {
  return ({ UNANSWERED: 'Unanswered', TOOL_FAILURE: 'Tool failure', INTERNAL_ERROR: 'Internal error', ITERATION_LIMIT: 'Agent stuck' })[type]
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
