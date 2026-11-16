import { useEffect, useState } from 'react'

type UnsubscribePageData = {
  locale: string
  title: string
  message: string
  button: string
}

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/$/, '')

export default function UnsubscribePage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? ''
  const [page, setPage] = useState<UnsubscribePageData | null>(null)
  const [error, setError] = useState<'invalid' | 'unavailable' | null>(null)
  const [saving, setSaving] = useState(false)
  const french = page?.locale === 'fr'

  useEffect(() => {
    if (!token) {
      setError('invalid')
      return
    }
    void fetch(`${API_URL}/messaging/broadcast/unsubscribe/preview?token=${encodeURIComponent(token)}`, {
      headers: { Accept: 'application/json' },
    }).then(async (response) => {
      if (!response.ok) {
        if (response.status === 400) setError('invalid')
        else setError('unavailable')
        return
      }
      setPage(await response.json() as UnsubscribePageData)
    }).catch(() => setError('unavailable'))
  }, [token])

  const confirm = async () => {
    setSaving(true)
    try {
      const response = await fetch(`${API_URL}/messaging/broadcast/unsubscribe/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!response.ok) {
        if (response.status === 400) setError('invalid')
        else setError('unavailable')
        return
      }
      setPage(await response.json() as UnsubscribePageData)
    } catch {
      setError('unavailable')
    } finally {
      setSaving(false)
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f7f4ef] px-4 py-10 text-[#24211d]">
    <section className="w-full max-w-xl rounded-2xl bg-white px-7 py-9 shadow-xl sm:px-10">
      <img src="/logo.png" alt="Ayana" className="mb-7 h-12" />
      {error ? <>
        <h1 className="text-2xl font-semibold">{error === 'invalid' ? (french ? 'Lien invalide' : 'Invalid link') : (french ? 'Page indisponible' : 'Page unavailable')}</h1>
        <p className="mt-3 leading-relaxed">{error === 'invalid'
          ? (french ? 'Ce lien de désabonnement est invalide ou a expiré.' : 'This unsubscribe link is invalid or has expired.')
          : (french ? 'Impossible de contacter le service. Réessaie dans quelques instants.' : 'Could not reach the service. Please try again in a moment.')}</p>
      </> : page ? <>
        <h1 className="text-2xl font-semibold">{page.title}</h1>
        <p className="mt-3 leading-relaxed">{page.message}</p>
        {page.button ? <button type="button" onClick={() => void confirm()} disabled={saving} className="mt-7 rounded-lg bg-[#a74320] px-5 py-3 font-semibold text-white disabled:opacity-60">
          {saving ? (french ? 'Enregistrement…' : 'Saving…') : page.button}
        </button> : null}
      </> : <p>{'…'}</p>}
    </section>
  </main>
}
