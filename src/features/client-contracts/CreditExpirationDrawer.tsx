import NiceModal from '@ebay/nice-modal-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { clientContractsQueryKeys } from '@/features/client-contracts/query-keys'
import {
  updateClientContractExpirationRequest,
  updateCreditMovementRequest,
} from '@/features/client-contracts/api'
import type { ClientContract, ClientContractCreditMovement } from '@/types/client-contract'
import { useDrawerController } from '@/providers/use-overlay-controller'

export type CreditExpirationDrawerProps =
  | { kind: 'contract'; contract: ClientContract }
  | { kind: 'movement'; movement: ClientContractCreditMovement }

function localDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function expirationIso(value: string) {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : null
}

function todayLocal() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const CreditExpirationDrawer = NiceModal.create<CreditExpirationDrawerProps>((props) => {
  const drawer = useDrawerController()
  const queryClient = useQueryClient()
  const [expirationDate, setExpirationDate] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const itemId = props.kind === 'contract' ? props.contract.id : props.movement.id
  const currentDate = props.kind === 'contract' ? props.contract.validUntil : props.movement.expiresAt
  const subject = props.kind === 'contract'
    ? (props.contract.pricingOption?.name ?? 'Client contract')
    : `${props.movement.reason || 'Credit grant'} · ${props.movement.amount} credits`

  useEffect(() => {
    setExpirationDate(localDate(currentDate))
    if (props.kind === 'movement') {
      setAmount(String(props.movement.amount))
      setReason(props.movement.reason ?? '')
    }
  }, [itemId, currentDate, props.kind === 'movement' ? props.movement.amount : null, props.kind === 'movement' ? props.movement.reason : null])

  const save = useMutation({
    mutationFn: async () => {
      if (props.kind === 'contract') {
        await updateClientContractExpirationRequest(props.contract.id, expirationIso(expirationDate))
      } else {
        await updateCreditMovementRequest(props.movement.id, {
          amount: Number(amount),
          reason: reason.trim() || null,
          expiresAt: expirationIso(expirationDate),
        })
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: clientContractsQueryKeys.all })
      toast.success(props.kind === 'contract' ? 'Contract expiration updated.' : 'Credit transaction updated.')
      await drawer.forceClose()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not update expiration date.'),
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <AppDrawer
      title={props.kind === 'contract' ? 'Edit contract expiration' : 'Edit credit transaction'}
      description={subject}
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      contentClassName="sm:max-w-lg"
    >
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Expiration date</span>
            <Input
              type="date"
              min={todayLocal()}
              value={expirationDate}
              onChange={(event) => setExpirationDate(event.target.value)}
            />
            <span className="text-xs font-normal text-muted-foreground">
              {props.kind === 'movement' && props.movement.type === 'CREDIT_EXPIRY'
                ? 'To restore expired credits, set a new future expiration date or leave empty.'
                : 'Leave empty for no expiration.'}
            </span>
          </label>
          {props.kind === 'movement' ? <>
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Amount</span>
              <Input type="number" inputMode="decimal" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Reason</span>
              <Textarea maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
          </> : null}
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <Button type="button" variant="outline" disabled={save.isPending} onClick={() => void drawer.requestClose(false)}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <><Spinner /> Saving…</> : 'Save changes'}
          </Button>
        </div>
      </form>
    </AppDrawer>
  )
})
