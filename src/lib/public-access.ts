export type PublicAccessChannel = 'WHATSAPP' | 'TELEGRAM'
export type PublicAccessDestination = 'BOOKING' | 'STORE'

export async function createPublicAccessLink(input: {
  apiUrl: string
  customerSlug: string
  locationSlug: string
  destination: PublicAccessDestination
  channel: PublicAccessChannel
  language: 'fr' | 'en'
  state: Record<string, unknown>
}): Promise<string> {
  const { apiUrl, ...body } = input
  const response = await fetch(`${apiUrl}/public-access/request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as { url?: string; message?: string | string[] }
  if (!response.ok || !payload.url) {
    const message = Array.isArray(payload.message) ? payload.message.join(' ') : payload.message
    throw new Error(message || (input.language === 'fr' ? 'Impossible de préparer le lien. Réessaie.' : 'Could not prepare the link. Please try again.'))
  }
  return payload.url
}
