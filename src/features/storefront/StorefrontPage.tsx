import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import ayanaLogo from '@/assets/ayana-logo.png'
import './storefront.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'
const SESSION_KEY = 'ayana-storefront-session'
const CART_KEY = 'ayana-storefront-cart'

type ProductOption = { id: string; name: string; price: number }
type ModifierGroup = { id: string; name: string; required: boolean; minSelect: number; maxSelect: number; options: ProductOption[] }
type Variant = { id: string; label: string; price: number; stock: number; available: boolean }
type Product = { id: string; name: string; description?: string | null; category: string; imageUrl?: string | null; variants: Variant[]; modifierGroups: ModifierGroup[] }
type Catalog = { customer: { name: string; slug: string }; location: { name: string; slug: string }; currency: string; products: Product[] }
type CartLine = { key: string; productId: string; name: string; variantId: string; variantLabel: string; unitPrice: number; quantity: number; modifierIds: string[]; modifierNames: string[]; modifierTotal: number }
type Identity = { token?: string; firstName?: string; lastName?: string; email?: string; phone?: string }

function readIdentity(): Identity {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') as Identity } catch { return {} }
}

function readCart(): CartLine[] {
  try { return JSON.parse(localStorage.getItem(CART_KEY) ?? '[]') as CartLine[] } catch { return [] }
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat(navigator.language || 'fr-FR', { style: 'currency', currency }).format(value)
}

