import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import { StaffRole } from '@/types/membership'
import { createLlmConfigRequest, getLlmConfigsRequest, setDefaultLlmConfigRequest, updateLlmConfigRequest } from '@/features/llm-configs/api'
import { llmConfigQueryKeys } from '@/features/llm-configs/query-keys'
import { LlmProvider, ReasoningEffort, type LlmConfig, type LlmConfigInput } from '@/features/llm-configs/types'

type LlmConfigForm = {
  provider: LlmConfigInput['provider']
  model: string
  apiKey: string
  clearApiKey: boolean
  historyLength: string
  maxTokens: string
  reasoningEffort: LlmConfigInput['reasoningEffort']
}

const emptyForm: LlmConfigForm = {
  provider: LlmProvider.OPENAI,
  model: '',
  apiKey: '',
  clearApiKey: false,
  historyLength: '',
  maxTokens: '',
  reasoningEffort: ReasoningEffort.LOW,
}

const providerLabels: Record<LlmConfig['provider'], string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  gemini: 'Gemini',
}

export default function LlmConfigsPage() {
  const { session, isLoading: isConnectLoading } = useConnect()
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<LlmConfig | null>(null)
  const [form, setForm] = useState<LlmConfigForm>(emptyForm)
  const staffRole = session?.user.staffRole

  const canManage = getAppMode() === 'admin' && Boolean(session?.user.isStaff) &&
    (staffRole === StaffRole.ADMIN || staffRole === StaffRole.SUPER_ADMIN)

  const saveMutation = useMutation({
    mutationFn: async (input: LlmConfigInput) => editingConfig
      ? updateLlmConfigRequest(editingConfig.id, input)
      : createLlmConfigRequest(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: llmConfigQueryKeys.all })
      toast.success(editingConfig ? 'LLM configuration updated.' : 'LLM configuration created.')
      setDrawerOpen(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not save the LLM configuration.'),
  })

  const defaultMutation = useMutation({
    mutationFn: setDefaultLlmConfigRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: llmConfigQueryKeys.all })
      toast.success('Default LLM configuration updated.')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not set the default configuration.'),
  })

  const openCreate = () => {
    setEditingConfig(null)
    setForm(emptyForm)
    setDrawerOpen(true)
  }

  const openEdit = (config: LlmConfig) => {
    setEditingConfig(config)
    setForm({
      provider: config.provider,
      model: config.model ?? '',
      apiKey: '',
      clearApiKey: false,
      historyLength: config.historyLength == null ? '' : String(config.historyLength),
      maxTokens: config.maxTokens == null ? '' : String(config.maxTokens),
      reasoningEffort: config.reasoningEffort,
    })
    setDrawerOpen(true)
  }

  const loadData = useCallback(
    (state: DataTableState<LlmConfig>) => getLlmConfigsRequest(state),
    [],
  )

  const columns = useMemo<ColumnDef<LlmConfig>[]>(() => [
    {
      accessorKey: 'isDefault',
      header: 'Default',
      cell: ({ row }) => row.original.isDefault
        ? <Badge>Default</Badge>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'provider',
      header: 'Provider',
      cell: ({ row }) => providerLabels[row.original.provider] ?? row.original.provider,
    },
    { accessorKey: 'model', header: 'Model', cell: ({ row }) => row.original.model || '—' },
    {
      accessorKey: 'hasApiKey',
      header: 'API key',
      cell: ({ row }) => row.original.hasApiKey ? 'Configured' : <span className="text-muted-foreground">Not configured</span>,
    },
    { accessorKey: 'reasoningEffort', header: 'Reasoning' },
    { accessorKey: 'historyLength', header: 'History', cell: ({ row }) => row.original.historyLength ?? 'Default' },
    { accessorKey: 'maxTokens', header: 'Max tokens', cell: ({ row }) => row.original.maxTokens ?? 'Default' },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
  ], [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (editingConfig?.hasApiKey && editingConfig.provider !== form.provider && !form.apiKey.trim() && !form.clearApiKey) {
      toast.error('Enter the API key for the new provider, or clear the saved key.')
      return
    }
    const input: LlmConfigInput = {
      provider: form.provider,
      model: form.model.trim(),
      reasoningEffort: form.reasoningEffort,
      historyLength: form.historyLength.trim() ? Number(form.historyLength) : null,
      maxTokens: form.maxTokens.trim() ? Number(form.maxTokens) : null,
    }
    if (form.clearApiKey) input.apiKey = null
    else if (form.apiKey.trim()) input.apiKey = form.apiKey.trim()
    saveMutation.mutate(input)
  }

  if (isConnectLoading) return <div className="p-6 text-sm text-muted-foreground">Loading settings…</div>
  if (!canManage) return <Navigate to="/" replace />

  return (
    <>
      <PageHeader title="LLM Config" subtitle="Manage language models and choose the active default configuration." />
      <section className="p-4 md:p-6">
        <DataTableAsync
          queryKey={llmConfigQueryKeys.list()}
          loadData={loadData}
          refetchOnMount="always"
          tableKey="llm-configs.root"
          columns={columns}
          searchPlaceholder="Search provider, model, or ID"
          searchColumns={['id', 'provider', 'model']}
          toolbarExtra={<Button onClick={openCreate}>Add LLM Config</Button>}
          getRowCommands={(config) => [
            { label: 'Edit', onClick: () => openEdit(config) },
            ...(!config.isDefault ? [{ label: 'Set as default', onClick: () => defaultMutation.mutate(config.id), disabled: defaultMutation.isPending }] : []),
          ]}
          loadingMessage="Loading LLM configurations..."
          emptyMessage="No LLM configurations found. Add one to get started."
          errorMessage="Could not load LLM configurations."
        />
      </section>

      <Drawer open={drawerOpen} onOpenChange={(open) => { if (!saveMutation.isPending) setDrawerOpen(open) }} direction="right">
        <DrawerContent className="data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-xl">
          <DrawerHeader className="border-b px-6 pb-4">
            <DrawerTitle>{editingConfig ? 'Edit LLM Config' : 'Add LLM Config'}</DrawerTitle>
            <DrawerDescription>
              Configure the provider, model and request limits. API keys are never shown after saving.
            </DrawerDescription>
          </DrawerHeader>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <Field label="Provider">
                <select
                  id="provider"
                  className="h-9 w-full rounded-[10px] border border-input bg-white px-3.5 text-sm"
                  value={form.provider}
                  onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value as LlmConfigForm['provider'] }))}
                >
                  {Object.values(LlmProvider).map((provider) => <option key={provider} value={provider}>{providerLabels[provider]}</option>)}
                </select>
              </Field>
              <Field label="Model">
                <Input id="model" required value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} placeholder="e.g. gpt-6-luna" />
              </Field>
              <Field label="API key" description={editingConfig?.hasApiKey ? 'Leave blank to keep the saved key.' : 'Leave blank to use the matching server environment key.'}>
                <Input
                  id="api-key"
                  type="password"
                  autoComplete="new-password"
                  value={form.apiKey}
                  onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value, clearApiKey: false }))}
                  placeholder={editingConfig?.hasApiKey ? 'Saved key is hidden' : 'Optional'}
                />
                {editingConfig?.hasApiKey ? (
                  <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={form.clearApiKey} onChange={(event) => setForm((current) => ({ ...current, clearApiKey: event.target.checked, apiKey: '' }))} />
                    Clear saved API key
                  </label>
                ) : null}
              </Field>
              <Field label="Reasoning effort" description="Used by OpenAI models that support configurable reasoning effort.">
                <select
                  id="reasoning-effort"
                  className="h-9 w-full rounded-[10px] border border-input bg-white px-3.5 text-sm"
                  value={form.reasoningEffort}
                  onChange={(event) => setForm((current) => ({ ...current, reasoningEffort: event.target.value as LlmConfigForm['reasoningEffort'] }))}
                >
                  {Object.values(ReasoningEffort).map((effort) => <option key={effort} value={effort}>{effort}</option>)}
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="History messages" description="Blank uses the server default.">
                  <Input id="history-messages" type="number" min={1} step={1} value={form.historyLength} onChange={(event) => setForm((current) => ({ ...current, historyLength: event.target.value }))} />
                </Field>
                <Field label="Max output tokens" description="Blank uses the server default.">
                  <Input id="max-output-tokens" type="number" min={16} step={1} value={form.maxTokens} onChange={(event) => setForm((current) => ({ ...current, maxTokens: event.target.value }))} />
                </Field>
              </div>
              {editingConfig?.isDefault ? <Badge variant="secondary">This is the active default configuration</Badge> : null}
            </div>
            <DrawerFooter className="border-t px-6 py-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)} disabled={saveMutation.isPending}>Cancel</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editingConfig ? 'Save changes' : 'Create config'}</Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  )
}

function Field({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  )
}
