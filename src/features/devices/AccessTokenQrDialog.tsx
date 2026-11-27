import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AccessToken } from './access-api'

export function AccessTokenQrDialog({ access, onOpenChange }: {
  access: AccessToken | null
  onOpenChange: (open: boolean) => void
}) {
  const [image, setImage] = useState<string | null>(null)

  useEffect(() => {
    setImage(null)
    if (!access) return
    let active = true
    void QRCode.toDataURL(access.token, { width: 512, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => { if (active) setImage(url) })
      .catch(() => { if (active) toast.error('Could not generate the QR code.') })
    return () => { active = false }
  }, [access])

  const download = () => {
    if (!access || !image) return
    const link = document.createElement('a')
    link.href = image
    link.download = `access-${access.id}.png`
    link.click()
  }

  return <Dialog open={Boolean(access)} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-sm">
      <DialogHeader showCloseButton>
        <DialogTitle>Access QR code</DialogTitle>
        <DialogDescription>Download this QR code to share the access.</DialogDescription>
      </DialogHeader>
      <div className="flex min-h-64 items-center justify-center rounded-md border bg-white p-4">
        {image ? <img src={image} alt="Access QR code" className="aspect-square w-full max-w-64" /> : <span className="text-sm text-muted-foreground">Generating QR code…</span>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        <Button type="button" onClick={download} disabled={!image}>Download PNG</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
