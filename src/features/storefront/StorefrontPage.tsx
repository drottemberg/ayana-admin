import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom'
import ayanaLogo from '@/assets/ayana-logo.png'
import { PhoneInput } from '@/components/ui/phone-input'
import { createPublicAccessLink, type PublicAccessChannel } from '@/lib/public-access'
import './storefront.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'
const CART_KEY = 'ayana-storefront-cart'

type ProductOption = { id: string; name: string; price: number }
type ModifierGroup = { id: string; name: string; required: boolean; minSelect: number; maxSelect: number; options: ProductOption[] }
type Variant = { id: string; label: string; price: number; stock: number; available: boolean }
type Product = { id: string; name: string; description?: string | null; categoryId?: string; category: string; imageUrl?: string | null; variants: Variant[]; modifierGroups: ModifierGroup[] }
type StoreCategory = { id: string; name: string; imageUrl?: string | null; productCount: number }
type PrefillChoice = { product: Product; variant?: Variant; options: Record<string, string[]>; quantity: number; missingOption: boolean }
type Catalog = { customer: { name: string; slug: string }; location: { name: string; slug: string; whatsappNumber?: string | null; telegramBotUsername?: string | null }; currency: string; acceptsProductOrders?: boolean; paymentMethods?: { online: boolean; terminal: boolean }; categories?: StoreCategory[]; products: Product[] }
type CartLine = { key: string; productId: string; name: string; variantId: string; variantLabel: string; unitPrice: number; quantity: number; modifierIds: string[]; modifierNames: string[]; modifierTotal: number }
type Identity = { token?: string; firstName?: string; lastName?: string; email?: string; phone?: string }
type StorefrontLanguage = 'fr' | 'en'
type StoreAccessModal = { view: 'choose' | 'email' | 'code'; state: Record<string, unknown>; email?: string; verificationId?: string }
const STORE_LANGUAGE_KEY = 'ayana-storefront-language'

function readStorefrontLanguage(): StorefrontLanguage {
  try {
    const saved = localStorage.getItem(STORE_LANGUAGE_KEY)
    if (saved === 'fr' || saved === 'en') return saved
  } catch { /* use browser language when storage is unavailable */ }
  return (navigator.languages?.[0] ?? navigator.language ?? 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr'
}

function sessionKey(customerSlug: string, locationSlug: string) {
  return `ayana-storefront-session:${customerSlug}:${locationSlug}`
}

function guestDraftKey(customerSlug: string, locationSlug: string) {
  return `ayana-storefront-guest:${customerSlug}:${locationSlug}`
}

function checkoutResumeKey(customerSlug: string, locationSlug: string) {
  return `ayana-storefront-resume-checkout:${customerSlug}:${locationSlug}`
}

function readGuestDraft(customerSlug: string, locationSlug: string) {
  try {
    const draft = JSON.parse(localStorage.getItem(guestDraftKey(customerSlug, locationSlug)) ?? '{}') as { firstName?: unknown; email?: unknown; phone?: unknown }
    return {
      firstName: typeof draft.firstName === 'string' ? draft.firstName : '',
      email: typeof draft.email === 'string' ? draft.email : '',
      phone: typeof draft.phone === 'string' ? draft.phone : '',
    }
  } catch { return { firstName: '', email: '', phone: '' } }
}

function whatsappReturnKey(customerSlug: string, locationSlug: string) {
  return `ayana-storefront-whatsapp-return:${customerSlug}:${locationSlug}`
}

function readIdentity(customerSlug: string, locationSlug: string): Identity {
  try { return JSON.parse(localStorage.getItem(sessionKey(customerSlug, locationSlug)) ?? '{}') as Identity } catch { return {} }
}

function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^00/, '')
  if (digits.length < 8 || digits.length > 15) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

function readCart(): CartLine[] {
  try { return JSON.parse(localStorage.getItem(CART_KEY) ?? '[]') as CartLine[] } catch { return [] }
}

function money(value: number, currency: string, language: StorefrontLanguage) {
  return new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-GB', { style: 'currency', currency }).format(value)
}

function categoryEmoji(name: string) {
  const normalized = name.toLocaleLowerCase()
  if (/matcha/.test(normalized)) return '🍵'
  if (/coffee|café|cafe/.test(normalized)) return '☕'
  if (/tea|thé|the|infusion/.test(normalized)) return '🫖'
  if (/good|merch|accessor/.test(normalized)) return '🛍️'
  return '✨'
}

function productEmoji(category: string, name: string) {
  const normalized = `${category} ${name}`.toLocaleLowerCase()
  if (/matcha/.test(normalized)) return '🍵'
  if (/coffee|café|cafe|espresso|latte|cappuccino|americano/.test(normalized)) return '☕'
  if (/tea|thé|the|infusion/.test(normalized)) return '🫖'
  if (/good|merch|sock|chaussette|tote|gourde/.test(normalized)) return '🛍️'
  return '✨'
}

