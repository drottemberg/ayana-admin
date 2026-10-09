import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import ayanaLogo from '@/assets/ayana-logo.png'
import './booking-portal.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

type ClassSession = {
  id: string
  name: string
  category?: string | null
  description?: string | null
  conditions?: string | null
  duration: number
  creditCost: number
  startTime: string
  endTime: string
  localDate: string
  localStartTime: string
  localEndTime: string
  timezone: string
  coachName?: string | null
  capacity: number
  bookedCount: number
  availableSpots: number
  isWaitlist: boolean
}

type Schedule = {
  customer: { name: string; slug: string }
  location: { name: string; slug: string; timezone: string; whatsappNumber?: string | null }
  sessions: ClassSession[]
}

type MemberState = {
  token: string
  identity: { firstName?: string | null; lastName?: string | null; email?: string | null; language?: string | null }
  creditBalance: number
  hasUnlimitedContract: boolean
  bookedSessionIds: string[]
  bookings: Array<{ bookingId: string; sessionId: string; status: 'CONFIRMED' | 'WAITLISTED' }>
}

type BookingResult = { bookingId: string; status: 'CONFIRMED' | 'WAITLISTED'; creditBalance: number; shortMessage: string }
type PricingOffer = {
  id: string
  name: string
  description?: string | null
  type: string
  price: number
  currency: string
  creditsTotal?: number | null
  creditsPerPeriod?: number | null
  creditsRefreshInterval?: string | null
  validityDays?: number | null
  billingInterval?: string | null
  perks?: string[] | null
}
type CancellationQuote = {
  bookingStatus: 'CONFIRMED' | 'WAITLISTED'
  isLate: boolean
  lateCancelWindowHours: number
  classCreditCost: number
  penaltyCredits: number
  bookingCreditsRetained: number
  creditsToReturn: number
  extraPenaltyCredits: number
  penaltyAmount: number
  currency: string
  canCancel: boolean
}

function sessionKey(customerSlug: string, locationSlug: string) {
  return `ayana-booking-session:${customerSlug}:${locationSlug}`
}

function browserLanguage(): 'fr' | 'en' {
  const preferred = navigator.languages?.[0] ?? navigator.language ?? 'fr'
  return /^fr(?:-|$)/i.test(preferred) ? 'fr' : 'en'
}

function readBookingLanguage(): 'fr' | 'en' {
  try {
    const saved = localStorage.getItem('ayana-booking-language')
    if (saved === 'fr' || saved === 'en') return saved
  } catch { /* use the browser language when storage is unavailable */ }
  return browserLanguage()
}

function readSession(customerSlug: string, locationSlug: string): MemberState | null {
  try {
    const stored = localStorage.getItem(sessionKey(customerSlug, locationSlug))
    return stored ? JSON.parse(stored) as MemberState : null
  } catch { return null }
}

function responseMessage(payload: { message?: string | string[] }, fallback: string) {
  return Array.isArray(payload.message) ? payload.message.join(' ') : payload.message || fallback
}

function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^00/, '')
  if (digits.length < 8 || digits.length > 15) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

