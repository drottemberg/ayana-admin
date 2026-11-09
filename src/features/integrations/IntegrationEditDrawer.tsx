import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { FormError } from '@/components/form-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectInput } from '@/components/ui/select-input'
import {
  createIntegrationRequest,
  updateIntegrationRequest,
  type CustomerIntegration,
  type CustomerIntegrationInput,
} from './api'

export function IntegrationEditDrawer({
  customerId,
  integration,
  open,
  onOpenChange,
  onSaved,
}: {
  customerId: string
  integration: CustomerIntegration | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [provider, setProvider] = useState<CustomerIntegrationInput['provider']>('CLASSPASS')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setProvider(integration?.provider ?? 'CLASSPASS')
    setUsername(integration?.username ?? '')
    setPassword('')
    setBaseUrl(integration?.baseUrl ?? '')
    setApiKey('')
    setFormError(null)
  }, [integration?.id, open])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (provider === 'CLASSPASS' && (!username.trim() || (!integration && !password.trim()))) {
      setFormError('Enter the ClassPass username and password.')
      return
    }
    if (provider === 'EGYM' && (!baseUrl.trim() || (!integration && !apiKey.trim()))) {
      setFormError('Enter the EGYM base URL and API key.')
      return
    }
    if (provider === 'EGYM2' && (!username.trim() || (!integration && !password.trim()))) {
      setFormError('Enter the EGYM username and password.')
      return
    }
    setFormError(null)
    const input: CustomerIntegrationInput = {
      provider,
      ...(provider === 'CLASSPASS' ? { username: username.trim(), ...(password.trim() ? { password } : {}) } : {}),
      ...(provider === 'EGYM2' ? { username: username.trim(), ...(password.trim() ? { password } : {}) } : {}),
      ...(provider === 'EGYM' ? { baseUrl: baseUrl.trim(), ...(apiKey.trim() ? { apiKey } : {}) } : {}),
    }
    setSaving(true)
    try {
      if (integration) await updateIntegrationRequest(customerId, integration.id, input)
      else await createIntegrationRequest(customerId, input)
      toast.success(`${provider === 'EGYM' ? 'EGYM' : provider === 'EGYM2' ? 'EGYM Wellpass portal' : 'ClassPass'} credentials verified and saved.`)
      onSaved()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not verify integration credentials.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={integration ? 'Edit integration' : 'Add integration'}
      description="Choose a service and enter its credentials. We test them before saving."
      contentClassName="sm:max-w-xl"
    >
      {({ containerRef }) => (
        <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <SelectInput
              label="Service"
              value={provider}
              onValueChange={(value) => setProvider(String(value) as CustomerIntegrationInput['provider'])}
              items={[
                { value: 'CLASSPASS', label: 'ClassPass' },
                { value: 'EGYM', label: 'EGYM Wellpass' },
                { value: 'EGYM2', label: 'EGYM Wellpass portal' },
                { value: 'LASTSPOT', label: 'LastSpot · coming soon', disabled: true },
              ]}
              disabled={Boolean(integration)}
              container={containerRef}
            />
            {provider === 'CLASSPASS' || provider === 'EGYM2' ? (
              <div className="space-y-5 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold">{provider === 'EGYM2' ? 'EGYM Wellpass portal credentials' : 'ClassPass credentials'}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Credentials are encrypted before storage and tested when you save.</p>
                </div>
                <label className="grid gap-1.5 text-sm font-medium">
                  Username
                  <Input value={username} onChange={(event) => { setUsername(event.target.value); setFormError(null) }} autoComplete="username" required />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Password {integration && integration.hasPassword ? <span className="font-normal text-muted-foreground">(saved; leave blank to keep it)</span> : null}
                  <Input type="password" value={password} onChange={(event) => { setPassword(event.target.value); setFormError(null) }} autoComplete={integration ? 'new-password' : 'current-password'} required={!integration} />
                </label>
              </div>
            ) : null}
            {provider === 'EGYM' ? (
              <div className="space-y-5 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold">EGYM Wellpass credentials</h3>
                  <p className="mt-1 text-xs text-muted-foreground">The API key is encrypted before storage. We verify it before saving.</p>
                </div>
                <label className="grid gap-1.5 text-sm font-medium">
                  Base URL
                  <Input type="url" value={baseUrl} onChange={(event) => { setBaseUrl(event.target.value); setFormError(null) }} placeholder="https://…" required />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  API key {integration?.hasApiKey ? <span className="font-normal text-muted-foreground">(saved; leave blank to keep it)</span> : null}
                  <Input type="password" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setFormError(null) }} autoComplete="new-password" required={!integration} />
                </label>
              </div>
            ) : null}
            <FormError message={formError} />
          </div>
          <div className="flex justify-end gap-2 border-t border-border p-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Testing and saving…' : integration ? 'Test and save' : 'Test credentials and save'}</Button>
          </div>
        </form>
      )}
    </AppDrawer>
  )
}