function StorefrontRoute() {
  const { customerSlug = '', locationSlug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [language, setLanguage] = useState<StorefrontLanguage>(readStorefrontLanguage)
  const [whatsappReturnUrl, setWhatsappReturnUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState(() => searchParams.get('category') ?? 'Tout')
  const [showCategoryListing, setShowCategoryListing] = useState(() => searchParams.has('category') || searchParams.has('categoryId'))
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [variantId, setVariantId] = useState('')
  const [selectedProductQuantity, setSelectedProductQuantity] = useState(1)
  const [editingCartKey, setEditingCartKey] = useState<string | null>(null)
  const [pendingPrefillItems, setPendingPrefillItems] = useState<PrefillChoice[]>([])
  const [isPrefillSelection, setIsPrefillSelection] = useState(false)
  const [prefillHadUnresolved, setPrefillHadUnresolved] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({})
  const [optionError, setOptionError] = useState('')
  const [cart, setCart] = useState<CartLine[]>(readCart)
  const [orderNote, setOrderNote] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'terminal'>('online')
  const [terminalOrder, setTerminalOrder] = useState<{ shortCode?: string } | null>(null)
  const [identity, setIdentity] = useState<Identity>(() => readIdentity(customerSlug, locationSlug))
  const [checkoutFirstName, setCheckoutFirstName] = useState(() => readIdentity(customerSlug, locationSlug).firstName ?? readGuestDraft(customerSlug, locationSlug).firstName)
  const [successContact, setSuccessContact] = useState(() => {
    const saved = readIdentity(customerSlug, locationSlug)
    const draft = readGuestDraft(customerSlug, locationSlug)
    return { firstName: saved.firstName ?? draft.firstName, email: saved.email ?? draft.email, phone: saved.phone ?? draft.phone }
  })
  const [successContactLoading, setSuccessContactLoading] = useState(false)
  const [successContactLoaded, setSuccessContactLoaded] = useState(false)
  const [successAccountExists, setSuccessAccountExists] = useState(false)
  const [successContactSaved, setSuccessContactSaved] = useState(false)
  const [successContactError, setSuccessContactError] = useState('')
  const handledProductLink = useRef('')
  const handledCartLink = useRef('')
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [accessLoading, setAccessLoading] = useState<PublicAccessChannel | null>(null)
  const [accessError, setAccessError] = useState('')
  const [accessModal, setAccessModal] = useState<StoreAccessModal | null>(null)
  const [accessEmail, setAccessEmail] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [emailAccessLoading, setEmailAccessLoading] = useState(false)
  const isFrench = language === 'fr'
  const tr = (fr: string, en: string) => isFrench ? fr : en
  const changeLanguage = (nextLanguage: StorefrontLanguage) => {
    setLanguage(nextLanguage)
    try { localStorage.setItem(STORE_LANGUAGE_KEY, nextLanguage) } catch { /* language still changes for this visit */ }
  }
  const storeBasePath = location.pathname.startsWith('/store/') ? `/store/${customerSlug}/${locationSlug}` : `/${customerSlug}/${locationSlug}`
  const openAccessLink = async (channel: PublicAccessChannel, extraState: Record<string, unknown> = {}) => {
    setAccessLoading(channel)
    setAccessError('')
    const modalState = accessModal?.state ?? {}
    const resumeCheckout = extraState.resumeCheckout === true || modalState.resumeCheckout === true || checkoutOpen
    if (resumeCheckout) {
      try { localStorage.setItem(checkoutResumeKey(customerSlug, locationSlug), String(Date.now())) } catch { /* the return URL also carries resumeCheckout */ }
    }
    try {
      const url = await createPublicAccessLink({
        apiUrl: API_URL,
        customerSlug,
        locationSlug,
        destination: 'STORE',
        channel,
        language,
        state: { category, ...modalState, resumeCheckout, ...extraState },
      })
      window.location.assign(url)
    } catch (reason) {
      if (resumeCheckout) {
        try { localStorage.removeItem(checkoutResumeKey(customerSlug, locationSlug)) } catch { /* ignore unavailable storage */ }
      }
      setAccessError(reason instanceof Error ? reason.message : tr('Impossible de préparer le lien.', 'Could not prepare the link.'))
      setAccessLoading(null)
    }
  }
  const openAccessModal = (state: Record<string, unknown>) => {
    const resumeCheckout = checkoutOpen || state.resumeCheckout === true
    setCheckoutOpen(false)
    setAccessError('')
    setAccessEmail(state.returnToSuccess === true ? successContact.email : '')
    setAccessCode('')
    setAccessModal({ view: 'choose', state: { category, ...state, resumeCheckout } })
  }
  const backInAccessFlow = () => {
    if (emailAccessLoading) return
    setAccessError('')
    setAccessCode('')
    setAccessModal((current) => current?.view === 'code'
      ? { ...current, view: 'email', verificationId: undefined }
      : current?.view === 'email'
        ? { ...current, view: 'choose', verificationId: undefined }
        : null)
  }
  const requestEmailAccessCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessModal) return
    setEmailAccessLoading(true)
    setAccessError('')
    try {
      const response = await fetch(`${API_URL}/public-access/email/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerSlug,
          locationSlug,
          destination: 'STORE',
          email: accessEmail.trim(),
          language,
          state: accessModal.state,
        }),
      })
      const payload = await response.json().catch(() => ({})) as { verificationId?: string; message?: string | string[] }
      if (!response.ok || !payload.verificationId) throw new Error(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message || tr('Impossible d’envoyer le code.', 'Could not send the code.'))
      setAccessModal({ ...accessModal, view: 'code', email: accessEmail.trim(), verificationId: payload.verificationId })
    } catch (reason) {
      setAccessError(reason instanceof Error ? reason.message : tr('Impossible d’envoyer le code.', 'Could not send the code.'))
    } finally {
      setEmailAccessLoading(false)
    }
  }
  const verifyEmailAccessCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessModal?.verificationId) return
    setEmailAccessLoading(true)
    setAccessError('')
    try {
      const response = await fetch(`${API_URL}/public-access/email/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ verificationId: accessModal.verificationId, code: accessCode.trim() }),
      })
      const payload = await response.json().catch(() => ({})) as { url?: string; message?: string | string[] }
      if (!response.ok || !payload.url) throw new Error(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message || tr('Code incorrect ou expiré.', 'The code is incorrect or expired.'))
      window.location.assign(payload.url)
    } catch (reason) {
      setAccessError(reason instanceof Error ? reason.message : tr('Code incorrect ou expiré.', 'The code is incorrect or expired.'))
    } finally {
      setEmailAccessLoading(false)
    }
  }
  const renderAccessButtons = (buttonClass: string, state: Record<string, unknown> = {}) => <div className="store-access-buttons">
    <button type="button" className={buttonClass} disabled={Boolean(accessLoading) || emailAccessLoading} onClick={() => openAccessModal(state)}>{tr('Se connecter', 'Sign in')} <span>→</span></button>
  </div>
  const orderCode = searchParams.get('code')?.trim()
  const successOrderId = searchParams.get('orderId')?.trim() ?? ''
  const successSessionId = searchParams.get('session_id')?.trim() ?? searchParams.get('sessionId')?.trim() ?? ''
  const stripeEmailLocked = accessModal?.state.returnToSuccess === true && Boolean(successContact.email.trim())
  const renderAccessModal = () => {
    if (!accessModal) return null
    return <div className="store-overlay store-access-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !emailAccessLoading && !accessLoading) setAccessModal(null) }}><section className="store-sheet store-access-sheet" role="dialog" aria-modal="true" aria-labelledby="store-access-title">
      <div className="store-access-nav"><button type="button" disabled={emailAccessLoading || Boolean(accessLoading)} onClick={backInAccessFlow}><span aria-hidden="true">←</span>{accessModal.view === 'choose' ? tr('Retour', 'Back') : tr('Précédent', 'Previous')}</button><button type="button" aria-label={tr('Fermer', 'Close')} disabled={emailAccessLoading || Boolean(accessLoading)} onClick={() => setAccessModal(null)}>×</button></div>
      <p className="store-eyebrow">AYANA</p>
      <h2 id="store-access-title">{accessModal.view === 'choose' ? tr('Connecte-toi à ton compte Ayana', 'Sign in to your Ayana account') : accessModal.view === 'email' ? tr('Connexion par e-mail', 'Sign in with email') : tr('Vérifie ton e-mail', 'Check your email')}</h2>
      {accessModal.view === 'choose' ? <div className="store-access-methods">
        <button type="button" className="store-access-email" onClick={() => { setAccessError(''); setAccessModal({ ...accessModal, view: 'email' }) }}>{tr('Continuer avec e-mail', 'Continue with email')}<span>→</span></button>
        {catalog?.location.whatsappNumber && <button type="button" className="store-access-whatsapp" disabled={Boolean(accessLoading)} onClick={() => void openAccessLink('WHATSAPP')}>{accessLoading === 'WHATSAPP' ? tr('Préparation…', 'Preparing…') : tr('Continuer avec WhatsApp', 'Continue with WhatsApp')}<span>↗</span></button>}
        {catalog?.location.telegramBotUsername && <button type="button" className="store-access-telegram" disabled={Boolean(accessLoading)} onClick={() => void openAccessLink('TELEGRAM')}>{accessLoading === 'TELEGRAM' ? tr('Préparation…', 'Preparing…') : tr('Continuer avec Telegram', 'Continue with Telegram')}<span>↗</span></button>}
        {catalog && !catalog.location.whatsappNumber && !catalog.location.telegramBotUsername && <small>{tr('Seule la connexion par e-mail est disponible pour cette boutique.', 'Only email sign-in is available for this shop.')}</small>}
      </div> : accessModal.view === 'email' ? <form className="store-access-form" onSubmit={(event) => void requestEmailAccessCode(event)}>
        <p>{stripeEmailLocked ? tr('On utilise l’adresse e-mail de ton paiement Stripe pour te connecter.', 'We’ll use the email address from your Stripe payment to sign you in.') : tr('Saisis ton adresse e-mail. Si tu as déjà un compte, tu seras connecté·e. Sinon, ton compte Ayana sera créé après vérification.', 'Enter your email address. If you already have an account, you’ll be signed in. Otherwise, your Ayana account will be created after verification.')}</p>
        <label>{tr('E-mail', 'Email')}<input type="email" autoComplete="email" autoFocus={!stripeEmailLocked} readOnly={stripeEmailLocked} required maxLength={254} value={accessEmail} onChange={(event) => setAccessEmail(event.target.value)} placeholder="adresse@exemple.com" /></label>
        <button type="submit" className="store-primary" disabled={emailAccessLoading}>{emailAccessLoading ? tr('Envoi…', 'Sending…') : tr('Recevoir un code', 'Send me a code')}<span>→</span></button>
      </form> : <form className="store-access-form" onSubmit={(event) => void verifyEmailAccessCode(event)}>
        <p>{tr(`Saisis le code à 6 chiffres envoyé à ${accessModal.email}.`, `Enter the 6-digit code sent to ${accessModal.email}.`)}</p>
        <label>{tr('Code de vérification', 'Verification code')}<input inputMode="numeric" autoComplete="one-time-code" autoFocus required minLength={6} maxLength={6} pattern="[0-9]{6}" value={accessCode} onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label>
        <button type="submit" className="store-primary" disabled={emailAccessLoading || accessCode.length !== 6}>{emailAccessLoading ? tr('Vérification…', 'Verifying…') : tr('Valider et continuer', 'Verify and continue')}<span>→</span></button>
        <button type="button" className="store-access-secondary" disabled={emailAccessLoading} onClick={() => { setAccessError(''); setAccessCode(''); setAccessModal({ ...accessModal, view: 'email', verificationId: undefined }) }}>{tr('Changer d’adresse e-mail', 'Use a different email')}</button>
      </form>}
      {accessError && <p className="store-form-error" role="alert">{accessError}</p>}
    </section></div>
  }

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  const updateGuestDraft = (value: string) => {
    const current = readGuestDraft(customerSlug, locationSlug)
    const next = { ...current, firstName: value }
    setCheckoutFirstName(value)
    try { localStorage.setItem(guestDraftKey(customerSlug, locationSlug), JSON.stringify(next)) } catch { /* checkout remains usable without browser storage */ }
  }

  useEffect(() => {
    const savedIdentity = readIdentity(customerSlug, locationSlug)
    const draft = readGuestDraft(customerSlug, locationSlug)
    setIdentity(savedIdentity)
    setCheckoutFirstName(savedIdentity.firstName ?? draft.firstName)
    setCategory(searchParams.get('category') ?? 'Tout')
    setShowCategoryListing(searchParams.has('category') || searchParams.has('categoryId'))
  }, [customerSlug, locationSlug])

  useEffect(() => {
    if (!location.pathname.endsWith('/success')) return
    localStorage.removeItem(CART_KEY)
    localStorage.removeItem(guestDraftKey(customerSlug, locationSlug))
    setCart([])
  }, [customerSlug, location.pathname, locationSlug])

  useEffect(() => {
    if (!location.pathname.endsWith('/success') || !successOrderId || !successSessionId) return
    let active = true
    fetch(`${API_URL}/storefront/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/success-details?${new URLSearchParams({ orderId: successOrderId, sessionId: successSessionId })}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as { firstName?: string; email?: string; phone?: string; accountExists?: boolean; message?: string | string[] }
        if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message || tr('Impossible de charger tes coordonnées.', 'Could not load your contact details.'))
        return payload
      })
      .then((details) => {
        if (!active) return
        setSuccessContact((current) => ({
          firstName: details.firstName || current.firstName,
          email: details.email || current.email,
          phone: details.phone || current.phone,
        }))
        if (details.email) setAccessEmail(details.email)
        setSuccessAccountExists(details.accountExists === true)
        setSuccessContactLoaded(true)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setSuccessContactError(reason instanceof Error ? reason.message : tr('Impossible de charger tes coordonnées.', 'Could not load your contact details.'))
        setSuccessContactLoaded(true)
      })
    return () => { active = false }
  }, [customerSlug, location.pathname, locationSlug, successOrderId, successSessionId, isFrench])

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`${API_URL}/storefront/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? tr('Cette boutique est introuvable.', 'This shop could not be found.') : tr('Impossible de charger la boutique.', 'Could not load the shop.'))
        return await response.json() as Catalog
      })
      .then((result) => { if (active) { setCatalog(result); setError('') } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : tr('Une erreur est survenue.', 'Something went wrong.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [customerSlug, locationSlug])

  useEffect(() => {
    if (!location.pathname.endsWith('/success')) return
    const key = whatsappReturnKey(customerSlug, locationSlug)
    let storedUrl = ''
    try { storedUrl = sessionStorage.getItem(key) ?? '' } catch { /* automatic WhatsApp return is unavailable when session storage is blocked */ }
    const returnUrl = storedUrl
    if (!returnUrl) return
    setWhatsappReturnUrl(returnUrl)
    const redirect = window.setTimeout(() => {
      try { sessionStorage.removeItem(key) } catch { /* the return link can expire naturally with the tab */ }
      window.location.assign(returnUrl)
    }, 900)
    return () => window.clearTimeout(redirect)
  }, [customerSlug, location.pathname, locationSlug])

  useEffect(() => {
    const url = new URL(window.location.href)
    const token = url.searchParams.get('token') ?? new URLSearchParams(url.hash.replace(/^#/, '')).get('token')
    const resumeKey = checkoutResumeKey(customerSlug, locationSlug)
    let resumeTimestamp = 0
    try {
      resumeTimestamp = Number(localStorage.getItem(resumeKey))
      localStorage.removeItem(resumeKey)
    } catch { /* use the resume flag in the access URL if storage is unavailable */ }
    const hasRecentLocalResume = Number.isFinite(resumeTimestamp) && resumeTimestamp > 0 && Date.now() - resumeTimestamp <= 15 * 60 * 1000
    const resumeCheckout = url.searchParams.get('resumeCheckout') === '1' || hasRecentLocalResume
    const clearResumeCheckout = () => {
      const currentUrl = new URL(window.location.href)
      currentUrl.searchParams.delete('resumeCheckout')
      window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
    }
    if (!token) {
      if (resumeCheckout) {
        setCheckoutOpen(true)
        setCheckoutError('')
        clearResumeCheckout()
      }
      return
    }
    localStorage.removeItem(sessionKey(customerSlug, locationSlug))
    setIdentity({})
    url.searchParams.delete('token')
    url.hash = ''
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    fetch(`${API_URL}/storefront/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/session`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(tr('Le lien personnalisé a expiré. Tu peux poursuivre ta commande en invité.', 'Your personal link has expired. You can continue as a guest.'))
      return await response.json() as { storeToken: string; identity: Omit<Identity, 'token'> }
    }).then((session) => {
      const next = { ...session.identity, token: session.storeToken }
      localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(next))
      setIdentity(next)
      setCheckoutFirstName(next.firstName ?? '')
      if (resumeCheckout) {
        setCheckoutError('')
        setCheckoutOpen(true)
        clearResumeCheckout()
      }
    }).catch((reason: unknown) => {
      setCheckoutError(reason instanceof Error ? reason.message : tr('Le lien personnalisé a expiré.', 'Your personal link has expired.'))
      if (resumeCheckout) {
        setCheckoutOpen(true)
        clearResumeCheckout()
      }
    })
  }, [customerSlug, isFrench, locationSlug])

  useEffect(() => {
    if (searchParams.get('payment') === 'cancelled') {
      setCheckoutError(tr('Le paiement n’a pas été terminé. Votre panier est toujours là.', 'Payment was not completed. Your cart is still here.'))
      setCheckoutOpen(true)
    }
  }, [isFrench, searchParams])

  const categoryCards = useMemo(() => {
    if (catalog?.categories?.length) return catalog.categories
    const seen = new Set<string>()
    return (catalog?.products ?? []).flatMap((product) => {
      if (seen.has(product.category)) return []
      seen.add(product.category)
      return [{ id: product.categoryId ?? product.category, name: product.category, imageUrl: null, productCount: catalog?.products.filter((item) => item.category === product.category).length ?? 0 }]
    })
  }, [catalog])
  const categories = useMemo(() => ['Tout', ...new Set(categoryCards.map((item) => item.name))], [categoryCards])
  const visibleProducts = useMemo(() => catalog?.products.filter((product) => category === 'Tout' || product.category === category) ?? [], [catalog, category])
  const selectedVariant = selectedProduct?.variants.find((variant) => variant.id === variantId)
  const selectedModifierIds = Object.values(selectedOptions).flat()
  const selectedModifierOptions = selectedProduct?.modifierGroups.flatMap((group) => group.options.filter((option) => selectedModifierIds.includes(option.id))) ?? []
  const selectedUnitPrice = (selectedVariant?.price ?? 0) + selectedModifierOptions.reduce((sum, option) => sum + option.price, 0)
  const totalCount = cart.reduce((sum, line) => sum + line.quantity, 0)
  const total = cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  const currency = catalog?.currency ?? 'EUR'
  const terminalAvailable = catalog?.paymentMethods?.terminal === true

  const openProduct = (product: Product) => {
    if (catalog?.acceptsProductOrders === false) return
    setSelectedProduct(product)
    setEditingCartKey(null)
    setIsPrefillSelection(false)
    setPendingPrefillItems([])
    setPrefillHadUnresolved(false)
    setVariantId(product.variants.find((item) => item.available)?.id ?? '')
    setSelectedProductQuantity(1)
    setSelectedOptions({})
    setOptionError('')
  }

  const showPrefillChoice = (choice: PrefillChoice) => {
    setSelectedProduct(choice.product)
    const availableVariants = choice.product.variants.filter((item) => item.available)
    setVariantId(choice.variant?.id ?? (availableVariants.length === 1 ? availableVariants[0].id : ''))
    setSelectedProductQuantity(choice.quantity)
    setSelectedOptions(choice.options)
    setEditingCartKey(null)
    setIsPrefillSelection(true)
    setOptionError(choice.missingOption
      ? tr('Une option demandée n’a pas été reconnue. Vérifie les choix ci-dessous.', 'A requested option could not be matched. Review the choices below.')
      : '')
  }

  const skipPrefillChoice = () => {
    const [next, ...remaining] = pendingPrefillItems
    setPendingPrefillItems(remaining)
    if (next) {
      showPrefillChoice(next)
      return
    }
    setSelectedProduct(null)
    setIsPrefillSelection(false)
    setCartOpen(true)
    if (prefillHadUnresolved) setCheckoutError(tr('Un autre article demandé n’a pas été reconnu.', 'Another requested item could not be matched.'))
    setPrefillHadUnresolved(false)
  }

  const editCartLine = (line: CartLine) => {
    const product = catalog?.products.find((item) => item.id === line.productId)
    if (!product) return
    setSelectedProduct(product)
    setVariantId(line.variantId)
    setSelectedProductQuantity(line.quantity)
    setEditingCartKey(line.key)
    setSelectedOptions(Object.fromEntries(product.modifierGroups.map((group) => [
      group.id,
      group.options.filter((option) => line.modifierIds.includes(option.id)).map((option) => option.id),
    ])))
    setOptionError('')
    setCartOpen(false)
  }

  const closeProduct = () => {
    if (isPrefillSelection) {
      skipPrefillChoice()
      return
    }
    const returnToCart = editingCartKey !== null
    setSelectedProduct(null)
    setEditingCartKey(null)
    setOptionError('')
    if (returnToCart) setCartOpen(true)
  }

  useEffect(() => {
    const productId = searchParams.get('productId')
    if (!catalog || !productId || handledProductLink.current === productId) return
    const product = catalog.products.find((item) => item.id === productId)
    handledProductLink.current = productId
    if (product) openProduct(product)
    const url = new URL(window.location.href)
    url.searchParams.delete('productId')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [catalog, searchParams])

  const normalizeCatalogLabel = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  useEffect(() => {
    if (!catalog) return
    const requestedCategoryId = searchParams.get('categoryId')
    if (requestedCategoryId) {
      const categoryProduct = catalog.products.find((product) => product.categoryId === requestedCategoryId)
      if (categoryProduct) { setCategory(categoryProduct.category); setShowCategoryListing(true) }
    }
    const encodedCart = searchParams.get('cart')
    const cartLinkKey = `${searchParams.get('token') ?? ''}:${encodedCart ?? ''}`
    if (!encodedCart || handledCartLink.current === cartLinkKey) return
    handledCartLink.current = cartLinkKey
      let requested: Array<{ productId?: string; productName?: string; variantName?: string; modifierNames?: string[]; quantity?: number; isComplete?: boolean }> = []
    try {
      const parsed = JSON.parse(encodedCart)
      if (Array.isArray(parsed)) requested = parsed.slice(0, 10)
    } catch { /* ignore malformed public cart state */ }
    const additions: CartLine[] = []
    const incompleteItems: PrefillChoice[] = []
    let unresolved = false
    for (const item of requested) {
      const name = normalizeCatalogLabel(String(item.productName ?? ''))
      const product = item.productId
        ? catalog.products.find((candidate) => candidate.id === item.productId)
        : (() => {
            const productMatches = catalog.products.filter((candidate) => {
              const productName = normalizeCatalogLabel(candidate.name)
              return productName === name || (name.length > 2 && (productName.includes(name) || name.includes(productName)))
            })
            return productMatches.length === 1 ? productMatches[0] : undefined
          })()
      if (!product) { unresolved = true; continue }
      const availableVariants = product.variants.filter((variant) => variant.available)
      const variantQuery = normalizeCatalogLabel(String(item.variantName ?? ''))
      const variantMatches = variantQuery
        ? availableVariants.filter((variant) => {
            const label = normalizeCatalogLabel(variant.label)
            return label === variantQuery || label.includes(variantQuery) || variantQuery.includes(label)
          })
        : availableVariants.length === 1 ? availableVariants : []
      const variant = variantMatches.length === 1 ? variantMatches[0] : undefined
      const quantity = Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0 ? Math.min(Number(item.quantity), 50) : 1
      const selected: Record<string, string[]> = {}
      let missingOption = false
      for (const modifierName of Array.isArray(item.modifierNames) ? item.modifierNames : []) {
        const modifierQuery = normalizeCatalogLabel(String(modifierName))
        const matches = product.modifierGroups.flatMap((group) => group.options
          .filter((option) => {
            const label = normalizeCatalogLabel(option.name)
            return label === modifierQuery || (modifierQuery.length > 2 && (label.includes(modifierQuery) || modifierQuery.includes(label)))
          })
          .map((option) => ({ group, option })))
        if (matches.length === 1) {
          const { group, option } = matches[0]
          selected[group.id] = group.maxSelect === 1 ? [option.id] : [...(selected[group.id] ?? []), option.id].slice(0, group.maxSelect)
        } else if (modifierQuery) missingOption = true
      }
      const hasRequiredChoice = product.modifierGroups.some((group) => (selected[group.id]?.length ?? 0) < group.minSelect)
      const completeFromLink = typeof item.isComplete === 'boolean' ? item.isComplete : Boolean(variant && !missingOption && !hasRequiredChoice)
      if (!completeFromLink || !variant || missingOption || hasRequiredChoice) {
        incompleteItems.push({ product, variant, options: selected, quantity, missingOption })
        continue
      }
      const modifierOptions = product.modifierGroups.flatMap((group) => group.options.filter((option) => selected[group.id]?.includes(option.id)))
      const modifierIds = modifierOptions.map((option) => option.id).sort()
      const modifierNames = modifierOptions.map((option) => option.name)
      const modifierTotal = modifierOptions.reduce((sum, option) => sum + option.price, 0)
      additions.push({
        key: `${variant.id}:${modifierIds.join(',')}`, productId: product.id, name: product.name,
        variantId: variant.id, variantLabel: variant.label, unitPrice: variant.price + modifierTotal,
        quantity, modifierIds, modifierNames, modifierTotal,
      })
    }
    if (additions.length) {
      setCart((current) => {
        const next = [...current]
        for (const line of additions) {
          const existing = next.find((candidate) => candidate.key === line.key)
          if (existing) {
            const index = next.findIndex((candidate) => candidate.key === line.key)
            next[index] = { ...existing, quantity: existing.quantity + line.quantity }
          }
          else next.push(line)
        }
        return next
      })
    }
    setPrefillHadUnresolved(unresolved)
    if (additions.length && !incompleteItems.length && !unresolved) {
      setCheckoutError('')
      setCartOpen(true)
    }
    if (incompleteItems.length) {
      setPendingPrefillItems(incompleteItems.slice(1))
      showPrefillChoice(incompleteItems[0])
    } else if (unresolved) {
      setCheckoutError(tr('Un article demandé n’a pas pu être reconnu. Vérifie le catalogue avant le paiement.', 'A requested item could not be matched. Please check the catalog before checkout.'))
      setCartOpen(true)
    }
    const url = new URL(window.location.href)
    url.searchParams.delete('cart')
    url.searchParams.delete('categoryId')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [catalog, searchParams])

  const toggleOption = (group: ModifierGroup, option: ProductOption) => {
    setSelectedOptions((current) => {
      const chosen = current[group.id] ?? []
      const next = chosen.includes(option.id)
        ? chosen.filter((id) => id !== option.id)
        : group.maxSelect === 1
          ? [option.id]
          : chosen.length < group.maxSelect ? [...chosen, option.id] : chosen
      return { ...current, [group.id]: next }
    })
    setOptionError('')
  }

  const addSelectedProduct = () => {
    if (catalog?.acceptsProductOrders === false) return
    if (!selectedProduct || !selectedVariant?.available) return
    const missing = selectedProduct.modifierGroups.find((group) => (selectedOptions[group.id]?.length ?? 0) < group.minSelect)
    if (missing) { setOptionError(`Choisis une option pour « ${missing.name} ».`); return }
    const modifierIds = selectedModifierOptions.map((option) => option.id).sort()
    const modifierNames = selectedModifierOptions.map((option) => option.name)
    const modifierTotal = selectedModifierOptions.reduce((sum, option) => sum + option.price, 0)
    const key = `${selectedVariant.id}:${modifierIds.join(',')}`
    const updatedLine: CartLine = {
      key, productId: selectedProduct.id, name: selectedProduct.name, variantId: selectedVariant.id,
      variantLabel: selectedVariant.label, unitPrice: selectedVariant.price + modifierTotal,
      quantity: selectedProductQuantity, modifierIds, modifierNames, modifierTotal,
    }
    setCart((current) => {
      if (editingCartKey) {
        const editedIndex = current.findIndex((line) => line.key === editingCartKey)
        const remaining = current.filter((line) => line.key !== editingCartKey)
        const sameSelection = remaining.find((line) => line.key === key)
        if (sameSelection) return remaining.map((line) => line.key === key ? { ...line, quantity: line.quantity + selectedProductQuantity } : line)
        const insertionIndex = editedIndex < 0 ? remaining.length : Math.min(editedIndex, remaining.length)
        return [...remaining.slice(0, insertionIndex), updatedLine, ...remaining.slice(insertionIndex)]
      }
      const existing = current.find((line) => line.key === key)
      if (existing) return current.map((line) => line.key === key ? { ...line, quantity: line.quantity + selectedProductQuantity } : line)
      return [...current, updatedLine]
    })
    if (isPrefillSelection) {
      const [next, ...remaining] = pendingPrefillItems
      setPendingPrefillItems(remaining)
      if (next) {
        showPrefillChoice(next)
      } else {
        setSelectedProduct(null)
        setIsPrefillSelection(false)
        setCartOpen(true)
        if (prefillHadUnresolved) setCheckoutError(tr('Un autre article demandé n’a pas été reconnu.', 'Another requested item could not be matched.'))
        setPrefillHadUnresolved(false)
      }
    } else {
      setSelectedProduct(null)
      setEditingCartKey(null)
      if (editingCartKey) setCartOpen(true)
    }
  }

  const updateQuantity = (key: string, delta: number) => setCart((current) => current
    .map((line) => line.key === key ? { ...line, quantity: line.quantity + delta } : line)
    .filter((line) => line.quantity > 0))

  const startCheckout = () => {
    if (catalog?.acceptsProductOrders === false) {
      setCheckoutError(tr('La commande de produits est momentanément indisponible dans ce studio.', 'Product ordering is temporarily unavailable at this location.'))
      return
    }
    setCheckoutError('')
    setPaymentMethod('online')
    const savedIdentity = readIdentity(customerSlug, locationSlug)
    const guestDraft = readGuestDraft(customerSlug, locationSlug)
    setIdentity(savedIdentity)
    setCheckoutFirstName(savedIdentity.firstName ?? guestDraft.firstName)
    setCheckoutOpen(true)
    setCartOpen(false)
  }

  const submitCheckout = async (event: React.FormEvent<HTMLFormElement>, selectedMethod: 'online' | 'terminal' = 'online') => {
    event.preventDefault()
    if (catalog?.acceptsProductOrders === false) {
      setCheckoutError(tr('La commande de produits est momentanément indisponible dans ce studio.', 'Product ordering is temporarily unavailable at this location.'))
      return
    }
    setPaymentMethod(selectedMethod)
    setCheckoutError('')
    if (!identity.firstName?.trim() && !checkoutFirstName.trim()) {
      setCheckoutError(tr('Indique ton prénom pour continuer.', 'Enter your first name to continue.'))
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch(`${API_URL}/storefront/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/checkout`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...(identity.token
            ? { token: identity.token, ...(!identity.firstName?.trim() ? { firstName: checkoutFirstName.trim() } : {}) }
            : { firstName: checkoutFirstName.trim() }),
          paymentMethod: selectedMethod,
          language,
          ...(orderNote.trim() ? { note: orderNote.trim() } : {}),
          items: cart.map((line) => ({ variantId: line.variantId, quantity: line.quantity, modifierIds: line.modifierIds })),
        }),
      })
      const payload = await response.json().catch(() => ({})) as { checkoutUrl?: string; storeToken?: string; orderId?: string; shortCode?: string; paymentMethod?: string; awaitingPayment?: boolean; whatsappConnected?: boolean; message?: string | string[] }
      const terminalQueued = selectedMethod === 'terminal' && payload.paymentMethod === 'terminal' && payload.awaitingPayment === true
      if (!response.ok || (selectedMethod === 'terminal' ? !terminalQueued : !payload.checkoutUrl)) {
        const message = Array.isArray(payload.message) ? payload.message.join(' ') : payload.message
        throw new Error(message || tr('Impossible de préparer le paiement. Vérifie le panier et réessaie.', 'Could not prepare payment. Check your cart and try again.'))
      }
      const nextIdentity = {
        ...(identity.token ? identity : {}),
        firstName: identity.firstName?.trim() || checkoutFirstName.trim(),
        ...(payload.storeToken ?? identity.token ? { token: payload.storeToken ?? identity.token } : { token: undefined }),
      }
      localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(nextIdentity))
      if (terminalQueued) {
        setCart([])
        setOrderNote('')
        localStorage.removeItem(guestDraftKey(customerSlug, locationSlug))
        setCheckoutOpen(false)
        setTerminalOrder({ shortCode: payload.shortCode })
        setSubmitting(false)
        return
      }
      if (!payload.checkoutUrl) throw new Error(tr('Stripe n’a pas renvoyé de lien de paiement.', 'Stripe did not return a payment link.'))
      const returnMessage = isFrench
        ? `Bonjour, je viens de terminer le paiement de ma commande${payload.shortCode ? ` #${payload.shortCode}` : ''} chez ${catalog?.location.name ?? 'Ayana'}.`
        : `Hello, I have just completed payment for my order${payload.shortCode ? ` #${payload.shortCode}` : ''} at ${catalog?.location.name ?? 'Ayana'}.`
      const returnUrl = whatsappLink(catalog?.location.whatsappNumber, returnMessage)
      const returnKey = whatsappReturnKey(customerSlug, locationSlug)
      try {
        sessionStorage.removeItem(returnKey)
        if (payload.whatsappConnected && returnUrl) sessionStorage.setItem(returnKey, returnUrl)
      } catch { /* automatic WhatsApp return is unavailable when session storage is blocked */ }
      window.location.assign(payload.checkoutUrl)
    } catch (reason) {
      setCheckoutError(reason instanceof Error ? reason.message : tr('Une erreur est survenue. Réessaie.', 'Something went wrong. Please try again.'))
      setSubmitting(false)
    }
  }

  const handleCheckoutSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const requestedMethod = submitter?.dataset.paymentMethod
    void submitCheckout(event, requestedMethod === 'terminal' ? 'terminal' : 'online')
  }

  const saveSuccessContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSuccessContactError('')
    setSuccessContactSaved(false)
    setSuccessContactLoading(true)
    try {
      const response = await fetch(`${API_URL}/storefront/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/success-contact`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: successOrderId,
          sessionId: successSessionId,
          firstName: successContact.firstName.trim(),
          ...(successContact.email.trim() ? { email: successContact.email.trim() } : {}),
          ...(successContact.phone.trim() ? { phone: successContact.phone.trim() } : {}),
        }),
      })
      const payload = await response.json().catch(() => ({})) as { identity?: { firstName?: string; email?: string; phone?: string }; message?: string | string[] }
      if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message || tr('Impossible d’enregistrer tes coordonnées.', 'Could not save your contact details.'))
      const saved = payload.identity ?? successContact
      setSuccessContact({ firstName: saved.firstName ?? '', email: saved.email ?? '', phone: saved.phone ?? '' })
      setSuccessContactSaved(true)
      setSuccessAccountExists(true)
      const nextIdentity = { ...identity, firstName: saved.firstName, email: saved.email, phone: saved.phone }
      setIdentity(nextIdentity)
      try {
        localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(nextIdentity))
        localStorage.setItem(guestDraftKey(customerSlug, locationSlug), JSON.stringify(saved))
      } catch { /* the contact is saved on the account even if browser storage is unavailable */ }
    } catch (reason) {
      setSuccessContactError(reason instanceof Error ? reason.message : tr('Une erreur est survenue.', 'Something went wrong.'))
    } finally {
      setSuccessContactLoading(false)
    }
  }

  if (location.pathname.endsWith('/success')) {
    return <main className="ayana-store"><header className="store-topbar"><img className="ayana-logo" src={ayanaLogo} alt="Ayana Feelness Club" /><LanguageSelector language={language} onChange={changeLanguage} /></header><section className="store-success"><div className="success-mark">✓</div><p className="store-eyebrow">{tr('Commande Ayana', 'Ayana order')}</p><h1>{tr('Merci pour ta commande !', 'Thank you for your order!')}</h1><p>{whatsappReturnUrl ? tr('Ton paiement est confirmé. Tu retournes sur WhatsApp pour retrouver ta conversation avec Ayana.', 'Your payment is confirmed. You are returning to WhatsApp to continue your conversation with Ayana.') : tr('Ton paiement est confirmé.', 'Your payment is confirmed.')}</p>{orderCode && <strong className="success-code">{orderCode}</strong>}
      {successOrderId && successSessionId && !identity.token && <section className="success-follow-card">
        <h2>{tr('Suivre ta commande', 'Follow your order')}</h2>
        <p>{tr('Retrouve ta commande avec ton compte Ayana.', 'Find your order with your Ayana account.')}</p>
        {successContactLoaded && successAccountExists ? <div className="success-account-details">
          <p className="success-account-linked">{tr('Compte Ayana déjà associé à cette commande', 'Ayana account already linked to this order')}</p>
          <div className="success-account-fields">
            {successContact.firstName && <div className="success-account-field"><span>{tr('Prénom', 'First name')}</span><strong>{successContact.firstName}</strong></div>}
            {successContact.email && <div className="success-account-field"><span>{tr('E-mail utilisé pour le paiement Stripe', 'Email used for Stripe payment')}</span><strong>{successContact.email}</strong></div>}
          </div>
        </div> : <form className="success-contact-form" onSubmit={(event) => void saveSuccessContact(event)}>
          <label>{tr('Prénom', 'First name')}<input autoComplete="given-name" required value={successContact.firstName} onChange={(event) => setSuccessContact((current) => ({ ...current, firstName: event.target.value }))} /></label>
          <label>{tr('E-mail', 'Email')}<input type="email" autoComplete="email" required={!successContact.phone.trim()} readOnly={successContactLoaded && Boolean(successContact.email.trim())} value={successContact.email} onChange={(event) => setSuccessContact((current) => ({ ...current, email: event.target.value }))} /></label>
          <PhoneInput label={tr('Téléphone', 'Phone')} value={successContact.phone} placeholder={tr('Numéro de téléphone', 'Phone number')} required={!successContact.email.trim()} nativeCountrySelector onValueChange={(value) => setSuccessContact((current) => ({ ...current, phone: value }))} />
          <small>{tr('Renseigne au moins un e-mail ou un téléphone.', 'Enter at least an email address or phone number.')}</small>
          <button className="success-contact-submit" type="submit" disabled={successContactLoading || !successContactLoaded}>{successContactLoading ? tr('Enregistrement…', 'Saving…') : tr('Enregistrer mes coordonnées', 'Save my details')}</button>
          {successContactSaved && <p className="success-contact-saved" role="status">{tr('C’est enregistré. Ta commande est associée à ces coordonnées.', 'Saved. Your order is linked to these contact details.')}</p>}
          {successContactError && <p className="store-form-error" role="alert">{successContactError}</p>}
        </form>}
        <div className="success-connect"><span>{tr('Ou connecte-toi à ton compte', 'Or sign in to your account')}</span>{renderAccessButtons('success-connect-login', { orderId: successOrderId, sessionId: successSessionId, code: orderCode, returnToSuccess: true })}</div>
      </section>}
      {identity.token && <section className="success-follow-card success-follow-connected"><h2>{tr('Tu es connecté·e', 'You’re connected')}</h2><p>{tr('Ta commande est associée à ton compte Ayana.', 'Your order is linked to your Ayana account.')}</p><strong>{[identity.firstName, identity.lastName].filter(Boolean).join(' ') || identity.email || identity.phone}</strong></section>}
      {accessError && <p className="store-form-error" role="alert">{accessError}</p>}{whatsappReturnUrl && <a className="store-secondary-link" href={whatsappReturnUrl}>{tr('Retourner sur WhatsApp', 'Return to WhatsApp')} ↗</a>}<a className="store-secondary-link" href={storeBasePath}>{tr('Retour à la boutique', 'Back to the shop')}</a>{renderAccessModal()}</section></main>
  }

  if (loading) return <main className="ayana-store"><div className="store-loading"><span className="store-spinner" />{tr('Ouverture de la boutique…', 'Opening the shop…')}</div></main>
  if (error || !catalog) return <main className="ayana-store"><header className="store-topbar"><img className="ayana-logo" src={ayanaLogo} alt="Ayana Feelness Club" /><LanguageSelector language={language} onChange={changeLanguage} /></header><section className="store-empty"><h1>{tr('Boutique indisponible', 'Shop unavailable')}</h1><p>{error || tr('Cette boutique ne peut pas être affichée pour le moment.', 'This shop is currently unavailable.')}</p></section></main>

  return (
    <main className="ayana-store">
      <header className="store-topbar">
        {showCategoryListing && <button className="store-back" type="button" onClick={() => { setCategory('Tout'); setShowCategoryListing(false) }} aria-label={tr('Retour aux catégories', 'Back to categories')}>←</button>}
        <button className="ayana-logo-link" type="button" onClick={() => { setCategory('Tout'); setShowCategoryListing(false) }} aria-label={tr('Accueil boutique', 'Shop home')}><img className="ayana-logo" src={ayanaLogo} alt="Ayana Feelness Club" /></button>
        <LanguageSelector language={language} onChange={changeLanguage} />
        {catalog.acceptsProductOrders !== false && <button className="store-cart-top" onClick={() => setCartOpen(true)} aria-label={`${tr('Ouvrir le panier', 'Open cart')}, ${totalCount}`}>🛒 <b>{totalCount}</b></button>}
      </header>
      {catalog.acceptsProductOrders === false && <div className="store-notice" role="status">{tr('La boutique ne prend pas de commandes à emporter pour le moment. Réessaie un peu plus tard.', 'The shop is not taking pickup orders right now. Please try again later.')}</div>}
      {checkoutError && !checkoutOpen && <div className="store-notice">{checkoutError}</div>}
      {!showCategoryListing ? <section className="store-category-home">
        <p className="store-eyebrow">{catalog.location.name}</p>
        <h1>{isFrench ? <>Qu’est-ce qui te<br /><em>ferait envie&nbsp;?</em></> : <>What are you<br /><em>craving?</em></>}</h1>
        <p className="store-home-description"></p>
        <div className="store-category-grid">
          {categoryCards.map((item, index) => {
            const imageUrl = item.imageUrl || catalog.products.find((product) =>
              (product.categoryId === item.id || product.category === item.name) && product.imageUrl,
            )?.imageUrl
            return <button className={`store-category-card category-card-${index % 4}`} type="button" key={item.id} onClick={() => { setCategory(item.name); setShowCategoryListing(true) }}>
              {imageUrl ? <img className="store-category-photo" src={imageUrl} alt="" loading="lazy" /> : <span className="store-category-emoji" aria-hidden="true">{categoryEmoji(item.name)}</span>}
              <span className="store-category-name">{item.name}</span><span className="store-category-arrow" aria-hidden="true">→</span>
            </button>
          })}
        </div>
        <button className="store-browse-all" type="button" onClick={() => { setCategory('Tout'); setShowCategoryListing(true) }}>{tr('Tout voir', 'Browse everything')} <span>→</span></button>
      </section> : <>
      <section className="store-category-heading"><p className="store-eyebrow">{catalog.location.name}</p><h1>{category === 'Tout' ? tr('Tout le menu', 'Browse everything') : category}</h1></section>
      <nav className="store-categories" aria-label={tr('Catégories', 'Categories')}>
        {categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => { setCategory(item); setShowCategoryListing(true) }}>{item === 'Tout' ? tr('Tout', 'All') : item}</button>)}
      </nav>
      <section className="store-products">
        {visibleProducts.map((product, index) => {
          const availablePrices = product.variants.filter((variant) => variant.available).map((variant) => variant.price)
          const startPrice = availablePrices.length ? Math.min(...availablePrices) : Number.POSITIVE_INFINITY
          const hasPriceChoices = product.variants.filter((variant) => variant.available).length > 1 || product.modifierGroups.some((group) => group.options.some((option) => option.price > 0))
          return <button className="store-product" key={product.id} disabled={catalog.acceptsProductOrders === false} onClick={() => openProduct(product)}>
            <span className={`product-art art-${index % 4} ${product.imageUrl ? 'product-art-has-image' : 'product-art-no-image'}`}>{product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <span className="product-fallback-emoji" aria-hidden="true">{productEmoji(product.category, product.name)}</span>}</span>
            <span className="product-copy"><span className="product-category">{product.category}</span><strong>{product.name}</strong>{product.description && <span className="product-description">{product.description}</span>}<span className="product-buy">{Number.isFinite(startPrice) ? `${hasPriceChoices ? `${tr('À partir de', 'From')} ` : ''}${money(startPrice, currency, language)}` : tr('Indisponible', 'Unavailable')} <b aria-hidden="true">＋</b></span></span>
          </button>
        })}
        {!visibleProducts.length && <div className="store-empty"><h2>{tr('Aucun article disponible', 'No items available')}</h2><p>{tr('La sélection de cette catégorie arrive bientôt.', 'Items in this category will be available soon.')}</p></div>}
      </section>
      <footer className="store-footer"><span>AYANA FEELNESS CLUB</span><span>{catalog.location.name}</span></footer>
      </>}

      {catalog.acceptsProductOrders !== false && totalCount > 0 && <button className="store-sticky-cart" onClick={() => setCartOpen(true)}><span>{tr('Voir mon panier', 'View cart')} · {totalCount} {tr(totalCount > 1 ? 'articles' : 'article', totalCount > 1 ? 'items' : 'item')}</span><b>{money(total, currency, language)}　→</b></button>}

      {selectedProduct && <div className="store-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeProduct() }}><section className="store-sheet" role="dialog" aria-modal="true" aria-label={selectedProduct.name}>
        <button className="sheet-close" onClick={closeProduct} aria-label={tr('Fermer', 'Close')}>×</button>
        <div className={`product-sheet-photo ${selectedProduct.imageUrl ? 'product-sheet-photo-has-image' : 'product-sheet-photo-no-image'}`}>{selectedProduct.imageUrl ? <img src={selectedProduct.imageUrl} alt="" /> : <span aria-hidden="true">{productEmoji(selectedProduct.category, selectedProduct.name)}</span>}</div>
        <p className="store-eyebrow">{selectedProduct.category}</p><h2>{selectedProduct.name}</h2>{selectedProduct.description && <p className="sheet-description">{selectedProduct.description}</p>}
        <label className="product-quantity-field">{tr('Quantité', 'Quantity')}<input type="number" min={1} max={50} step={1} value={selectedProductQuantity} onChange={(event) => setSelectedProductQuantity(Math.max(1, Math.min(50, Math.floor(Number(event.target.value) || 1))))} /></label>
        {selectedProduct.variants.length > 1 && <fieldset className="option-section"><legend>{tr('Choisis ton format', 'Choose a size')}</legend>{selectedProduct.variants.map((variant) => <button type="button" key={variant.id} disabled={!variant.available} onClick={() => setVariantId(variant.id)} className={`option-choice ${variantId === variant.id ? 'chosen' : ''}`}><span>{variant.label}</span><b>{variant.available ? money(variant.price, currency, language) : tr('Épuisé', 'Sold out')}</b></button>)}</fieldset>}
        {selectedProduct.modifierGroups.map((group) => <fieldset className="option-section" key={group.id}><legend>{group.name}{group.required || group.minSelect > 0 ? <small> · {tr('obligatoire', 'required')}</small> : <small> · {tr('au choix', 'optional')}</small>}</legend>{group.options.map((option) => <button type="button" key={option.id} className={`option-choice ${(selectedOptions[group.id] ?? []).includes(option.id) ? 'chosen' : ''}`} onClick={() => toggleOption(group, option)}><span>{option.name}</span><b>{option.price ? `+ ${money(option.price, currency, language)}` : tr('Inclus', 'Included')}</b></button>)}</fieldset>)}
        {optionError && <p className="store-form-error">{optionError}</p>}<button className="store-primary product-sheet-primary" disabled={!selectedVariant?.available} onClick={addSelectedProduct}><span>{tr(editingCartKey ? 'Enregistrer les modifications' : 'Ajouter au panier', editingCartKey ? 'Save changes' : 'Add to cart')}</span><b>{money(selectedUnitPrice * selectedProductQuantity, currency, language)}</b></button>
        {isPrefillSelection && <button type="button" className="store-text-button prefill-skip" onClick={skipPrefillChoice}>{tr('Ignorer cet article', 'Skip this item')}</button>}
      </section></div>}

      {cartOpen && <div className="store-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false) }}><section className="store-sheet" role="dialog" aria-modal="true" aria-label={tr('Ton panier', 'Your cart')}>
        <button className="sheet-close" onClick={() => setCartOpen(false)} aria-label={tr('Fermer', 'Close')}>×</button><p className="store-eyebrow">{tr('Ta sélection', 'Your selection')}</p><h2>{tr('Ton panier', 'Your cart')}</h2>
        {!cart.length ? <div className="store-empty"><p>{tr('Ton panier est vide.', 'Your cart is empty.')}</p><button className="store-text-button" onClick={() => setCartOpen(false)}>{tr('Continuer mes achats', 'Continue shopping')}</button></div> : <>
          <div className="cart-lines">{cart.map((line) => <article className="cart-line" key={line.key}><div className="cart-line-info"><strong>{line.name}</strong><small>{line.variantLabel}{line.modifierNames.length ? ` · ${line.modifierNames.join(', ')}` : ''}</small><button className="cart-line-edit" type="button" onClick={() => editCartLine(line)}>{tr('Modifier les options', 'Edit options')}</button><b>{money(line.unitPrice * line.quantity, currency, language)}</b></div><div className="quantity-picker"><button onClick={() => updateQuantity(line.key, -1)} aria-label={tr('Retirer un article', 'Remove one item')}>−</button><span>{line.quantity}</span><button onClick={() => updateQuantity(line.key, 1)} aria-label={tr('Ajouter un article', 'Add one item')}>＋</button></div></article>)}</div>
          <label className="cart-order-note">{tr('Note pour la commande (facultatif)', 'Order note (optional)')}<textarea maxLength={1000} rows={2} value={orderNote} onChange={(event) => setOrderNote(event.target.value)} placeholder={tr('Une précision pour le Feelness Bar…', 'Anything the Feelness Bar should know…')} /></label>
          <div className="cart-total"><span>{tr('Total', 'Subtotal')}</span><b>{money(total, currency, language)}</b></div><p className="cart-note">{tr(`À retirer au Feelness Bar de ${catalog.location.name}.`, `Pick up at the Feelness Bar in ${catalog.location.name}.`)}</p><button className="store-primary" onClick={startCheckout}>{tr('Passer la commande', 'Continue to checkout')} <span>→</span></button>
        </>}
      </section></div>}

      {terminalOrder && <div className="store-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setTerminalOrder(null) }}><section className="store-sheet terminal-payment-sheet" role="dialog" aria-modal="true" aria-label={tr('Paiement sur place', 'Pay at the shop')}>
        <button className="sheet-close" onClick={() => setTerminalOrder(null)} aria-label={tr('Fermer', 'Close')}>×</button>
        <div className="terminal-payment-mark">▣</div>
        <p className="store-eyebrow">{tr('Paiement sur place', 'Pay at the shop')}</p>
        <h2>{tr('Paiement en attente', 'Payment pending')}</h2>
        <p className="sheet-description">{tr('Ta commande est enregistrée. L’équipe va activer le terminal pour le paiement.', 'Your order is saved. The team will activate the terminal for payment.')}</p>
        {terminalOrder.shortCode && <div className="terminal-order-code"><span>{tr('Code de commande', 'Order code')}</span><strong>{terminalOrder.shortCode}</strong></div>}
        <button className="store-primary" onClick={() => setTerminalOrder(null)}>{tr('Compris', 'Got it')}</button>
      </section></div>}

      {checkoutOpen && <div className="store-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setCheckoutOpen(false) }}><section className="store-sheet checkout-sheet" role="dialog" aria-modal="true" aria-label={identity.token ? tr('Paiement', 'Payment') : tr('Connexion', 'Sign in')}>
        <button className="sheet-close" onClick={() => setCheckoutOpen(false)} aria-label={tr('Fermer', 'Close')} disabled={submitting}>×</button>
        <p className="store-eyebrow">{tr('Ta commande', 'Your order')}</p>
        {checkoutError && <p className="store-form-error">{checkoutError}</p>}
        {!identity.token ? <>
          <h2>{tr('Commander en invité', 'Guest checkout')}</h2>
          <p className="sheet-description">{tr('Règle ta commande en quelques instants. Stripe demandera l’e-mail du reçu pour un paiement en ligne.', 'Place your order in a few moments. Stripe will ask for an email receipt for online payment.')}</p>
          <div className="checkout-total"><span>{tr('À payer', 'Due now')}</span><b>{money(total, currency, language)}</b></div>
          <form className="store-checkout-form" onSubmit={handleCheckoutSubmit}>
            <label>{tr('Prénom', 'First name')}<input autoComplete="given-name" required maxLength={80} value={checkoutFirstName} onChange={(event) => updateGuestDraft(event.target.value)} /></label>
          <PaymentActions language={language} terminalAvailable={terminalAvailable} submitting={submitting} paymentMethod={paymentMethod} />
          </form>
          <div className="checkout-login-suggestion"><span>{tr('Déjà membre Ayana ?', 'Already an Ayana member?')}</span>{renderAccessButtons('checkout-login-link', { resumeCheckout: true })}</div>
          {accessError && <p className="store-form-error" role="alert">{accessError}</p>}
        </> : <>
          <h2>{tr('Paiement de la commande', 'Order payment')}</h2>
          <div className="saved-identity"><span>{tr('Compte Ayana connecté', 'Ayana account connected')}</span><strong>{[identity.firstName, identity.lastName].filter(Boolean).join(' ') || identity.email}</strong></div>
          <div className="checkout-total"><span>{tr('À payer', 'Due now')}</span><b>{money(total, currency, language)}</b></div>
          {!terminalAvailable && <p className="secure-note">{tr('Stripe te demandera l’e-mail pour le reçu. Le paiement est sécurisé et la commande sera confirmée après validation.', 'Stripe will collect the email for your receipt. Payment is secure, and your order will be confirmed once payment is complete.')}</p>}
          <form className="store-checkout-form" onSubmit={handleCheckoutSubmit}>
            {!identity.firstName?.trim() && <label>{tr('Ton prénom', 'Your first name')}<input autoComplete="given-name" required maxLength={80} value={checkoutFirstName} onChange={(event) => setCheckoutFirstName(event.target.value)} /></label>}
            <PaymentActions language={language} terminalAvailable={terminalAvailable} submitting={submitting} paymentMethod={paymentMethod} />
          </form>
        </>}
      </section></div>}

      {renderAccessModal()}
    </main>
  )
}

