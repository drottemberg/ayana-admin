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
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setProvider(integration?.provider ?? 'CLASSPASS')
    setUsername(integration?.username ?? '')
    setPassword('')
    setFormError(null)
  }, [integration?.id, open])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!username.trim() || (!integration && !password.trim())) {
      setFormError('Enter the ClassPass username and password.')
      return
    }
    setFormError(null)
    const input: CustomerIntegrationInput = {
      provider,
      username: username.trim(),
      ...(password.trim() ? { password } : {}),
    }
    setSaving(true)
    try {
      if (integration) await updateIntegrationRequest(customerId, integration.id, input)
      else await createIntegrationRequest(customerId, input)
      toast.success('ClassPass credentials verified and saved.')
      onSaved()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not verify ClassPass credentials.')
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
                { value: 'EGYM', label: 'EGYM · coming soon', disabled: true },
                { value: 'LASTSPOT', label: 'LastSpot · coming soon', disabled: true },
              ]}
              disabled={Boolean(integration)}
              container={containerRef}
            />
            {provider === 'CLASSPASS' ? (
              <div className="space-y-5 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold">ClassPass credentials</h3>
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
