import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import QrCodeIcon from '@hugeicons/core-free-icons/QrCodeIcon'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getMyAccessTokensRequest, type MyAccessToken } from './access-api'
import { useAccessQr } from './use-access-qr'

function accessLabel(access: MyAccessToken) {
  const purpose = access.purpose === 'CHECK_IN' ? 'Check-in' : 'Access'
  const place = access.locationScope === 'ALL'
    ? `All locations · ${access.organizationName ?? 'Customer'}`
    : access.locationScope === 'SPECIFIC'
      ? `${access.locationNames?.join(', ') || `${access.locationIds?.length ?? 0} selected`} · ${access.organizationName ?? 'Customer'}`
      : access.organizationName ?? 'Customer'
  return [access.label || purpose, place].filter(Boolean).join(' · ')
}

export function HomeAccessQr({ customerId, userId }: { customerId: string | null; userId: string }) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const { data: accesses = [], refetch } = useQuery({
    queryKey: ['access', 'my-tokens', customerId, userId],
    queryFn: () => getMyAccessTokensRequest(customerId!),
    enabled: Boolean(customerId && userId),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  })
  const selected = accesses.find((access) => access.id === selectedId) ?? accesses[0]
  const { image, error } = useAccessQr(selected ?? null, open, 'mine', customerId ?? undefined)

  useEffect(() => {
    if (!accesses.length) { setOpen(false); setSelectedId(''); return }
    if (!accesses.some((access) => access.id === selectedId)) setSelectedId(accesses[0].id)
  }, [accesses, selectedId])

  const show = async () => {
    const result = await refetch()
    if (result.data?.length) setOpen(true)
  }

  if (!accesses.length) return null

  return <>
    <Button type="button" size="icon-lg" variant="outline" aria-label="Show my access QR code" title="Show my access QR code" onClick={() => void show()}>
      <HugeiconsIcon icon={QrCodeIcon} strokeWidth={2} />
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader showCloseButton>
          <DialogTitle>My access QR code</DialogTitle>
          <DialogDescription>Show this code at the access scanner.</DialogDescription>
        </DialogHeader>
        {accesses.length > 1 ? <label className="grid gap-2 text-sm font-medium">Access
          <select className="h-10 rounded-md border border-input bg-background px-3" value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.target.value)}>
            {accesses.map((access) => <option key={access.id} value={access.id}>{accessLabel(access)}</option>)}
          </select>
        </label> : selected ? <p className="text-sm font-medium">{accessLabel(selected)}</p> : null}
        <div className="flex min-h-72 items-center justify-center rounded-lg border bg-white p-4">
          {image ? <img src={image} alt="Access QR code" className="aspect-square w-full max-w-sm" />
            : <span className="text-sm text-muted-foreground">{error ? 'Could not load the QR code.' : 'Generating QR code…'}</span>}
        </div>
      </DialogContent>
    </Dialog>
  </>
}