function BookingPortalRoute() {
  const { customerSlug = '', locationSlug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [member, setMember] = useState<MemberState | null>(null)
  const [language, setLanguage] = useState<'fr' | 'en'>(readBookingLanguage)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<ClassSession | null>(null)
  const [selectedAction, setSelectedAction] = useState<'book' | 'cancel'>('book')
  const [bookingError, setBookingError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<'all' | 'booked'>('all')
  const [cancellationQuote, setCancellationQuote] = useState<CancellationQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [offers, setOffers] = useState<PricingOffer[]>([])
  const [offersLoading, setOffersLoading] = useState(false)
  const [offersError, setOffersError] = useState('')
  const [forcedOfferFlow, setForcedOfferFlow] = useState(false)
  const [checkoutUrls, setCheckoutUrls] = useState<Record<string, string>>({})
  const [purchasingOfferId, setPurchasingOfferId] = useState('')
  const handledPaymentReturn = useRef('')
  const isFrench = language === 'fr'

  const changeLanguage = (nextLanguage: 'fr' | 'en') => {
    setLanguage(nextLanguage)
    try { localStorage.setItem('ayana-booking-language', nextLanguage) } catch { /* language still changes for this visit */ }
  }

  const logout = () => {
    try { localStorage.removeItem(sessionKey(customerSlug, locationSlug)) } catch { /* clear in-memory session even if storage is unavailable */ }
    setMember(null)
    setSessionFilter('all')
    setNotice('')
  }

  useEffect(() => {
    let active = true
    const tokenFromUrl = searchParams.get('token')
    if (tokenFromUrl) {
      const url = new URL(window.location.href)
      url.searchParams.delete('token')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const scheduleResponse = await fetch(`${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}`)
        const schedulePayload = await scheduleResponse.json().catch(() => ({})) as Schedule & { message?: string | string[] }
        if (!scheduleResponse.ok) throw new Error(responseMessage(schedulePayload, isFrench ? 'Ce planning est introuvable.' : 'This schedule could not be found.'))
        if (!active) return
        setSchedule(schedulePayload)

        const saved = tokenFromUrl ? null : readSession(customerSlug, locationSlug)
        const handoffToken = tokenFromUrl
        const sessionToken = saved?.token
        if (!handoffToken && !sessionToken) {
          if (active) setMember(null)
          return
        }
        const endpoint = `${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/${handoffToken ? 'session' : 'me'}`
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}) },
          body: JSON.stringify(handoffToken ? { token: handoffToken } : {}),
        })
        const statePayload = await response.json().catch(() => ({})) as Partial<MemberState> & { message?: string | string[] }
        if (!response.ok || !statePayload.identity || typeof statePayload.creditBalance !== 'number') {
          if (sessionToken) localStorage.removeItem(sessionKey(customerSlug, locationSlug))
          if (active) setNotice(responseMessage(statePayload, isFrench ? 'Le lien a expiré. Ouvre le dernier lien reçu dans ta messagerie.' : 'This link has expired. Open the latest link from your messages.'))
          return
        }
        const token = handoffToken ? statePayload.token : sessionToken
        if (!token) return
        const nextMember = {
          ...statePayload,
          token,
          hasUnlimitedContract: statePayload.hasUnlimitedContract === true,
          bookedSessionIds: statePayload.bookedSessionIds ?? [],
          bookings: statePayload.bookings ?? [],
        } as MemberState
        localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(nextMember))
        if (active) {
          setMember(nextMember)
          setNotice('')
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : (isFrench ? 'Impossible de charger le planning.' : 'Could not load the schedule.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [customerSlug, locationSlug, searchParams])

  const booked = useMemo(() => new Set(member?.bookedSessionIds ?? []), [member?.bookedSessionIds])
  const visibleSessions = useMemo(() => {
    const sessions = schedule?.sessions ?? []
    return member && sessionFilter === 'booked' ? sessions.filter((session) => booked.has(session.id)) : sessions
  }, [schedule, member, sessionFilter, booked])
  const sessionsByDate = useMemo(() => {
    const sessions = visibleSessions
    return sessions.reduce<Record<string, ClassSession[]>>((groups, session) => {
      ;(groups[session.localDate] ??= []).push(session)
      return groups
    }, {})
  }, [visibleSessions])
  const needsCredits = Boolean(selected && member && selectedAction === 'book' && !member.hasUnlimitedContract && (forcedOfferFlow || member.creditBalance < selected.creditCost))
  const whatsappMessage = isFrench
    ? `Connecte-moi au planning de ${schedule?.location.name ?? 'ce studio'}`
    : `Connect me to the class schedule for ${schedule?.location.name ?? 'this studio'}`
  const whatsappHref = whatsappLink(schedule?.location.whatsappNumber, whatsappMessage)

  useEffect(() => {
    if (!member || !needsCredits || selectedAction !== 'book') {
      setOffers([])
      setOffersError('')
      return
    }
    let active = true
    setOffersLoading(true)
    const url = `${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/offers`
    void fetch(url, { method: 'POST', headers: { authorization: `Bearer ${member.token}` } })
      .then(async (response) => {
        const payload = await response.json().catch(() => []) as PricingOffer[] & { message?: string | string[] }
        if (!response.ok) throw new Error(responseMessage(payload, isFrench ? 'Impossible de charger les formules.' : 'Could not load available plans.'))
        if (active) setOffers(Array.isArray(payload) ? payload : [])
      })
      .catch((reason) => { if (active) setOffersError(reason instanceof Error ? reason.message : (isFrench ? 'Impossible de charger les formules.' : 'Could not load available plans.')) })
      .finally(() => { if (active) setOffersLoading(false) })
    return () => { active = false }
  }, [customerSlug, locationSlug, member?.token, needsCredits, selectedAction, isFrench])

  useEffect(() => {
    if (!member) return
    const refreshOnReturn = async () => {
      const url = `${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/me`
      try {
        const response = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${member.token}` } })
        const payload = await response.json().catch(() => ({})) as Partial<MemberState>
        if (!response.ok || typeof payload.creditBalance !== 'number') return
        const updated = { ...member, ...payload, token: member.token } as MemberState
        setMember(updated)
        localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(updated))
      } catch { /* keep the current schedule if refresh is temporarily unavailable */ }
    }
    window.addEventListener('focus', refreshOnReturn)
    return () => window.removeEventListener('focus', refreshOnReturn)
  }, [customerSlug, locationSlug, member?.token])

  useEffect(() => {
    const payment = searchParams.get('payment')
    const sessionId = searchParams.get('sessionId')
    if (payment !== 'success' || !sessionId || !schedule || !member) return
    const returnKey = `${payment}:${sessionId}`
    if (handledPaymentReturn.current === returnKey) return
    const session = schedule.sessions.find((item) => item.id === sessionId)
    if (!session) return

    handledPaymentReturn.current = returnKey
    const filter = searchParams.get('filter')
    setSessionFilter(filter === 'booked' ? 'booked' : 'all')
    setSelected(session)
    setSelectedAction('book')
    setForcedOfferFlow(false)
    setBookingError('')
    setOffersError('')
    setNotice(isFrench
      ? 'Paiement effectué. Actualisation de tes crédits pour reprendre cette réservation…'
      : 'Payment complete. Refreshing your credits so you can continue this booking…')

    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('payment')
    cleanUrl.searchParams.delete('sessionId')
    cleanUrl.searchParams.delete('filter')
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`)

    let active = true
    const refreshCredits = async () => {
      const url = `${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/me`
      for (let attempt = 0; attempt < 8 && active; attempt += 1) {
        try {
          const response = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${member.token}` } })
          const payload = await response.json().catch(() => ({})) as Partial<MemberState>
          if (response.ok && typeof payload.creditBalance === 'number') {
            const updated = { ...member, ...payload, token: member.token } as MemberState
            setMember(updated)
            localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(updated))
            if (updated.hasUnlimitedContract || updated.creditBalance >= session.creditCost) {
              setNotice(isFrench
                ? 'Tes crédits sont à jour. Tu peux maintenant confirmer cette réservation.'
                : 'Your credits are up to date. You can now confirm this booking.')
              return
            }
          }
        } catch { /* Stripe webhook or network may still be settling; retry below. */ }
        await new Promise((resolve) => window.setTimeout(resolve, 1200))
      }
      if (active) setNotice(isFrench
        ? 'Paiement effectué. Le solde met un peu plus de temps à se mettre à jour ; cette séance est conservée, réessaie dans un instant.'
        : 'Payment complete. Your balance is taking a little longer to update; this class is still selected, please try again shortly.')
    }
    void refreshCredits()
    return () => { active = false }
  }, [customerSlug, locationSlug, member?.token, schedule, searchParams, isFrench])

  const openBooking = (session: ClassSession) => {
    setBookingError('')
    setForcedOfferFlow(false)
    setSelectedAction('book')
    setCancellationQuote(null)
    setSelected(session)
  }

  const openCancellation = async (session: ClassSession, bookingId: string) => {
    if (!member) return
    setSelected(session)
    setSelectedAction('cancel')
    setBookingError('')
    setCancellationQuote(null)
    setQuoteLoading(true)
    const url = `${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/bookings/${encodeURIComponent(bookingId)}/cancellation-quote`
    try {
      const response = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${member.token}` } })
      const payload = await response.json().catch(() => ({})) as CancellationQuote & { message?: string | string[] }
      if (!response.ok) throw new Error(responseMessage(payload, isFrench ? 'La politique d’annulation est indisponible.' : 'Cancellation policy could not be loaded.'))
      setCancellationQuote(payload)
    } catch (reason) {
      setBookingError(reason instanceof Error ? reason.message : (isFrench ? 'La politique d’annulation est indisponible.' : 'Cancellation policy could not be loaded.'))
    } finally { setQuoteLoading(false) }
  }

  const purchaseOffer = async (pricingOptionId: string) => {
    if (!member) return
    setPurchasingOfferId(pricingOptionId)
    setOffersError('')
    try {
      const url = `${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/offers/checkout`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${member.token}` },
        body: JSON.stringify({ pricingOptionId, sessionId: selected?.id, sessionFilter }),
      })
      const payload = await response.json().catch(() => ({})) as { checkoutUrl?: string; message?: string | string[] }
      if (!response.ok || !payload.checkoutUrl) throw new Error(responseMessage(payload, isFrench ? 'Le paiement n’a pas pu être préparé.' : 'Could not prepare checkout.'))
      setCheckoutUrls((current) => ({ ...current, [pricingOptionId]: payload.checkoutUrl! }))
    } catch (reason) {
      setOffersError(reason instanceof Error ? reason.message : (isFrench ? 'Le paiement n’a pas pu être préparé.' : 'Could not prepare checkout.'))
    } finally { setPurchasingOfferId('') }
  }

  const createBooking = async () => {
    if (!selected || !member) return
    setSubmitting(true)
    setBookingError('')
    try {
      const response = await fetch(`${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/bookings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${member.token}` },
        body: JSON.stringify({ sessionId: selected.id }),
      })
      const payload = await response.json().catch(() => ({})) as BookingResult & { message?: string | string[] }
      if (!response.ok) throw new Error(responseMessage(payload, isFrench ? 'La réservation n’a pas pu être confirmée.' : 'The booking could not be confirmed.'))
      const nextMember = {
        ...member,
        creditBalance: payload.creditBalance,
        bookedSessionIds: [...new Set([...member.bookedSessionIds, selected.id])],
        bookings: [...member.bookings.filter((booking) => booking.sessionId !== selected.id), { bookingId: payload.bookingId, sessionId: selected.id, status: payload.status }],
      }
      localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(nextMember))
      setMember(nextMember)
      setSchedule((current) => current ? {
        ...current,
        sessions: current.sessions.map((session) => session.id === selected.id ? {
          ...session,
          bookedCount: Math.min(session.capacity, session.bookedCount + 1),
          availableSpots: Math.max(0, session.availableSpots - 1),
          isWaitlist: session.bookedCount + 1 >= session.capacity,
        } : session),
      } : current)
      setNotice(payload.status === 'WAITLISTED'
        ? (isFrench ? 'Tu es sur la liste d’attente. La confirmation a été envoyée sur tes canaux liés.' : 'You are on the waitlist. A confirmation was sent to your linked channels.')
        : (isFrench ? 'Réservation confirmée. La confirmation a été envoyée sur tes canaux liés.' : 'Booking confirmed. A confirmation was sent to your linked channels.'))
      setSelected(null)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : (isFrench ? 'La réservation a échoué. Réessaie.' : 'Booking failed. Please try again.')
      setBookingError(message)
      if (/credit|crédit|balance/i.test(message)) setForcedOfferFlow(true)
    } finally { setSubmitting(false) }
  }

  const cancelBooking = async () => {
    if (!selected || !member || !cancellationQuote?.canCancel) return
    const booking = member.bookings.find((item) => item.sessionId === selected.id)
    if (!booking) return
    setSubmitting(true)
    setBookingError('')
    try {
      const url = `${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/bookings/${encodeURIComponent(booking.bookingId)}/cancel`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${member.token}` },
        body: JSON.stringify({ confirmCancellation: true, confirmLateCancellation: true }),
      })
      const payload = await response.json().catch(() => ({})) as { status?: string; creditBalance?: number; message?: string | string[] }
      if (!response.ok) throw new Error(responseMessage(payload, isFrench ? 'L’annulation a échoué.' : 'Cancellation failed.'))
      const nextMember = {
        ...member,
        creditBalance: payload.creditBalance ?? member.creditBalance,
        bookedSessionIds: member.bookedSessionIds.filter((sessionId) => sessionId !== selected.id),
        bookings: member.bookings.filter((item) => item.sessionId !== selected.id),
      }
      setMember(nextMember)
      localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(nextMember))
      if (cancellationQuote.bookingStatus === 'CONFIRMED') {
        setSchedule((current) => current ? {
          ...current,
          sessions: current.sessions.map((session) => session.id === selected.id ? {
            ...session,
            bookedCount: Math.max(0, session.bookedCount - 1),
            availableSpots: Math.min(session.capacity, session.availableSpots + 1),
            isWaitlist: false,
          } : session),
        } : current)
      }
      setNotice(isFrench ? 'Réservation annulée. La politique de crédits a été appliquée.' : 'Booking cancelled. The credit policy has been applied.')
      setSelected(null)
      setCancellationQuote(null)
    } catch (reason) {
      setBookingError(reason instanceof Error ? reason.message : (isFrench ? 'L’annulation a échoué.' : 'Cancellation failed.'))
    } finally { setSubmitting(false) }
  }

  const formatDate = (date: string) => {
    const [year, month, day] = date.split('-').map(Number)
    return new Intl.DateTimeFormat(isFrench ? 'fr-FR' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: schedule?.location.timezone ?? 'Europe/Paris',
    }).format(new Date(Date.UTC(year, month - 1, day, 12)))
  }

  return <main className="ayana-booking">
    <header className="booking-topbar"><img src={ayanaLogo} alt="Ayana Feelness Club" /><span>{isFrench ? 'PLANNING & RÉSERVATION' : 'SCHEDULE & BOOKING'}</span><div className="booking-language" role="group" aria-label={isFrench ? 'Langue' : 'Language'}><button type="button" aria-pressed={isFrench} className={isFrench ? 'active' : ''} onClick={() => changeLanguage('fr')}>FR</button><button type="button" aria-pressed={!isFrench} className={!isFrench ? 'active' : ''} onClick={() => changeLanguage('en')}>EN</button></div></header>
    {loading ? <div className="booking-loading"><span className="booking-spinner" />{isFrench ? 'Chargement du planning…' : 'Loading schedule…'}</div> : error ? <section className="booking-empty"><p className="booking-eyebrow">AYANA FEELNESS CLUB</p><h1>{isFrench ? 'Planning indisponible' : 'Schedule unavailable'}</h1><p>{error}</p></section> : <>
      <section className="booking-hero">
        <p className="booking-eyebrow">{schedule?.customer.name}</p>
        <h1>{isFrench ? 'Le planning' : 'Class schedule'}<br /><em>{schedule?.location.name}</em></h1>
        <p>{isFrench ? 'Choisis ton cours et réserve en quelques instants.' : 'Choose your class and book in just a few taps.'}</p>
      </section>

      {member
        ? <section className="booking-member"><div><span>{isFrench ? 'Connecté·e' : 'Signed in'}</span><strong>{[member.identity.firstName, member.identity.lastName].filter(Boolean).join(' ')}</strong></div><div className="booking-member-actions"><div className="booking-balance"><b>{member.hasUnlimitedContract ? '∞' : new Intl.NumberFormat(isFrench ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 2 }).format(member.creditBalance)}</b><span>{member.hasUnlimitedContract ? (isFrench ? 'accès illimité' : 'unlimited') : (isFrench ? 'crédits' : 'credits')}</span></div><button type="button" className="booking-logout" onClick={logout} aria-label={isFrench ? 'Se déconnecter' : 'Log out'} title={isFrench ? 'Se déconnecter' : 'Log out'}>↪</button></div></section>
        : <section className="booking-login-card"><div><strong>{isFrench ? 'Réserve avec ton compte Ayana' : 'Book with your Ayana account'}</strong><span>{isFrench ? 'Connecte-toi pour voir tes crédits et gérer tes réservations.' : 'Connect to see your credits and manage your bookings.'}</span></div>{whatsappHref ? <a className="booking-whatsapp-cta" href={whatsappHref} target="_blank" rel="noreferrer">{isFrench ? 'Se connecter avec WhatsApp' : 'Connect with WhatsApp'}<span>↗</span></a> : <small>{isFrench ? 'WhatsApp n’est pas configuré pour ce studio.' : 'WhatsApp is not configured for this studio.'}</small>}</section>}
      {notice && <div className="booking-notice" role="status">{notice}</div>}

      {member && <div className="booking-session-filters" role="group" aria-label={isFrench ? 'Filtrer les cours' : 'Filter classes'}>
        <button type="button" className={sessionFilter === 'all' ? 'active' : ''} aria-pressed={sessionFilter === 'all'} onClick={() => setSessionFilter('all')}>{isFrench ? 'Tous les cours' : 'All classes'}</button>
        <button type="button" className={sessionFilter === 'booked' ? 'active' : ''} aria-pressed={sessionFilter === 'booked'} onClick={() => setSessionFilter('booked')}>{isFrench ? 'Mes réservations' : 'My bookings'}</button>
      </div>}

      {Object.keys(sessionsByDate).length === 0 ? <section className="booking-empty"><h2>{member && sessionFilter === 'booked' ? (isFrench ? 'Aucune réservation à venir' : 'No upcoming bookings') : (isFrench ? 'Aucun cours prévu pour le moment' : 'No upcoming classes yet')}</h2><p>{member && sessionFilter === 'booked' ? (isFrench ? 'Tes prochaines réservations apparaîtront ici.' : 'Your upcoming bookings will appear here.') : (isFrench ? 'Reviens bientôt pour découvrir les prochains créneaux.' : 'Check back soon for upcoming sessions.')}</p>{member && sessionFilter === 'booked' && <button type="button" className="booking-empty-action" onClick={() => setSessionFilter('all')}>{isFrench ? 'Voir tous les cours' : 'View all classes'}</button>}</section> : <div className="booking-days">
        {Object.entries(sessionsByDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, sessions]) => <section className="booking-day" key={date}>
          <h2>{formatDate(date)}</h2>
          <div className="booking-session-list">{sessions.map((session) => {
            const alreadyBooked = booked.has(session.id)
            const booking = member?.bookings.find((item) => item.sessionId === session.id)
            return <article className="booking-session" key={session.id}>
              <div className="booking-session-time"><strong>{session.localStartTime}</strong><span>{session.localEndTime}</span></div>
              <div className="booking-session-copy">
                <div className="booking-session-title"><h3>{session.name}</h3>{session.category && <span>{session.category}</span>}</div>
                <p className="booking-session-meta">{session.duration} min{session.coachName ? ` · ${session.coachName}` : ''}</p>
                {session.description && <p className="booking-session-description">{session.description}</p>}
                {session.conditions && <p className="booking-conditions">{session.conditions}</p>}
                <div className="booking-session-bottom"><span>{session.creditCost} {isFrench ? 'crédit' : 'credit'}{session.creditCost === 1 ? '' : 's'}</span><span>{alreadyBooked ? (isFrench ? 'Déjà réservé' : 'Already booked') : session.isWaitlist ? (isFrench ? 'Liste d’attente' : 'Waitlist') : `${session.availableSpots} ${isFrench ? 'places' : 'spots'}`}</span></div>
                <button type="button" className={`booking-session-action${alreadyBooked ? ' booking-manage-action' : ''}`} onClick={() => alreadyBooked && booking ? void openCancellation(session, booking.bookingId) : openBooking(session)}>{alreadyBooked ? (isFrench ? 'Gérer / annuler' : 'Manage / cancel') : session.isWaitlist ? (isFrench ? 'Rejoindre la liste' : 'Join waitlist') : (isFrench ? 'Choisir ce cours' : 'Choose this class')}<span>→</span></button>
              </div>
            </article>
          })}</div>
        </section>)}
      </div>}
      <footer className="booking-footer">{isFrench ? 'AYANA FEELNESS CLUB · RÉSERVATION EN LIGNE' : 'AYANA FEELNESS CLUB · ONLINE BOOKING'}</footer>
    </>}

    {selected && <div className="booking-overlay" role="presentation" onClick={() => !submitting && setSelected(null)}><section className="booking-sheet" role="dialog" aria-modal="true" aria-labelledby="booking-confirm-title" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="booking-close" aria-label={isFrench ? 'Fermer' : 'Close'} disabled={submitting} onClick={() => setSelected(null)}>×</button>
      <p className="booking-eyebrow">{selectedAction === 'cancel' ? (isFrench ? 'POLITIQUE D’ANNULATION' : 'CANCELLATION POLICY') : (isFrench ? 'RÉCAPITULATIF' : 'BOOKING SUMMARY')}</p>
      <h2 id="booking-confirm-title">{selectedAction === 'cancel' ? (isFrench ? 'Annuler cette réservation ?' : 'Cancel this booking?') : (isFrench ? 'Confirmer ce cours ?' : 'Confirm this class?')}</h2>
      <div className="booking-recap"><strong>{selected.name}</strong><span>{formatDate(selected.localDate)} · {selected.localStartTime}–{selected.localEndTime}</span><span>{schedule?.location.name}</span>{selectedAction === 'book' && <span>{selected.creditCost} {isFrench ? 'crédit(s)' : 'credit(s)'}</span>}{selected.description && <p className="booking-recap-description">{selected.description}</p>}{selected.conditions && <p>{selected.conditions}</p>}</div>
      {!member ? <div className="booking-auth-hint"><p>{isFrench ? 'Connecte-toi avec ton compte Ayana pour réserver ce cours.' : 'Sign in with your Ayana account to book this class.'}</p>{whatsappHref ? <a className="booking-whatsapp-cta" href={whatsappHref} target="_blank" rel="noreferrer">{isFrench ? 'Se connecter avec WhatsApp' : 'Connect with WhatsApp'}<span>↗</span></a> : <small>{isFrench ? 'WhatsApp n’est pas configuré pour ce studio.' : 'WhatsApp is not configured for this studio.'}</small>}</div>
        : selectedAction === 'cancel' ? <div className="booking-cancellation-policy">
          {quoteLoading ? <p>{isFrench ? 'Vérification de la politique…' : 'Checking cancellation policy…'}</p> : cancellationQuote ? <>
            {cancellationQuote.isLate
              ? <p className="booking-policy-warning">{isFrench ? `Cette annulation est dans la fenêtre de ${cancellationQuote.lateCancelWindowHours} h avant le cours.` : `This cancellation is within the ${cancellationQuote.lateCancelWindowHours}-hour late cancellation window.`}</p>
              : <p>{isFrench ? 'L’annulation est hors de la fenêtre de pénalité.' : 'This cancellation is outside the penalty window.'}</p>}
            {cancellationQuote.creditsToReturn > 0 && <p>{isFrench ? `${cancellationQuote.creditsToReturn} crédit(s) seront recrédités.` : `${cancellationQuote.creditsToReturn} credit(s) will be returned.`}</p>}
            {cancellationQuote.bookingCreditsRetained > 0 && <p>{isFrench ? `${cancellationQuote.bookingCreditsRetained} crédit(s) utilisés pour cette réservation seront conservés comme pénalité.` : `${cancellationQuote.bookingCreditsRetained} booking credit(s) will be retained as a penalty.`}</p>}
            {cancellationQuote.extraPenaltyCredits > 0 && <p>{isFrench ? `${cancellationQuote.extraPenaltyCredits} crédit(s) supplémentaires seront débités.` : `${cancellationQuote.extraPenaltyCredits} additional credit(s) will be deducted.`}</p>}
            {cancellationQuote.penaltyAmount > 0 && <p>{isFrench ? `Une pénalité de ${cancellationQuote.penaltyAmount.toFixed(2)} ${cancellationQuote.currency} est prévue. Contacte le studio pour annuler.` : `A ${cancellationQuote.penaltyAmount.toFixed(2)} ${cancellationQuote.currency} fee applies. Contact the studio to cancel.`}</p>}
            {cancellationQuote.canCancel && <p className="booking-confirm-hint">{isFrench ? 'Confirme uniquement si tu veux vraiment annuler ce cours.' : 'Confirm only if you really want to cancel this class.'}</p>}
          </> : null}
        </div>
        : needsCredits ? <div className="booking-offers">
          <div className="booking-no-credit"><strong>{isFrench ? 'Solde insuffisant' : 'Not enough credits'}</strong><span>{isFrench ? `Ce cours demande ${selected.creditCost} crédit(s). Ton solde est de ${member.creditBalance}. Voici les formules disponibles à l’achat.` : `This class requires ${selected.creditCost} credit(s). Your balance is ${member.creditBalance}. Here are the plans available to buy.`}</span></div>
          {offersLoading && <p className="booking-confirm-hint">{isFrench ? 'Chargement des formules…' : 'Loading plans…'}</p>}
          {!offersLoading && offers.length === 0 && !offersError && <p className="booking-confirm-hint">{isFrench ? 'Aucune formule disponible à l’achat pour ce studio.' : 'No plans are currently available to buy for this studio.'}</p>}
          {offers.map((offer) => <article className="booking-offer" key={offer.id}>
            <div><strong>{offer.name}</strong><b>{new Intl.NumberFormat(isFrench ? 'fr-FR' : 'en-GB', { style: 'currency', currency: offer.currency || 'EUR' }).format(offer.price)}</b></div>
            {offer.description && <p>{offer.description}</p>}
            <small>{offer.creditsTotal != null ? `${offer.creditsTotal} ${isFrench ? 'crédits' : 'credits'}` : offer.creditsPerPeriod != null ? `${offer.creditsPerPeriod} ${isFrench ? 'crédits' : 'credits'} / ${offer.creditsRefreshInterval?.toLowerCase() ?? 'period'}` : (isFrench ? 'Accès illimité' : 'Unlimited access')}{offer.validityDays ? ` · ${offer.validityDays} ${isFrench ? 'jours de validité' : 'days validity'}` : ''}{offer.billingInterval && offer.billingInterval !== 'ONCE' ? ` · ${isFrench ? 'facturation' : 'billed'} ${offer.billingInterval.toLowerCase()}` : ''}</small>
            {!!offer.perks?.length && <small>{offer.perks.join(' · ')}</small>}
            {checkoutUrls[offer.id]
              ? <a className="booking-offer-buy" href={checkoutUrls[offer.id]}>{isFrench ? 'Continuer vers le paiement' : 'Continue to payment'}<span>↗</span></a>
              : <button type="button" className="booking-offer-buy" disabled={purchasingOfferId === offer.id} onClick={() => void purchaseOffer(offer.id)}>{purchasingOfferId === offer.id ? (isFrench ? 'Préparation…' : 'Preparing…') : (isFrench ? 'Acheter cette formule' : 'Buy this plan')}<span>→</span></button>}
          </article>)}
          {offersError && <div className="booking-error" role="alert">{offersError}</div>}
        </div>
        : <p className="booking-confirm-hint">{isFrench ? 'Ta réservation sera confirmée après validation.' : 'Your booking will be confirmed after you submit.'}</p>}
      {bookingError && <div className="booking-error" role="alert">{bookingError}</div>}
      <div className="booking-sheet-actions"><button type="button" className="booking-cancel" disabled={submitting} onClick={() => setSelected(null)}>{selectedAction === 'cancel' ? (isFrench ? 'Garder le cours' : 'Keep booking') : (isFrench ? 'Fermer' : 'Close')}</button>{member && selectedAction === 'cancel' && cancellationQuote?.canCancel && <button type="button" className="booking-confirm booking-danger" disabled={submitting || quoteLoading} onClick={() => void cancelBooking()}>{submitting ? (isFrench ? 'Annulation…' : 'Cancelling…') : (isFrench ? 'Confirmer l’annulation' : 'Confirm cancellation')}</button>}{member && selectedAction === 'book' && <button type="button" className="booking-confirm" disabled={submitting || needsCredits} onClick={() => void createBooking()}>{submitting ? (isFrench ? 'Réservation…' : 'Booking…') : (isFrench ? 'Confirmer la réservation' : 'Confirm booking')}</button>}</div>
    </section></div>}
  </main>
}

export function BookingPortalPage() { return <BookingPortalRoute /> }

export function BookingPortalApp() {
  const isFrench = browserLanguage() === 'fr'
  return <BrowserRouter><Routes><Route path="/:customerSlug/:locationSlug" element={<BookingPortalRoute />} /><Route path="*" element={<main className="ayana-booking"><section className="booking-empty"><h1>Ayana</h1><p>{isFrench ? 'Le lien du planning est incomplet.' : 'The schedule link is incomplete.'}</p></section></main>} /></Routes></BrowserRouter>
}
