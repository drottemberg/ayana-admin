import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom'
import ayanaLogo from '@/assets/ayana-logo.png'
import { PhoneInput } from '@/components/ui/phone-input'
import { validatePhone } from '@/lib/phone'
import './storefront.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'
const CART_KEY = 'ayana-storefront-cart'

type ProductOption = { id: string; name: string; price: number }
type ModifierGroup = { id: string; name: string; required: boolean; minSelect: number; maxSelect: number; options: ProductOption[] }
type Variant = { id: string; label: string; price: number; stock: number; available: boolean }
type Product = { id: string; name: string; description?: string | null; category: string; imageUrl?: string | null; variants: Variant[]; modifierGroups: ModifierGroup[] }
type Catalog = { customer: { name: string; slug: string }; location: { name: string; slug: string; whatsappNumber?: string | null }; currency: string; products: Product[] }
type CartLine = { key: string; productId: string; name: string; variantId: string; variantLabel: string; unitPrice: number; quantity: number; modifierIds: string[]; modifierNames: string[]; modifierTotal: number }
type Identity = { token?: string; firstName?: string; lastName?: string; email?: string; phone?: string }
type StorefrontLanguage = 'fr' | 'en'
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

function StorefrontRoute() {
  const { customerSlug = '', locationSlug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [language, setLanguage] = useState<StorefrontLanguage>(readStorefrontLanguage)
  const [whatsappReturnUrl, setWhatsappReturnUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('Tout')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [variantId, setVariantId] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({})
  const [optionError, setOptionError] = useState('')
  const [cart, setCart] = useState<CartLine[]>(readCart)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [identity, setIdentity] = useState<Identity>(() => readIdentity(customerSlug, locationSlug))
  const [checkoutFirstName, setCheckoutFirstName] = useState(() => readIdentity(customerSlug, locationSlug).firstName ?? '')
  const [checkoutPhone, setCheckoutPhone] = useState(() => readIdentity(customerSlug, locationSlug).phone ?? '')
  const [checkoutEmail, setCheckoutEmail] = useState(() => readIdentity(customerSlug, locationSlug).email ?? '')
  const handledProductLink = useRef('')
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const isFrench = language === 'fr'
  const tr = (fr: string, en: string) => isFrench ? fr : en
  const changeLanguage = (nextLanguage: StorefrontLanguage) => {
    setLanguage(nextLanguage)
    try { localStorage.setItem(STORE_LANGUAGE_KEY, nextLanguage) } catch { /* language still changes for this visit */ }
  }
  const storeBasePath = location.pathname.startsWith('/store/') ? `/store/${customerSlug}/${locationSlug}` : `/${customerSlug}/${locationSlug}`
  const whatsappMessage = isFrench
    ? `Connecte-moi à la boutique pour commander à emporter chez ${catalog?.location.name ?? 'Ayana'}.`
    : `Connect me to the shop to order takeaway from ${catalog?.location.name ?? 'Ayana'}.`
  const whatsappHref = whatsappLink(catalog?.location.whatsappNumber, whatsappMessage)
  const orderCode = searchParams.get('code')?.trim()
  const trackOrderMessage = `${tr('Suivre ma commande', 'Track my order')}${orderCode ? ` ${orderCode}` : ''}`
  const trackOrderHref = whatsappLink(catalog?.location.whatsappNumber, trackOrderMessage)

  const logout = () => {
    try { localStorage.removeItem(sessionKey(customerSlug, locationSlug)) } catch { /* clear in-memory identity even if storage is unavailable */ }
    setIdentity({})
    setCheckoutError('')
  }

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    if (!location.pathname.endsWith('/success')) return
    localStorage.removeItem(CART_KEY)
    setCart([])
  }, [location.pathname])

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
    if (!token) return
    localStorage.removeItem(sessionKey(customerSlug, locationSlug))
    setIdentity({})
    url.searchParams.delete('token')
    url.hash = ''
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    fetch(`${API_URL}/storefront/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/session`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(tr('Le lien personnalisé a expiré. Tu peux poursuivre avec tes coordonnées.', 'Your personal link has expired. You can continue with your contact details.'))
      return await response.json() as { storeToken: string; identity: Omit<Identity, 'token'> }
    }).then((session) => {
      const next = { ...session.identity, token: session.storeToken }
      localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(next))
      setIdentity(next)
      setCheckoutFirstName(next.firstName ?? '')
      setCheckoutPhone(next.phone ?? '')
      setCheckoutEmail(next.email ?? '')
    }).catch((reason: unknown) => {
      setCheckoutError(reason instanceof Error ? reason.message : tr('Le lien personnalisé a expiré.', 'Your personal link has expired.'))
    })
  }, [customerSlug, isFrench, locationSlug])

  useEffect(() => {
    if (searchParams.get('payment') === 'cancelled') {
      setCheckoutError(tr('Le paiement n’a pas été terminé. Votre panier est toujours là.', 'Payment was not completed. Your cart is still here.'))
      setCheckoutOpen(true)
    }
  }, [isFrench, searchParams])

  const categories = useMemo(() => ['Tout', ...new Set(catalog?.products.map((product) => product.category) ?? [])], [catalog])
  const visibleProducts = useMemo(() => catalog?.products.filter((product) => category === 'Tout' || product.category === category) ?? [], [catalog, category])
  const selectedVariant = selectedProduct?.variants.find((variant) => variant.id === variantId)
  const selectedModifierIds = Object.values(selectedOptions).flat()
  const selectedModifierOptions = selectedProduct?.modifierGroups.flatMap((group) => group.options.filter((option) => selectedModifierIds.includes(option.id))) ?? []
  const selectedUnitPrice = (selectedVariant?.price ?? 0) + selectedModifierOptions.reduce((sum, option) => sum + option.price, 0)
  const totalCount = cart.reduce((sum, line) => sum + line.quantity, 0)
  const total = cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  const currency = catalog?.currency ?? 'EUR'

  const openProduct = (product: Product) => {
    setSelectedProduct(product)
    setVariantId(product.variants.find((item) => item.available)?.id ?? '')
    setSelectedOptions({})
    setOptionError('')
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
    if (!selectedProduct || !selectedVariant?.available) return
    const missing = selectedProduct.modifierGroups.find((group) => (selectedOptions[group.id]?.length ?? 0) < group.minSelect)
    if (missing) { setOptionError(`Choisis une option pour « ${missing.name} ».`); return }
    const modifierIds = selectedModifierOptions.map((option) => option.id).sort()
    const modifierNames = selectedModifierOptions.map((option) => option.name)
    const modifierTotal = selectedModifierOptions.reduce((sum, option) => sum + option.price, 0)
    const key = `${selectedVariant.id}:${modifierIds.join(',')}`
    setCart((current) => {
      const existing = current.find((line) => line.key === key)
      if (existing) return current.map((line) => line.key === key ? { ...line, quantity: line.quantity + 1 } : line)
      return [...current, {
        key, productId: selectedProduct.id, name: selectedProduct.name, variantId: selectedVariant.id,
        variantLabel: selectedVariant.label, unitPrice: selectedVariant.price + modifierTotal,
        quantity: 1, modifierIds, modifierNames, modifierTotal,
      }]
    })
    setSelectedProduct(null)
  }

  const updateQuantity = (key: string, delta: number) => setCart((current) => current
    .map((line) => line.key === key ? { ...line, quantity: line.quantity + delta } : line)
    .filter((line) => line.quantity > 0))

  const startCheckout = () => {
    setCheckoutError('')
    const savedIdentity = readIdentity(customerSlug, locationSlug)
    setIdentity(savedIdentity)
    setCheckoutFirstName(savedIdentity.firstName ?? '')
    setCheckoutPhone(savedIdentity.phone ?? '')
    setCheckoutEmail(savedIdentity.email ?? '')
    setCheckoutOpen(true)
    setCartOpen(false)
  }

  const submitCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCheckoutError('')
    if (!identity.firstName?.trim() && !checkoutFirstName.trim()) {
      setCheckoutError(tr('Indique ton prénom pour continuer.', 'Enter your first name to continue.'))
      return
    }
    if (!identity.token && validatePhone(checkoutPhone)) {
      setCheckoutError(tr('Entre un numéro de téléphone valide avec son indicatif.', 'Enter a valid phone number with its country code.'))
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch(`${API_URL}/storefront/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/checkout`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...(identity.token
            ? { token: identity.token, ...(!identity.firstName?.trim() ? { firstName: checkoutFirstName.trim() } : {}) }
            : { firstName: checkoutFirstName.trim(), phone: checkoutPhone, email: checkoutEmail.trim() }),
          language,
          items: cart.map((line) => ({ variantId: line.variantId, quantity: line.quantity, modifierIds: line.modifierIds })),
        }),
      })
      const payload = await response.json().catch(() => ({})) as { checkoutUrl?: string; storeToken?: string; orderId?: string; shortCode?: string; whatsappConnected?: boolean; message?: string | string[] }
      if (!response.ok || !payload.checkoutUrl) {
        const message = Array.isArray(payload.message) ? payload.message.join(' ') : payload.message
        throw new Error(message || tr('Impossible de préparer le paiement. Vérifie le panier et réessaie.', 'Could not prepare payment. Check your cart and try again.'))
      }
      const nextIdentity = {
        ...identity,
        firstName: identity.firstName?.trim() || checkoutFirstName.trim(),
        ...(!identity.token ? { phone: checkoutPhone, email: checkoutEmail.trim() } : {}),
        ...(payload.storeToken ?? identity.token ? { token: payload.storeToken ?? identity.token } : { token: undefined }),
      }
      localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(nextIdentity))
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

  if (location.pathname.endsWith('/success')) {
    return <main className="ayana-store"><header className="store-topbar"><img className="ayana-logo" src={ayanaLogo} alt="Ayana Feelness Club" /><LanguageSelector language={language} onChange={changeLanguage} /></header><section className="store-success"><div className="success-mark">✓</div><p className="store-eyebrow">{tr('Commande Ayana', 'Ayana order')}</p><h1>{tr('Merci pour ta commande !', 'Thank you for your order!')}</h1><p>{whatsappReturnUrl ? tr('Ton paiement est en cours de confirmation. Tu retournes sur WhatsApp pour retrouver ta conversation avec Ayana.', 'Your payment is being confirmed. You are returning to WhatsApp to continue your conversation with Ayana.') : tr('Ton paiement est en cours de confirmation. Tu peux fermer cette page ou retourner à la boutique.', 'Your payment is being confirmed. You can close this page or return to the shop.')}</p>{orderCode && <strong className="success-code">{orderCode}</strong>}{trackOrderHref && <a className="store-primary" href={trackOrderHref} target="_blank" rel="noreferrer">{tr('Se connecter avec WhatsApp pour suivre ma commande', 'Connect with WhatsApp to follow my order')} <span>↗</span></a>}{whatsappReturnUrl && <a className="store-secondary-link" href={whatsappReturnUrl}>{tr('Retourner sur WhatsApp', 'Return to WhatsApp')} ↗</a>}<a className="store-secondary-link" href={storeBasePath}>{tr('Retour à la boutique', 'Back to the shop')}</a></section></main>
  }

  if (loading) return <main className="ayana-store"><div className="store-loading"><span className="store-spinner" />{tr('Ouverture de la boutique…', 'Opening the shop…')}</div></main>
  if (error || !catalog) return <main className="ayana-store"><header className="store-topbar"><img className="ayana-logo" src={ayanaLogo} alt="Ayana Feelness Club" /><LanguageSelector language={language} onChange={changeLanguage} /></header><section className="store-empty"><h1>{tr('Boutique indisponible', 'Shop unavailable')}</h1><p>{error || tr('Cette boutique ne peut pas être affichée pour le moment.', 'This shop is currently unavailable.')}</p></section></main>

  return (
    <main className="ayana-store">
      <header className="store-topbar"><a className="ayana-logo-link" href={storeBasePath}><img className="ayana-logo" src={ayanaLogo} alt="Ayana Feelness Club" /></a><LanguageSelector language={language} onChange={changeLanguage} /><button className="store-cart-top" onClick={() => setCartOpen(true)} aria-label={tr('Ouvrir le panier', 'Open cart')}>{tr('Panier', 'Cart')} <b>{totalCount}</b></button></header>
      <section className="store-hero">
        <p className="store-eyebrow">{catalog.location.name}</p>
        <h1>{isFrench ? <>Un peu de douceur,<br /><em>à emporter.</em></> : <>A little something<br /><em>to take away.</em></>}</h1>
        <p>{tr('Café, matcha et essentiels Ayana. Choisis, personnalise, puis règle ta commande en toute simplicité.', 'Coffee, matcha and Ayana essentials. Choose your items, customise them, then check out with ease.')}</p>
        <span className="hero-sun" aria-hidden="true">✳</span>
      </section>
      {identity.token
        ? <section className="store-account-card"><div><span>{tr('Connecté·e', 'Signed in')}</span><strong>{[identity.firstName, identity.lastName].filter(Boolean).join(' ') || identity.email}</strong></div><button type="button" className="store-account-logout" onClick={logout} aria-label={tr('Se déconnecter', 'Log out')} title={tr('Se déconnecter', 'Log out')}>↪</button></section>
        : whatsappHref && <section className="store-account-card store-account-login"><div><strong>{tr('Commande avec ton compte Ayana', 'Order with your Ayana account')}</strong></div><a className="store-login-cta" href={whatsappHref} target="_blank" rel="noreferrer">{tr('Se connecter avec WhatsApp', 'Connect with WhatsApp')} <span>↗</span></a></section>}
      {checkoutError && !checkoutOpen && <div className="store-notice">{checkoutError}</div>}
      <nav className="store-categories" aria-label={tr('Catégories', 'Categories')}>
        {categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item === 'Tout' ? tr('Tout', 'All') : item}</button>)}
      </nav>
      <section className="store-products">
        {visibleProducts.map((product, index) => {
          const availablePrices = product.variants.filter((variant) => variant.available).map((variant) => variant.price)
          const startPrice = availablePrices.length ? Math.min(...availablePrices) : Number.POSITIVE_INFINITY
          return <button className="store-product" key={product.id} onClick={() => openProduct(product)}>
            <span className={`product-art art-${index % 4}`}>{product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <span>{product.category.toLowerCase().includes('good') ? '✳' : '◌'}</span>}</span>
            <span className="product-copy"><span className="product-category">{product.category}</span><strong>{product.name}</strong>{product.description && <span className="product-description">{product.description}</span>}<span className="product-buy">{Number.isFinite(startPrice) ? `${tr('À partir de', 'From')} ${money(startPrice, currency, language)}` : tr('Indisponible', 'Unavailable')} <b aria-hidden="true">＋</b></span></span>
          </button>
        })}
        {!visibleProducts.length && <div className="store-empty"><h2>{tr('Aucun article disponible', 'No items available')}</h2><p>{tr('La sélection de cette catégorie arrive bientôt.', 'Items in this category will be available soon.')}</p></div>}
      </section>
      <footer className="store-footer"><span>AYANA FEELNESS CLUB</span><span>{catalog.location.name}</span></footer>

      {totalCount > 0 && <button className="store-sticky-cart" onClick={() => setCartOpen(true)}><span>{tr('Voir mon panier', 'View my cart')} <small>{totalCount} {tr(totalCount > 1 ? 'articles' : 'article', totalCount > 1 ? 'items' : 'item')}</small></span><b>{money(total, currency, language)}　→</b></button>}

      {selectedProduct && <div className="store-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProduct(null) }}><section className="store-sheet" role="dialog" aria-modal="true" aria-label={selectedProduct.name}>
        <button className="sheet-close" onClick={() => setSelectedProduct(null)} aria-label={tr('Fermer', 'Close')}>×</button><p className="store-eyebrow">{selectedProduct.category}</p><h2>{selectedProduct.name}</h2>{selectedProduct.description && <p className="sheet-description">{selectedProduct.description}</p>}
        {selectedProduct.variants.length > 1 && <fieldset className="option-section"><legend>{tr('Choisis ton format', 'Choose a size')}</legend>{selectedProduct.variants.map((variant) => <button type="button" key={variant.id} disabled={!variant.available} onClick={() => setVariantId(variant.id)} className={`option-choice ${variantId === variant.id ? 'chosen' : ''}`}><span>{variant.label}</span><b>{variant.available ? money(variant.price, currency, language) : tr('Épuisé', 'Sold out')}</b></button>)}</fieldset>}
        {selectedProduct.modifierGroups.map((group) => <fieldset className="option-section" key={group.id}><legend>{group.name}{group.required || group.minSelect > 0 ? <small> · {tr('obligatoire', 'required')}</small> : <small> · {tr('au choix', 'optional')}</small>}</legend>{group.options.map((option) => <button type="button" key={option.id} className={`option-choice ${(selectedOptions[group.id] ?? []).includes(option.id) ? 'chosen' : ''}`} onClick={() => toggleOption(group, option)}><span>{option.name}</span><b>{option.price ? `+ ${money(option.price, currency, language)}` : tr('Inclus', 'Included')}</b></button>)}</fieldset>)}
        {optionError && <p className="store-form-error">{optionError}</p>}<button className="store-primary" disabled={!selectedVariant?.available} onClick={addSelectedProduct}><span>{tr('Ajouter au panier', 'Add to cart')}</span><b>{money(selectedUnitPrice, currency, language)}</b></button>
      </section></div>}

      {cartOpen && <div className="store-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false) }}><section className="store-sheet" role="dialog" aria-modal="true" aria-label={tr('Ton panier', 'Your cart')}>
        <button className="sheet-close" onClick={() => setCartOpen(false)} aria-label={tr('Fermer', 'Close')}>×</button><p className="store-eyebrow">{tr('Ta sélection', 'Your selection')}</p><h2>{tr('Ton panier', 'Your cart')}</h2>
        {!cart.length ? <div className="store-empty"><p>{tr('Ton panier est vide.', 'Your cart is empty.')}</p><button className="store-text-button" onClick={() => setCartOpen(false)}>{tr('Continuer mes achats', 'Continue shopping')}</button></div> : <>
          <div className="cart-lines">{cart.map((line) => <article className="cart-line" key={line.key}><div><strong>{line.name}</strong><small>{line.variantLabel}{line.modifierNames.length ? ` · ${line.modifierNames.join(', ')}` : ''}</small><b>{money(line.unitPrice * line.quantity, currency, language)}</b></div><div className="quantity-picker"><button onClick={() => updateQuantity(line.key, -1)} aria-label={tr('Retirer un article', 'Remove one item')}>−</button><span>{line.quantity}</span><button onClick={() => updateQuantity(line.key, 1)} aria-label={tr('Ajouter un article', 'Add one item')}>＋</button></div></article>)}</div>
          <div className="cart-total"><span>{tr('Total', 'Total')}</span><b>{money(total, currency, language)}</b></div><p className="cart-note">{tr(`Le retrait se fait au Feelness Bar de ${catalog.location.name}.`, `Pickup is at the Feelness Bar in ${catalog.location.name}.`)}</p><button className="store-primary" onClick={startCheckout}>{tr('Continuer', 'Continue')} <span>→</span></button>
        </>}
      </section></div>}

      {checkoutOpen && <div className="store-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setCheckoutOpen(false) }}><section className="store-sheet checkout-sheet" role="dialog" aria-modal="true" aria-label={identity.token ? tr('Paiement', 'Payment') : tr('Connexion WhatsApp', 'WhatsApp sign-in')}>
        <button className="sheet-close" onClick={() => setCheckoutOpen(false)} aria-label={tr('Fermer', 'Close')} disabled={submitting}>×</button>
        <p className="store-eyebrow">{tr('Ta commande', 'Your order')}</p>
        {checkoutError && <p className="store-form-error">{checkoutError}</p>}
        {!identity.token ? <>
          <h2>{tr('Comment veux-tu continuer ?', 'How would you like to continue?')}</h2>
          <p className="sheet-description">{tr('Connecte-toi avec WhatsApp pour retrouver ton compte, ou commande en invité avec tes coordonnées.', 'Connect with WhatsApp to use your Ayana account, or continue as a guest with your contact details.')}</p>
          {whatsappHref
            ? <a className="store-primary store-whatsapp-login" href={whatsappHref} target="_blank" rel="noreferrer">{tr('Se connecter avec WhatsApp', 'Connect with WhatsApp')} <span>↗</span></a>
            : null}
          <div className="checkout-total"><span>{tr('À payer', 'Due now')}</span><b>{money(total, currency, language)}</b></div>
          <p className="checkout-divider"><span>{tr('ou commander sans WhatsApp', 'or continue without WhatsApp')}</span></p>
          <form className="store-checkout-form" onSubmit={submitCheckout}>
            <label>{tr('Prénom', 'First name')}<input autoComplete="given-name" required maxLength={80} value={checkoutFirstName} onChange={(event) => setCheckoutFirstName(event.target.value)} /></label>
            <PhoneInput label={tr('Téléphone', 'Phone number')} value={checkoutPhone} placeholder={tr('Numéro de téléphone', 'Phone number')} required nativeCountrySelector onValueChange={setCheckoutPhone} />
            <label>{tr('E-mail', 'Email')}<input type="email" autoComplete="email" required maxLength={254} value={checkoutEmail} onChange={(event) => setCheckoutEmail(event.target.value)} /></label>
            <button className="store-primary" disabled={submitting}>{submitting ? tr('Préparation du paiement…', 'Preparing payment…') : tr('Payer en toute sécurité', 'Pay securely')} <span>→</span></button>
          </form>
          <p className="secure-note">{tr('Le panier reste enregistré si tu reviens après la connexion.', 'Your cart is saved if you return after signing in.')}</p>
        </> : <>
          <h2>{tr('Paiement de la commande', 'Order payment')}</h2>
          <div className="saved-identity"><span>{tr('Compte Ayana connecté', 'Ayana account connected')}</span><strong>{[identity.firstName, identity.lastName].filter(Boolean).join(' ') || identity.email}</strong></div>
          <div className="checkout-total"><span>{tr('À payer', 'Due now')}</span><b>{money(total, currency, language)}</b></div>
          <p className="secure-note">{tr('Stripe te demandera l’e-mail pour le reçu. Le paiement est sécurisé et la commande sera confirmée après validation.', 'Stripe will collect the email for your receipt. Payment is secure, and your order will be confirmed once payment is complete.')}</p>
          <form className="store-checkout-form" onSubmit={submitCheckout}>
            {!identity.firstName?.trim() && <label>{tr('Ton prénom', 'Your first name')}<input autoComplete="given-name" required maxLength={80} value={checkoutFirstName} onChange={(event) => setCheckoutFirstName(event.target.value)} /></label>}
            <button className="store-primary" disabled={submitting}>{submitting ? tr('Préparation du paiement…', 'Preparing payment…') : tr('Payer en toute sécurité', 'Pay securely')} <span>→</span></button>
          </form>
        </>}
      </section></div>}
    </main>
  )
}

export function StorefrontPage() { return <StorefrontRoute /> }

function LanguageSelector({ language, onChange }: { language: StorefrontLanguage; onChange: (language: StorefrontLanguage) => void }) {
  return <div className="store-language" role="group" aria-label={language === 'fr' ? 'Langue' : 'Language'}>
    <button type="button" aria-pressed={language === 'fr'} className={language === 'fr' ? 'active' : ''} onClick={() => onChange('fr')}>FR</button>
    <button type="button" aria-pressed={language === 'en'} className={language === 'en' ? 'active' : ''} onClick={() => onChange('en')}>EN</button>
  </div>
}

export function StorefrontApp() {
  return <BrowserRouter><Routes><Route path="/:customerSlug/:locationSlug/success" element={<StorefrontRoute />} /><Route path="/:customerSlug/:locationSlug" element={<StorefrontRoute />} /><Route path="*" element={<main className="ayana-store"><section className="store-empty"><h1>Boutique Ayana</h1><p>Le lien de la boutique est incomplet.</p></section></main>} /></Routes></BrowserRouter>
}