function StorefrontRoute() {
  const { customerSlug = '', locationSlug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
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
  const [identity, setIdentity] = useState<Identity>(readIdentity)
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [firstName, setFirstName] = useState(identity.firstName ?? '')
  const [lastName, setLastName] = useState(identity.lastName ?? '')
  const [email, setEmail] = useState(identity.email ?? '')
  const [phone, setPhone] = useState('')
  const [verificationId, setVerificationId] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [country, setCountry] = useState<CountryCode>(() => {
    const region = navigator.language?.split('-')[1]?.toUpperCase()
    return region && getCountries().includes(region as CountryCode) ? region as CountryCode : 'FR'
  })
  const storeBasePath = location.pathname.startsWith('/store/') ? `/store/${customerSlug}/${locationSlug}` : `/${customerSlug}/${locationSlug}`

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
        if (!response.ok) throw new Error(response.status === 404 ? 'Cette boutique est introuvable.' : 'Impossible de charger la boutique.')
        return await response.json() as Catalog
      })
      .then((result) => { if (active) { setCatalog(result); setError('') } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Une erreur est survenue.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [customerSlug, locationSlug])

  useEffect(() => {
    const url = new URL(window.location.href)
    const token = url.searchParams.get('token') ?? new URLSearchParams(url.hash.replace(/^#/, '')).get('token')
    if (!token) return
    localStorage.removeItem(SESSION_KEY)
    setIdentity({})
    url.searchParams.delete('token')
    url.hash = ''
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    fetch(`${API_URL}/storefront/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/session`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }),
    }).then(async (response) => {
      if (!response.ok) throw new Error('Le lien personnalisé a expiré. Tu peux poursuivre avec tes coordonnées.')
      return await response.json() as { storeToken: string; identity: Omit<Identity, 'token'> }
    }).then((session) => {
      const next = { ...session.identity, token: session.storeToken }
      localStorage.setItem(SESSION_KEY, JSON.stringify(next))
      setIdentity(next)
      setFirstName(next.firstName ?? '')
      setLastName(next.lastName ?? '')
      setEmail(next.email ?? '')
    }).catch((reason: unknown) => {
      setCheckoutError(reason instanceof Error ? reason.message : 'Le lien personnalisé a expiré.')
    })
  }, [customerSlug, locationSlug])

  useEffect(() => {
    if (searchParams.get('payment') === 'cancelled') {
      setCheckoutError('Le paiement n’a pas été terminé. Votre panier est toujours là.')
      setCheckoutOpen(true)
    }
  }, [searchParams])

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
    setIdentity(readIdentity())
    setCheckoutOpen(true)
    setCartOpen(false)
  }

  const submitCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCheckoutError('')
    let e164 = identity.token ? identity.phone : ''
    let checkoutIdentity = identity
    if (!identity.token) {
      const parsed = parsePhoneNumberFromString(phone, country)
      if (!parsed?.isValid()) { setCheckoutError('Vérifie le numéro de téléphone et son indicatif.'); return }
      e164 = parsed.number
      if (!firstName.trim() || !email.trim()) { setCheckoutError('Renseigne ton prénom et ton adresse e-mail.'); return }
    }
    setSubmitting(true)
    try {
      if (!checkoutIdentity.token) {
        const identityUrl = `${API_URL}/storefront/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}`
        const identityResponse = verificationId
          ? await fetch(`${identityUrl}/verify-identity`, {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ verificationId, code: verificationCode, phone: e164 }),
            })
          : await fetch(`${identityUrl}/identity`, {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: e164, language: navigator.language?.slice(0, 2) || 'fr' }),
            })
        const identityPayload = await identityResponse.json().catch(() => ({})) as {
          requiresVerification?: boolean; verificationId?: string; maskedEmail?: string; storeToken?: string;
          identity?: Omit<Identity, 'token'>; message?: string | string[]
        }
        if (!identityResponse.ok) {
          const message = Array.isArray(identityPayload.message) ? identityPayload.message.join(' ') : identityPayload.message
          throw new Error(message || 'Impossible de vérifier tes coordonnées.')
        }
        if (identityPayload.requiresVerification) {
          setVerificationId(identityPayload.verificationId ?? '')
          setVerificationEmail(identityPayload.maskedEmail ?? email)
          setCheckoutError(`Un code de vérification vient d’être envoyé à ${identityPayload.maskedEmail ?? email}.`)
          setSubmitting(false)
          return
        }
        if (!identityPayload.storeToken) throw new Error('La vérification de ton identité n’a pas abouti. Réessaie.')
        checkoutIdentity = { ...identityPayload.identity, token: identityPayload.storeToken }
        localStorage.setItem(SESSION_KEY, JSON.stringify(checkoutIdentity))
        setIdentity(checkoutIdentity)
      }
      const response = await fetch(`${API_URL}/storefront/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/checkout`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: checkoutIdentity.token,
          firstName: checkoutIdentity.firstName ?? firstName.trim(),
          lastName: checkoutIdentity.lastName ?? lastName.trim(),
          email: checkoutIdentity.email ?? email.trim(),
          phone: e164,
          language: navigator.language?.slice(0, 2) || 'fr',
          items: cart.map((line) => ({ variantId: line.variantId, quantity: line.quantity, modifierIds: line.modifierIds })),
        }),
      })
      const payload = await response.json().catch(() => ({})) as { checkoutUrl?: string; storeToken?: string; orderId?: string; message?: string | string[] }
      if (!response.ok || !payload.checkoutUrl) {
        const message = Array.isArray(payload.message) ? payload.message.join(' ') : payload.message
        throw new Error(message || 'Impossible de préparer le paiement. Vérifie le panier et réessaie.')
      }
      const nextIdentity = {
        token: payload.storeToken ?? checkoutIdentity.token,
        firstName: checkoutIdentity.firstName || firstName.trim(),
        lastName: checkoutIdentity.lastName || lastName.trim(),
        email: checkoutIdentity.email || email.trim(),
        phone: checkoutIdentity.phone || e164,
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextIdentity))
      window.location.assign(payload.checkoutUrl)
    } catch (reason) {
      setCheckoutError(reason instanceof Error ? reason.message : 'Une erreur est survenue. Réessaie.')
      setSubmitting(false)
    }
  }

  if (location.pathname.endsWith('/success')) {
    return <main className="ayana-store"><header className="store-topbar"><img className="ayana-logo" src={ayanaLogo} alt="Ayana Feelness Club" /></header><section className="store-success"><div className="success-mark">✓</div><p className="store-eyebrow">Commande Ayana</p><h1>Merci pour ta commande&nbsp;!</h1><p>Ton paiement est en cours de confirmation. Tu recevras le récapitulatif et le code de commande par e-mail.</p>{searchParams.get('code') && <strong className="success-code">{searchParams.get('code')}</strong>}<a className="store-primary" href={storeBasePath}>Retour à la boutique</a></section></main>
  }

  if (loading) return <main className="ayana-store"><div className="store-loading"><span className="store-spinner" />Ouverture de la boutique…</div></main>
  if (error || !catalog) return <main className="ayana-store"><header className="store-topbar"><img className="ayana-logo" src={ayanaLogo} alt="Ayana Feelness Club" /></header><section className="store-empty"><h1>Boutique indisponible</h1><p>{error || 'Cette boutique ne peut pas être affichée pour le moment.'}</p></section></main>

  return (
    <main className="ayana-store">
      <header className="store-topbar"><a className="ayana-logo-link" href={storeBasePath}><img className="ayana-logo" src={ayanaLogo} alt="Ayana Feelness Club" /></a><button className="store-cart-top" onClick={() => setCartOpen(true)} aria-label="Ouvrir le panier">Panier <b>{totalCount}</b></button></header>
      <section className="store-hero">
        <p className="store-eyebrow">{catalog.location.name}</p>
        <h1>Un peu de douceur,<br /><em>à emporter.</em></h1>
        <p>Café, matcha et essentiels Ayana. Choisis, personnalise, puis règle ta commande en toute simplicité.</p>
        <span className="hero-sun" aria-hidden="true">✳</span>
      </section>
      {checkoutError && !checkoutOpen && <div className="store-notice">{checkoutError}</div>}
      <nav className="store-categories" aria-label="Catégories">
        {categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </nav>
      <section className="store-products">
        {visibleProducts.map((product, index) => {
          const startPrice = Math.min(...product.variants.filter((variant) => variant.available).map((variant) => variant.price))
          return <button className="store-product" key={product.id} onClick={() => openProduct(product)}>
            <span className={`product-art art-${index % 4}`}>{product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" /> : <span>{product.category.toLowerCase().includes('good') ? '✳' : '◌'}</span>}</span>
            <span className="product-copy"><span className="product-category">{product.category}</span><strong>{product.name}</strong>{product.description && <span className="product-description">{product.description}</span>}<span className="product-buy">{Number.isFinite(startPrice) ? `À partir de ${money(startPrice, currency)}` : 'Indisponible'} <b aria-hidden="true">＋</b></span></span>
          </button>
        })}
        {!visibleProducts.length && <div className="store-empty"><h2>Aucun article disponible</h2><p>La sélection de cette catégorie arrive bientôt.</p></div>}
      </section>
      <footer className="store-footer"><span>AYANA FEELNESS CLUB</span><span>{catalog.location.name}</span></footer>

      {totalCount > 0 && <button className="store-sticky-cart" onClick={() => setCartOpen(true)}><span>Voir mon panier <small>{totalCount} article{totalCount > 1 ? 's' : ''}</small></span><b>{money(total, currency)}　→</b></button>}

      {selectedProduct && <div className="store-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProduct(null) }}><section className="store-sheet" role="dialog" aria-modal="true" aria-label={selectedProduct.name}>
        <button className="sheet-close" onClick={() => setSelectedProduct(null)} aria-label="Fermer">×</button><p className="store-eyebrow">{selectedProduct.category}</p><h2>{selectedProduct.name}</h2>{selectedProduct.description && <p className="sheet-description">{selectedProduct.description}</p>}
        {selectedProduct.variants.length > 1 && <fieldset className="option-section"><legend>Choisis ton format</legend>{selectedProduct.variants.map((variant) => <button type="button" key={variant.id} disabled={!variant.available} onClick={() => setVariantId(variant.id)} className={`option-choice ${variantId === variant.id ? 'chosen' : ''}`}><span>{variant.label}</span><b>{variant.available ? money(variant.price, currency) : 'Épuisé'}</b></button>)}</fieldset>}
        {selectedProduct.modifierGroups.map((group) => <fieldset className="option-section" key={group.id}><legend>{group.name}{group.required || group.minSelect > 0 ? <small> · obligatoire</small> : <small> · au choix</small>}</legend>{group.options.map((option) => <button type="button" key={option.id} className={`option-choice ${(selectedOptions[group.id] ?? []).includes(option.id) ? 'chosen' : ''}`} onClick={() => toggleOption(group, option)}><span>{option.name}</span><b>{option.price ? `+ ${money(option.price, currency)}` : 'Inclus'}</b></button>)}</fieldset>)}
        {optionError && <p className="store-form-error">{optionError}</p>}<button className="store-primary" disabled={!selectedVariant?.available} onClick={addSelectedProduct}><span>Ajouter au panier</span><b>{money(selectedUnitPrice, currency)}</b></button>
      </section></div>}

      {cartOpen && <div className="store-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false) }}><section className="store-sheet" role="dialog" aria-modal="true" aria-label="Ton panier">
        <button className="sheet-close" onClick={() => setCartOpen(false)} aria-label="Fermer">×</button><p className="store-eyebrow">Ta sélection</p><h2>Ton panier</h2>
        {!cart.length ? <div className="store-empty"><p>Ton panier est vide.</p><button className="store-text-button" onClick={() => setCartOpen(false)}>Continuer mes achats</button></div> : <>
          <div className="cart-lines">{cart.map((line) => <article className="cart-line" key={line.key}><div><strong>{line.name}</strong><small>{line.variantLabel}{line.modifierNames.length ? ` · ${line.modifierNames.join(', ')}` : ''}</small><b>{money(line.unitPrice * line.quantity, currency)}</b></div><div className="quantity-picker"><button onClick={() => updateQuantity(line.key, -1)} aria-label="Retirer un article">−</button><span>{line.quantity}</span><button onClick={() => updateQuantity(line.key, 1)} aria-label="Ajouter un article">＋</button></div></article>)}</div>
          <div className="cart-total"><span>Total</span><b>{money(total, currency)}</b></div><p className="cart-note">Le retrait se fait au Feelness Bar de {catalog.location.name}.</p><button className="store-primary" onClick={startCheckout}>Continuer <span>→</span></button>
        </>}
      </section></div>}

      {checkoutOpen && <div className="store-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setCheckoutOpen(false) }}><section className="store-sheet checkout-sheet" role="dialog" aria-modal="true" aria-label="Coordonnées et paiement">
        <button className="sheet-close" onClick={() => setCheckoutOpen(false)} aria-label="Fermer" disabled={submitting}>×</button><p className="store-eyebrow">Dernière étape</p><h2>Où te retrouver&nbsp;?</h2><p className="sheet-description">Nous utilisons ces coordonnées pour le reçu et pour te prévenir quand ta commande est prête.</p>
        {checkoutError && <p className="store-form-error">{checkoutError}</p>}
        <form className="store-checkout-form" onSubmit={submitCheckout}>
          {!identity.token && !verificationId && <>
            <label>Prénom<input required autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
            <label>Nom <span>(facultatif)</span><input autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
            <label>E-mail<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Téléphone
              <span className="phone-field"><select aria-label="Indicatif pays" value={country} onChange={(event) => setCountry(event.target.value as CountryCode)}>{getCountries().map((code) => <option key={code} value={code}>+{getCountryCallingCode(code)} · {code}</option>)}</select><input required type="tel" autoComplete="tel-national" placeholder="6 12 34 56 78" value={phone} onChange={(event) => setPhone(event.target.value)} /></span>
            </label>
          </>}
          {!identity.token && verificationId && <>
            <div className="saved-identity"><span>Vérification de ton compte Ayana</span><strong>Code envoyé à {verificationEmail}</strong><small>Le code est valable 10 minutes. Il permet de rattacher cette commande à ton compte.</small></div>
            <label>Code reçu par e-mail<input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
            <button type="button" className="store-text-button" onClick={() => { setVerificationId(''); setVerificationCode(''); setCheckoutError('') }}>Modifier mes coordonnées</button>
          </>}
          {identity.token && <div className="saved-identity"><span>Commande pour</span><strong>{identity.firstName} {identity.lastName}</strong><small>{identity.email} · {identity.phone}</small></div>}
          <div className="checkout-total"><span>À payer</span><b>{money(total, currency)}</b></div>
          <button className="store-primary" disabled={submitting}>{submitting ? 'Préparation du paiement…' : verificationId && !identity.token ? 'Vérifier et continuer' : 'Payer en toute sécurité'} <span>→</span></button>
          <p className="secure-note">Paiement sécurisé par Stripe. La commande est confirmée après validation du paiement.</p>
        </form>
      </section></div>}
    </main>
  )
}

export function StorefrontPage() { return <StorefrontRoute /> }

export function StorefrontApp() {
  return <BrowserRouter><Routes><Route path="/:customerSlug/:locationSlug/success" element={<StorefrontRoute />} /><Route path="/:customerSlug/:locationSlug" element={<StorefrontRoute />} /><Route path="*" element={<main className="ayana-store"><section className="store-empty"><h1>Boutique Ayana</h1><p>Le lien de la boutique est incomplet.</p></section></main>} /></Routes></BrowserRouter>
}