export function StorefrontPage() { return <StorefrontRoute /> }

function PaymentActions({ language, terminalAvailable, submitting, paymentMethod }: { language: StorefrontLanguage; terminalAvailable: boolean; submitting: boolean; paymentMethod: 'online' | 'terminal' }) {
  const isFrench = language === 'fr'
  if (terminalAvailable) return <div className="payment-method-actions">
    <button type="submit" data-payment-method="online" className="store-primary payment-online" disabled={submitting}>
      <span>{submitting && paymentMethod === 'online' ? (isFrench ? 'Préparation du paiement…' : 'Preparing payment…') : (isFrench ? 'Payer en ligne par carte' : 'Pay online by card')}</span><span aria-hidden="true">→</span>
    </button>
    <button type="submit" data-payment-method="terminal" className="payment-choice-terminal" disabled={submitting}>
      <strong>{submitting && paymentMethod === 'terminal' ? (isFrench ? 'Enregistrement de la commande…' : 'Saving your order…') : (isFrench ? 'Payer sur place par carte' : 'Pay by card at the shop')}</strong>
      <span aria-hidden="true">→</span>
    </button>
  </div>
  return <button type="submit" data-payment-method="online" className="store-primary" disabled={submitting}>
    {submitting ? (paymentMethod === 'terminal' ? (isFrench ? 'Envoi au terminal…' : 'Sending to terminal…') : (isFrench ? 'Préparation du paiement…' : 'Preparing payment…')) : (isFrench ? 'Payer en toute sécurité' : 'Pay securely')} <span>→</span>
  </button>
}

function LanguageSelector({ language, onChange }: { language: StorefrontLanguage; onChange: (language: StorefrontLanguage) => void }) {
  return <div className="store-language" role="group" aria-label={language === 'fr' ? 'Langue' : 'Language'}>
    <button type="button" aria-pressed={language === 'fr'} className={language === 'fr' ? 'active' : ''} onClick={() => onChange('fr')}>FR</button>
    <button type="button" aria-pressed={language === 'en'} className={language === 'en' ? 'active' : ''} onClick={() => onChange('en')}>EN</button>
  </div>
}

export function StorefrontApp() {
  return <BrowserRouter><Routes><Route path="/:customerSlug/:locationSlug/success" element={<StorefrontRoute />} /><Route path="/:customerSlug/:locationSlug" element={<StorefrontRoute />} /><Route path="*" element={<main className="ayana-store"><section className="store-empty"><h1>Boutique Ayana</h1><p>Le lien de la boutique est incomplet.</p></section></main>} /></Routes></BrowserRouter>
}
