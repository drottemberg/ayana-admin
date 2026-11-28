import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { getManagedDynamicAccessQrRequest, getMyDynamicAccessQrRequest } from './access-api'

export function useAccessQr(access: { id: string; token: string | null; isDynamic: boolean } | null,
  enabled: boolean, mode: 'mine' | 'managed', customerId?: string) {
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setImage(null)
    setError(false)
    if (!enabled || !access) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const refresh = async () => {
      try {
        const qr = access.isDynamic
          ? await (mode === 'mine'
            ? customerId ? getMyDynamicAccessQrRequest(access.id, customerId) : Promise.reject(new Error('Customer is required.'))
            : getManagedDynamicAccessQrRequest(access.id, customerId))
          : { value: access.token ?? '', refreshAfterMs: 0 }
        if (!qr.value) throw new Error('Access code is unavailable.')
        const nextImage = await QRCode.toDataURL(qr.value, { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
        if (!active) return
        setImage(nextImage)
        setError(false)
        if (access.isDynamic) timer = setTimeout(() => void refresh(), Math.max(300, qr.refreshAfterMs))
      } catch {
        if (!active) return
        setImage(null)
        setError(true)
        if (access.isDynamic) timer = setTimeout(() => void refresh(), 5000)
      }
    }

    void refresh()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [access?.id, access?.token, access?.isDynamic, enabled, mode, customerId])

  return { image, error }
}
