import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AccessToken } from './access-api'
import { useAccessQr } from './use-access-qr'

export function AccessTokenQrDialog({ access, onOpenChange }: {
  access: AccessToken | null
  onOpenChange: (open: boolean) => void
}) {
  const { image, error } = useAccessQr(access, Boolean(access), 'managed', access?.organizationId)

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
        <DialogDescription>{access?.isDynamic ? `This QR code changes every ${access.qrValiditySeconds} seconds.` : 'Download this QR code to share the access.'}</DialogDescription>
      </DialogHeader>
      <div className="flex min-h-64 items-center justify-center rounded-md border bg-white p-4">
        {image ? <img src={image} alt="Access QR code" className="aspect-square w-full max-w-64" /> : <span className="text-sm text-muted-foreground">{error ? 'Could not load the QR code.' : 'Generating QR code…'}</span>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        {!access?.isDynamic ? <Button type="button" onClick={download} disabled={!image}>Download PNG</Button> : null}
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
