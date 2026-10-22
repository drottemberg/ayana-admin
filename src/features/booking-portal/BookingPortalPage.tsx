import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BrowserRouter, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import ayanaLogo from '@/assets/ayana-logo.png'
import { PhoneInput } from '@/components/ui/phone-input'
import { validatePhone } from '@/lib/phone'
import { createPublicAccessLink, type PublicAccessChannel } from '@/lib/public-access'
import './booking-portal.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

type ClassSession = {
  id: string
  name: string
  category?: string | null
  description?: string | null
  conditions?: string | null
  minimumParticipants?: number | null
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

type ClassProductOffer = {
  id: string
  name: string
  description?: string | null
  kind: 'REQUIRED' | 'RECOMMENDED'
  category?: string | null
  currency: string
  variants: Array<{ id: string; label: string; price: number }>
  orderUrl: string
}

type Schedule = {
  customer: { name: string; slug: string }
  location: {
    name: string
    slug: string
    timezone: string
    whatsappNumber?: string | null
    telegramBotUsername?: string | null
    paymentMethods?: { online: boolean; terminal: boolean }
    cancellationPolicy: {
      lateCancelWindowHours: number
      lateCancelPenaltyCredits: number
      lateCancelPenaltyAmount: number | null
      noShowPenaltyCredits: number
      noShowPenaltyAmount: number | null
    }
  }
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

type BookingResult = { bookingId: string; status: 'CONFIRMED' | 'WAITLISTED'; creditBalance: number; shortMessage: string; relatedProducts?: ClassProductOffer[] }
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
  minimumCommitmentMonths?: number | null
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

type BookingGuestDraft = { firstName: string; phone: string; email: string }
type AccessModalState = {
  view: 'choose' | 'email' | 'code'
  state: Record<string, unknown>
  email: string
  verificationId?: string
}

function guestDraftKey(customerSlug: string, locationSlug: string) {
  return `ayana-booking-guest:${customerSlug}:${locationSlug}`
}

function readGuestDraft(customerSlug: string, locationSlug: string): BookingGuestDraft {
  try {
    const saved = localStorage.getItem(guestDraftKey(customerSlug, locationSlug))
    if (saved) {
      const draft = JSON.parse(saved) as Partial<BookingGuestDraft>
      return {
        firstName: typeof draft.firstName === 'string' ? draft.firstName : '',
        phone: typeof draft.phone === 'string' ? draft.phone : '',
        email: typeof draft.email === 'string' ? draft.email : '',
      }
    }
  } catch { /* allow guest checkout when browser storage is unavailable */ }
  return { firstName: '', phone: '', email: '' }
}

function saveGuestDraft(customerSlug: string, locationSlug: string, draft: BookingGuestDraft) {
  try { localStorage.setItem(guestDraftKey(customerSlug, locationSlug), JSON.stringify(draft)) } catch { /* checkout remains usable without browser storage */ }
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

function reservationTerms(session: Pick<ClassSession, 'minimumParticipants'>, policy: Schedule['location']['cancellationPolicy'], isFrench: boolean) {
  const terms: string[] = []
  const creditPenalty = policy.lateCancelPenaltyCredits
  const latePenalty = [
    creditPenalty > 0 ? `${creditPenalty} ${isFrench ? (creditPenalty === 1 ? 'crédit' : 'crédits') : (creditPenalty === 1 ? 'credit' : 'credits')}` : '',
    policy.lateCancelPenaltyAmount != null && policy.lateCancelPenaltyAmount > 0 ? `${policy.lateCancelPenaltyAmount.toFixed(2)} €` : '',
  ].filter(Boolean).join(isFrench ? ' et ' : ' and ')

  terms.push(isFrench
    ? `Annulation gratuite au moins ${policy.lateCancelWindowHours} h avant le cours${latePenalty ? `. En cas d’annulation moins de ${policy.lateCancelWindowHours} h avant, une pénalité de ${latePenalty} s’applique` : ''}.`
    : `Cancel at least ${policy.lateCancelWindowHours} hours before class for free${latePenalty ? `. Cancelling less than ${policy.lateCancelWindowHours} hours before class incurs a ${latePenalty} late-cancellation penalty` : ''}.`)
  if (session.minimumParticipants != null && session.minimumParticipants > 0) {
    terms.push(isFrench
      ? `Le studio peut annuler le cours s’il y a moins de ${session.minimumParticipants} participants.`
      : `The studio may cancel the class if fewer than ${session.minimumParticipants} participants book.`)
  }
  return terms
}

function BookingPortalRoute() {
  const { customerSlug = '', locationSlug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [member, setMember] = useState<MemberState | null>(null)
  const [firstNameDraft, setFirstNameDraft] = useState('')
  const [guestFirstName, setGuestFirstName] = useState(() => readGuestDraft(customerSlug, locationSlug).firstName)
  const [guestPhone, setGuestPhone] = useState(() => readGuestDraft(customerSlug, locationSlug).phone)
  const [guestEmail, setGuestEmail] = useState(() => readGuestDraft(customerSlug, locationSlug).email)
  const [language, setLanguage] = useState<'fr' | 'en'>(readBookingLanguage)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<ClassSession | null>(null)
  const [selectedAction, setSelectedAction] = useState<'book' | 'cancel'>('book')
  const [bookingError, setBookingError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<'all' | 'booked'>(() => searchParams.get('filter') === 'booked' ? 'booked' : 'all')
  const [classFilter, setClassFilter] = useState(() => searchParams.get('class') ?? 'all')
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'midday' | 'evening'>(() => {
    const value = searchParams.get('time')
    return value === 'morning' || value === 'midday' || value === 'evening' ? value : 'all'
  })
  const [selectedDate, setSelectedDate] = useState(() => searchParams.get('date') ?? '')
  const [sessionLayout, setSessionLayout] = useState<'list' | 'grid'>(() => searchParams.get('layout') === 'grid' ? 'grid' : 'list')
  const [activeSection, setActiveSection] = useState<'planning' | 'offers'>(() => searchParams.get('section') === 'offers' ? 'offers' : 'planning')
  const [cancellationQuote, setCancellationQuote] = useState<CancellationQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [offers, setOffers] = useState<PricingOffer[]>([])
  const [offersLoading, setOffersLoading] = useState(false)
  const [offersError, setOffersError] = useState('')
  const [offerCheckoutError, setOfferCheckoutError] = useState('')
  const [offerToPurchase, setOfferToPurchase] = useState<PricingOffer | null>(null)
  const [forcedOfferFlow, setForcedOfferFlow] = useState(false)
  const [offerPaymentNotices, setOfferPaymentNotices] = useState<Record<string, string>>({})
  const [purchasingOfferId, setPurchasingOfferId] = useState('')
  const offerPurchaseInFlight = useRef(false)
  const [bookingUpsell, setBookingUpsell] = useState<{ className: string; products: ClassProductOffer[] } | null>(null)
  const [accessLoading, setAccessLoading] = useState<PublicAccessChannel | null>(null)
  const [accessError, setAccessError] = useState('')
  const [accessModal, setAccessModal] = useState<AccessModalState | null>(null)
  const [accessEmail, setAccessEmail] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [emailAccessLoading, setEmailAccessLoading] = useState(false)
  const restoredSession = useRef(false)
  const restoredOffer = useRef(false)
  const handledPaymentReturn = useRef('')
  const isFrench = language === 'fr'

  useEffect(() => {
    const draft = readGuestDraft(customerSlug, locationSlug)
    setGuestFirstName(draft.firstName)
    setGuestPhone(draft.phone)
    setGuestEmail(draft.email)
  }, [customerSlug, locationSlug])

  const updateGuestDraft = (field: keyof BookingGuestDraft, value: string) => {
    const draft = { firstName: guestFirstName, phone: guestPhone, email: guestEmail, [field]: value }
    setGuestFirstName(draft.firstName)
    setGuestPhone(draft.phone)
    setGuestEmail(draft.email)
    saveGuestDraft(customerSlug, locationSlug, draft)
  }

  const changeLanguage = (nextLanguage: 'fr' | 'en') => {
    setLanguage(nextLanguage)
    try { localStorage.setItem('ayana-booking-language', nextLanguage) } catch { /* language still changes for this visit */ }
  }

  const logout = () => {
    try { localStorage.removeItem(sessionKey(customerSlug, locationSlug)) } catch { /* clear in-memory session even if storage is unavailable */ }
    setMember(null)
    setFirstNameDraft('')
    setSessionFilter('all')
    setNotice('')
  }

  useEffect(() => {
    let active = true
    const tokenFromUrl = searchParams.get('token')
    const sessionTokenFromUrl = searchParams.get('session_token')
    const emailAccessParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const emailAccessId = emailAccessParams.get('emailAccessId')
    const emailAccessCode = emailAccessParams.get('emailAccessCode')
    if (emailAccessId || emailAccessCode) {
      const url = new URL(window.location.href)
      url.hash = ''
      window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    }
    if (tokenFromUrl) {
      const url = new URL(window.location.href)
      url.searchParams.delete('token')
      url.searchParams.delete('session_token')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    } else if (sessionTokenFromUrl) {
      const url = new URL(window.location.href)
      url.searchParams.delete('session_token')
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
        setSelectedDate((current) => current && schedulePayload.sessions.some((session) => session.localDate === current)
          ? current
          : schedulePayload.sessions[0]?.localDate ?? '')

        if (emailAccessId || emailAccessCode) {
          if (!emailAccessId || !emailAccessCode) {
            if (active) setNotice(isFrench ? 'Ce lien de connexion est incomplet. Demande un nouveau lien.' : 'This sign-in link is incomplete. Request a new one.')
            return
          }
          const accessResponse = await fetch(`${API_URL}/public-access/email/verify`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ verificationId: emailAccessId, code: emailAccessCode }),
          })
          const accessPayload = await accessResponse.json().catch(() => ({})) as { url?: string; message?: string | string[] }
          if (!accessResponse.ok || !accessPayload.url) {
            if (active) setNotice(responseMessage(accessPayload, isFrench ? 'Ce lien a expiré. Demande-en un nouveau.' : 'This link has expired. Request a new one.'))
            return
          }
          window.location.replace(accessPayload.url)
          return
        }

        const saved = tokenFromUrl ? null : readSession(customerSlug, locationSlug)
        const handoffToken = tokenFromUrl
        const sessionToken = sessionTokenFromUrl ?? saved?.token
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
          setFirstNameDraft(nextMember.identity.firstName ?? '')
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
  const memberSessions = useMemo(() => {
    const sessions = schedule?.sessions ?? []
    return member && sessionFilter === 'booked' ? sessions.filter((session) => booked.has(session.id)) : sessions
  }, [schedule, member, sessionFilter, booked])
  const sessionDates = useMemo(() => [...new Set(memberSessions.map((session) => session.localDate))].sort(), [memberSessions])
  const classNames = useMemo(() => [...new Set(memberSessions.map((session) => session.name))].sort((a, b) => a.localeCompare(b)), [memberSessions])
  const visibleSessions = useMemo(() => memberSessions.filter((session) => {
    if (classFilter !== 'all' && session.name !== classFilter) return false
    const hour = Number(session.localStartTime.slice(0, 2))
    if (timeFilter === 'morning' && (hour < 6 || hour >= 12)) return false
    if (timeFilter === 'midday' && (hour < 12 || hour >= 17)) return false
    if (timeFilter === 'evening' && (hour < 17 || hour >= 24)) return false
    return true
  }), [memberSessions, classFilter, timeFilter])
  const sessionsByDate = useMemo(() => {
    const sessions = visibleSessions
    return sessions.reduce<Record<string, ClassSession[]>>((groups, session) => {
      ;(groups[session.localDate] ??= []).push(session)
      return groups
    }, {})
  }, [visibleSessions])
  const selectedDateIndex = sessionDates.indexOf(selectedDate)
  const dateWindowStart = Math.max(0, Math.min(selectedDateIndex - 3, sessionDates.length - 7))
  const dateWindow = sessionDates.slice(dateWindowStart, dateWindowStart + 7)
  const selectedDateSessions = sessionsByDate[selectedDate] ?? []
  const moveSelectedDate = (offset: number) => {
    const nextIndex = Math.max(0, Math.min(sessionDates.length - 1, selectedDateIndex + offset))
    if (sessionDates[nextIndex]) setSelectedDate(sessionDates[nextIndex])
  }
  const needsCredits = Boolean(selected && member && selectedAction === 'book' && !member.hasUnlimitedContract && (forcedOfferFlow || member.creditBalance < selected.creditCost))
  const openAccessLink = async (channel: PublicAccessChannel, state: Record<string, unknown>) => {
    setAccessLoading(channel)
    setAccessError('')
    try {
      const url = await createPublicAccessLink({
        apiUrl: API_URL,
        customerSlug,
        locationSlug,
        destination: 'BOOKING',
        channel,
        language,
        state,
      })
      window.location.assign(url)
    } catch (reason) {
      setAccessError(reason instanceof Error ? reason.message : (isFrench ? 'Impossible de préparer le lien.' : 'Could not prepare the link.'))
      setAccessLoading(null)
    }
  }
  const openAccessModal = (state: Record<string, unknown>) => {
    setAccessError('')
    setAccessEmail('')
    setAccessCode('')
    setAccessModal({ view: 'choose', state, email: '' })
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
  const requestEmailAccessCode = async (event: FormEvent<HTMLFormElement>) => {
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
          destination: 'BOOKING',
          email: accessEmail.trim(),
          language,
          state: accessModal.state,
        }),
      })
      const payload = await response.json().catch(() => ({})) as { verificationId?: string; message?: string | string[] }
      if (!response.ok || !payload.verificationId) throw new Error(responseMessage(payload, isFrench ? 'Impossible d’envoyer le code.' : 'Could not send the code.'))
      setAccessModal({ ...accessModal, view: 'code', email: accessEmail.trim(), verificationId: payload.verificationId })
    } catch (reason) {
      setAccessError(reason instanceof Error ? reason.message : (isFrench ? 'Impossible d’envoyer le code.' : 'Could not send the code.'))
    } finally {
      setEmailAccessLoading(false)
    }
  }
  const verifyEmailAccessCode = async (event: FormEvent<HTMLFormElement>) => {
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
      if (!response.ok || !payload.url) throw new Error(responseMessage(payload, isFrench ? 'Code incorrect ou expiré.' : 'The code is incorrect or expired.'))
      window.location.assign(payload.url)
    } catch (reason) {
      setAccessError(reason instanceof Error ? reason.message : (isFrench ? 'Code incorrect ou expiré.' : 'The code is incorrect or expired.'))
    } finally {
      setEmailAccessLoading(false)
    }
  }
  const accessState = (resume: 'page' | 'session' | 'offer' = 'page') => ({
    section: activeSection,
    date: selectedDate,
    filter: sessionFilter,
    className: classFilter,
    time: timeFilter,
    layout: sessionLayout,
    ...(resume === 'session' && selected ? { resumeSession: selected.id } : {}),
    ...(resume === 'offer' && offerToPurchase ? { resumeOffer: offerToPurchase.id } : {}),
  })
  const renderAccessButtons = (state: Record<string, unknown>, buttonClass: string) => <div className="booking-access-buttons">
    <button type="button" className={buttonClass} onClick={() => openAccessModal(state)}>{isFrench ? 'Se connecter' : 'Sign in'}<span>→</span></button>
  </div>

  useEffect(() => {
    if (!schedule || restoredSession.current) return
    const sessionId = searchParams.get('resumeSession')
    if (!sessionId) return
    const session = schedule.sessions.find((item) => item.id === sessionId)
    if (!session) return
    restoredSession.current = true
    setActiveSection(searchParams.get('resumeOffer') ? 'offers' : 'planning')
    setSelected(session)
    setSelectedAction('book')
    const url = new URL(window.location.href)
    url.searchParams.delete('resumeSession')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [schedule, searchParams])

  useEffect(() => {
    if (!offers.length || restoredOffer.current) return
    const offerId = searchParams.get('resumeOffer')
    if (!offerId) return
    const offer = offers.find((item) => item.id === offerId)
    if (!offer) return
    restoredOffer.current = true
    setActiveSection('offers')
    setOfferToPurchase(offer)
    const url = new URL(window.location.href)
    url.searchParams.delete('resumeOffer')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [offers, searchParams])

  useEffect(() => {
    const shouldLoadOffers = activeSection === 'offers' || Boolean(member && needsCredits && selectedAction === 'book')
    if (!shouldLoadOffers) {
      setOffers([])
      setOffersError('')
      return
    }
    let active = true
    setOffersLoading(true)
    setOffersError('')
    const url = `${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/offers`
    void fetch(url, { method: 'POST', headers: member?.token ? { authorization: `Bearer ${member.token}` } : {} })
      .then(async (response) => {
        const payload = await response.json().catch(() => []) as PricingOffer[] & { message?: string | string[] }
        if (!response.ok) throw new Error(responseMessage(payload, isFrench ? 'Impossible de charger les formules.' : 'Could not load available plans.'))
        if (active) setOffers(Array.isArray(payload) ? payload : [])
      })
      .catch((reason) => { if (active) setOffersError(reason instanceof Error ? reason.message : (isFrench ? 'Impossible de charger les formules.' : 'Could not load available plans.')) })
      .finally(() => { if (active) setOffersLoading(false) })
    return () => { active = false }
  }, [customerSlug, locationSlug, member?.token, needsCredits, selectedAction, activeSection, isFrench])

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
    if (searchParams.get('payment') !== 'cancelled') return
    setNotice(isFrench
      ? 'Paiement annulé. Tu peux reprendre quand tu veux.'
      : 'Payment cancelled. You can continue whenever you’re ready.')
    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('payment')
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`)
  }, [searchParams, isFrench])

  useEffect(() => {
    const payment = searchParams.get('payment')
    const sessionId = searchParams.get('sessionId')
    if (payment !== 'success' || !schedule || !member) return
    const returnKey = `${payment}:${sessionId ?? 'offers'}`
    if (handledPaymentReturn.current === returnKey) return
    const session = sessionId ? schedule.sessions.find((item) => item.id === sessionId) : null
    if (sessionId && !session) return

    handledPaymentReturn.current = returnKey
    setActiveSection(session ? 'planning' : 'offers')
    if (session) {
      const filter = searchParams.get('filter')
      setSessionFilter(filter === 'booked' ? 'booked' : 'all')
      setSelected(session)
      setSelectedAction('book')
      setForcedOfferFlow(false)
      setBookingError('')
      setOffersError('')
    }
    setNotice(isFrench
      ? session ? 'Paiement effectué. Actualisation de tes crédits pour reprendre cette réservation…' : 'Paiement effectué. Actualisation de tes crédits…'
      : session ? 'Payment complete. Refreshing your credits so you can continue this booking…' : 'Payment complete. Refreshing your credits…')

    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('payment')
    cleanUrl.searchParams.delete('sessionId')
    cleanUrl.searchParams.delete('filter')
    cleanUrl.searchParams.delete('section')
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
            if (!session || updated.hasUnlimitedContract || updated.creditBalance >= session.creditCost) {
              setNotice(isFrench
                ? session ? 'Tes crédits sont à jour. Tu peux maintenant confirmer cette réservation.' : 'Tes crédits sont à jour. Tu peux consulter tes formules et réserver un cours.'
                : session ? 'Your credits are up to date. You can now confirm this booking.' : 'Your credits are up to date. You can view your plans and book a class.')
              return
            }
          }
        } catch { /* Stripe webhook or network may still be settling; retry below. */ }
        await new Promise((resolve) => window.setTimeout(resolve, 1200))
      }
      if (active) setNotice(isFrench
        ? session ? 'Paiement effectué. Le solde met un peu plus de temps à se mettre à jour ; cette séance est conservée, réessaie dans un instant.' : 'Paiement effectué. Le solde met un peu plus de temps à se mettre à jour ; réessaie dans un instant.'
        : session ? 'Payment complete. Your balance is taking a little longer to update; this class is still selected, please try again shortly.' : 'Payment complete. Your balance is taking a little longer to update; please try again shortly.')
    }
    void refreshCredits()
    return () => { active = false }
  }, [customerSlug, locationSlug, member?.token, schedule, searchParams, isFrench])

  const openBooking = (session: ClassSession) => {
    setBookingError('')
    setBookingUpsell(null)
    setForcedOfferFlow(false)
    setSelectedAction('book')
    setCancellationQuote(null)
    setSelected(session)
  }

  const openCancellation = async (session: ClassSession, bookingId: string) => {
    if (!member) return
    setBookingUpsell(null)
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

  const purchaseOffer = async (pricingOptionId: string, paymentMethod: 'link' | 'terminal') => {
    if (offerPurchaseInFlight.current) return
    const firstName = member
      ? member.identity.firstName?.trim() || firstNameDraft.trim()
      : guestFirstName.trim()
    if (!firstName) {
      setOfferCheckoutError(isFrench ? 'Indique ton prénom pour continuer.' : 'Enter your first name to continue.')
      return
    }
    if (!member && (validatePhone(guestPhone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim()))) {
      setOfferCheckoutError(isFrench ? 'Vérifie ton numéro de téléphone et ton e-mail.' : 'Check your phone number and email address.')
      return
    }
    offerPurchaseInFlight.current = true
    setPurchasingOfferId(pricingOptionId)
    setOfferCheckoutError('')
    try {
      const url = `${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/offers/checkout`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(member?.token ? { authorization: `Bearer ${member.token}` } : {}) },
        body: JSON.stringify({
          pricingOptionId,
          ...(selected?.id ? { sessionId: selected.id, sessionFilter } : {}),
          paymentMethod,
          language,
          firstName,
          ...(member ? {} : { phone: guestPhone, email: guestEmail.trim() }),
        }),
      })
      const payload = await response.json().catch(() => ({})) as { checkoutUrl?: string; awaitingPayment?: boolean; sessionToken?: string; message?: string | string[] }
      if (!response.ok) throw new Error(responseMessage(payload, isFrench ? 'Le paiement n’a pas pu être préparé.' : 'Could not prepare checkout.'))
      if (paymentMethod === 'link' && payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl)
        return
      } else if (paymentMethod === 'terminal' && payload.awaitingPayment) {
        if (!member && payload.sessionToken) {
          const meUrl = `${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/me`
          const meResponse = await fetch(meUrl, { method: 'POST', headers: { authorization: `Bearer ${payload.sessionToken}` } })
          const state = await meResponse.json().catch(() => ({})) as Partial<MemberState>
          if (meResponse.ok && state.identity && typeof state.creditBalance === 'number') {
            const nextMember = {
              ...state,
              token: payload.sessionToken,
              hasUnlimitedContract: state.hasUnlimitedContract === true,
              bookedSessionIds: state.bookedSessionIds ?? [],
              bookings: state.bookings ?? [],
            } as MemberState
            setMember(nextMember)
            setFirstNameDraft(nextMember.identity.firstName ?? '')
            localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(nextMember))
          }
        }
        setOfferPaymentNotices((current) => ({
          ...current,
          [pricingOptionId]: isFrench
            ? 'Ta formule est enregistrée. À l’accueil, tu pourras lire et accepter ses conditions sur le terminal avant de payer. Les crédits seront ajoutés après validation du paiement.'
            : 'Your plan is saved. At reception, review and accept its terms on the reader before paying. Credits will be added after payment is confirmed.',
        }))
        setOfferToPurchase(null)
      } else {
        throw new Error(responseMessage(payload, isFrench ? 'Le paiement n’a pas pu être préparé.' : 'Could not prepare checkout.'))
      }
      if (member && !member.identity.firstName?.trim()) {
        const updated = { ...member, identity: { ...member.identity, firstName: firstNameDraft.trim() } }
        setMember(updated)
        localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(updated))
      }
    } catch (reason) {
      setOfferCheckoutError(reason instanceof Error ? reason.message : (isFrench ? 'Le paiement n’a pas pu être préparé.' : 'Could not prepare checkout.'))
    } finally {
      offerPurchaseInFlight.current = false
      setPurchasingOfferId('')
    }
  }

  const createBooking = async () => {
    if (!selected || !member) return
    if (!member.identity.firstName?.trim() && !firstNameDraft.trim()) {
      setBookingError(isFrench ? 'Indique ton prénom avant de réserver ce cours.' : 'Enter your first name before booking this class.')
      return
    }
    setSubmitting(true)
    setBookingError('')
    try {
      const response = await fetch(`${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/bookings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${member.token}` },
        body: JSON.stringify({ sessionId: selected.id, ...(!member.identity.firstName?.trim() ? { firstName: firstNameDraft.trim() } : {}) }),
      })
      const payload = await response.json().catch(() => ({})) as BookingResult & { message?: string | string[] }
      if (!response.ok) throw new Error(responseMessage(payload, isFrench ? 'La réservation n’a pas pu être confirmée.' : 'The booking could not be confirmed.'))
      const nextMember = {
        ...member,
        identity: { ...member.identity, firstName: member.identity.firstName?.trim() || firstNameDraft.trim() },
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
      const products = payload.status === 'CONFIRMED' ? payload.relatedProducts ?? [] : []
      const hasBookingUpsell = products.length > 0
      const terms = payload.status === 'CONFIRMED' && schedule
        ? reservationTerms(selected, schedule.location.cancellationPolicy, isFrench)
        : []
      const confirmationMessage = payload.status === 'WAITLISTED'
        ? (isFrench ? 'Tu es sur la liste d’attente. La confirmation a été envoyée sur tes canaux liés.' : 'You are on the waitlist. A confirmation was sent to your linked channels.')
        : (isFrench ? 'Réservation confirmée. La confirmation a été envoyée sur tes canaux liés.' : 'Booking confirmed. A confirmation was sent to your linked channels.')
      setNotice(hasBookingUpsell
        ? ''
        : [confirmationMessage, ...terms.map((term) => `• ${term}`)].join('\n'))
      setBookingUpsell(hasBookingUpsell
        ? { className: selected.name, products }
        : null)
      if (!hasBookingUpsell) setSelected(null)
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

  const formatDateParts = (date: string) => {
    const [year, month, day] = date.split('-').map(Number)
    const value = new Date(Date.UTC(year, month - 1, day, 12))
    return {
      weekday: new Intl.DateTimeFormat(isFrench ? 'fr-FR' : 'en-GB', { weekday: 'short', timeZone: schedule?.location.timezone ?? 'Europe/Paris' }).format(value).replace('.', ''),
      day: new Intl.DateTimeFormat(isFrench ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', timeZone: schedule?.location.timezone ?? 'Europe/Paris' }).format(value).replace('.', ''),
    }
  }

  const renderPricingOffer = (offer: PricingOffer, standalone = false) => {
    const price = new Intl.NumberFormat(isFrench ? 'fr-FR' : 'en-GB', { style: 'currency', currency: offer.currency || 'EUR' }).format(offer.price)
    const creditsLabel = offer.creditsTotal != null
      ? `${offer.creditsTotal} ${isFrench ? 'crédits au total' : 'total credits'}`
      : offer.creditsPerPeriod != null
        ? `${offer.creditsPerPeriod} ${isFrench ? 'crédits' : 'credits'} / ${offer.creditsRefreshInterval?.toLowerCase() ?? (isFrench ? 'période' : 'period')}`
        : (isFrench ? 'Accès illimité' : 'Unlimited access')
    const billingLabel = offer.billingInterval && offer.billingInterval !== 'ONCE'
      ? `${isFrench ? 'Facturation' : 'Billed'} ${offer.billingInterval.toLowerCase()}`
      : (isFrench ? 'Paiement unique' : 'One-time payment')
    return <article className={`booking-offer${standalone ? ' booking-offer-standalone' : ''}`} key={offer.id}>
      <div><strong>{offer.name}</strong><b>{price}</b></div>
      {offer.description && <p>{offer.description}</p>}
      <small>{creditsLabel}{offer.validityDays ? ` · ${offer.validityDays} ${isFrench ? 'jours de validité' : 'days validity'}` : ''} · {billingLabel}{offer.minimumCommitmentMonths ? ` · ${offer.minimumCommitmentMonths} ${isFrench ? 'mois d’engagement minimum' : 'months minimum commitment'}` : ''}</small>
      {!!offer.perks?.length && <small>{offer.perks.join(' · ')}</small>}
      {offer.billingInterval && offer.billingInterval !== 'ONCE' && schedule?.location.paymentMethods?.terminal && <small className="booking-terminal-consent-hint">{isFrench ? 'Sur place, tu confirmeras sur le terminal le prélèvement initial et les renouvellements automatiques.' : 'In person, you’ll confirm the initial payment and automatic renewals on the reader.'}</small>}
      {!offerPaymentNotices[offer.id] && <button type="button" className="booking-offer-buy" onClick={() => { setOfferToPurchase(offer); setOfferCheckoutError('') }}>{isFrench ? 'Acheter' : 'Buy'}<span>→</span></button>}
      {offerPaymentNotices[offer.id] && <p className="booking-offer-payment-notice" role="status">{offerPaymentNotices[offer.id]}</p>}
    </article>
  }

  return <main className="ayana-booking">
    <header className="booking-topbar"><img src={ayanaLogo} alt="Ayana Feelness Club" /><span>{isFrench ? 'PLANNING & RÉSERVATION' : 'SCHEDULE & BOOKING'}</span><div className="booking-language" role="group" aria-label={isFrench ? 'Langue' : 'Language'}><button type="button" aria-pressed={isFrench} className={isFrench ? 'active' : ''} onClick={() => changeLanguage('fr')}>FR</button><button type="button" aria-pressed={!isFrench} className={!isFrench ? 'active' : ''} onClick={() => changeLanguage('en')}>EN</button></div></header>
    {loading ? <div className="booking-loading"><span className="booking-spinner" />{isFrench ? 'Chargement du planning…' : 'Loading schedule…'}</div> : error ? <section className="booking-empty"><p className="booking-eyebrow">AYANA FEELNESS CLUB</p><h1>{isFrench ? 'Planning indisponible' : 'Schedule unavailable'}</h1><p>{error}</p></section> : <>
      <section className="booking-hero">
        <p className="booking-eyebrow">{schedule?.location.name}</p>
        <h1>{activeSection === 'offers' ? (isFrench ? 'Nos formules' : 'Our plans') : (isFrench ? 'Le planning' : 'Class schedule')}<br /><em>{schedule?.location.name}</em></h1>
        <p>{activeSection === 'offers'
          ? (isFrench ? 'Choisis un pack ou un abonnement pour réserver tes cours.' : 'Choose a pack or membership to book classes.')
          : (isFrench ? 'Choisis ton cours et réserve en quelques instants.' : 'Choose your class and book in just a few taps.')}</p>
        <div className="booking-hero-pillars" aria-label={isFrench ? 'Univers Ayana' : 'The Ayana experience'}>
          <div><span aria-hidden="true">♧</span><p>Reformer<br />Pilates</p></div>
          <div><span aria-hidden="true">☕</span><p>Coffee<br />Matcha</p></div>
          <div><span aria-hidden="true">✧</span><p>Wellness<br />Lifestyle</p></div>
        </div>
      </section>

      {member
        ? <section className="booking-member">
          <div className="booking-member-identity"><span className="booking-avatar">{(member.identity.firstName?.[0] ?? member.identity.lastName?.[0] ?? 'A').toUpperCase()}</span><div><span>{isFrench ? 'Connecté·e' : 'Signed in'}</span><strong>{[member.identity.firstName, member.identity.lastName].filter(Boolean).join(' ')}</strong></div></div>
          <div className="booking-member-actions"><div className="booking-balance"><b>{member.hasUnlimitedContract ? '∞' : new Intl.NumberFormat(isFrench ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 2 }).format(member.creditBalance)}</b><span>{member.hasUnlimitedContract ? (isFrench ? 'accès illimité' : 'unlimited') : (isFrench ? 'crédits' : 'credits')}</span></div><button type="button" className="booking-member-plans" onClick={() => setActiveSection('offers')}><span aria-hidden="true">▤</span>{isFrench ? 'Packs & abonnements' : 'Packs & memberships'}<b>→</b></button><button type="button" className="booking-logout" onClick={logout} aria-label={isFrench ? 'Se déconnecter' : 'Log out'} title={isFrench ? 'Se déconnecter' : 'Log out'}>↪</button></div>
        </section>
        : activeSection !== 'offers' && <section className="booking-login-card"><div><strong>{isFrench ? 'Connecte-toi à ton compte Ayana' : 'Sign in to your Ayana account'}</strong><span>{isFrench ? 'Reviens au planning avec tes réservations et tes crédits.' : 'Return to the schedule with your bookings and credits.'}</span></div><div>{renderAccessButtons(accessState(), 'booking-whatsapp-cta')}{accessError && <p className="booking-error" role="alert">{accessError}</p>}</div></section>}
      {notice && <div className="booking-notice" role="status">{notice}</div>}

      <nav className="booking-section-tabs" role="tablist" aria-label={isFrench ? 'Planning et formules' : 'Schedule and plans'}>
        <button type="button" role="tab" aria-selected={activeSection === 'planning'} className={activeSection === 'planning' ? 'active' : ''} onClick={() => setActiveSection('planning')}><span aria-hidden="true">▣</span>{isFrench ? 'Planning' : 'Schedule'}</button>
        <button type="button" role="tab" aria-selected={activeSection === 'offers'} className={activeSection === 'offers' ? 'active' : ''} onClick={() => setActiveSection('offers')}><span aria-hidden="true">◇</span>{isFrench ? 'Packs & abonnements' : 'Packs & memberships'}</button>
      </nav>

      {activeSection === 'planning' && <>
        <section className="booking-calendar-controls" aria-label={isFrench ? 'Choisir une date et filtrer les cours' : 'Choose a date and filter classes'}>
          <div className="booking-date-carousel">
            <button type="button" className="booking-date-arrow" aria-label={isFrench ? 'Jours précédents' : 'Previous days'} disabled={!selectedDateIndex || selectedDateIndex < 0} onClick={() => moveSelectedDate(-1)}>‹</button>
            <div className="booking-date-strip">
              {dateWindow.map((date) => {
                const parts = formatDateParts(date)
                return <button type="button" key={date} className={`booking-date-option${date === selectedDate ? ' active' : ''}`} aria-pressed={date === selectedDate} onClick={() => setSelectedDate(date)}>
                  <span>{parts.weekday}</span><strong>{parts.day}</strong>
                </button>
              })}
            </div>
            <button type="button" className="booking-date-arrow" aria-label={isFrench ? 'Jours suivants' : 'Next days'} disabled={selectedDateIndex < 0 || selectedDateIndex >= sessionDates.length - 1} onClick={() => moveSelectedDate(1)}>›</button>
          </div>

          <div className="booking-filterbar">
            <label className="booking-filter-select booking-filter-bookings"><span aria-hidden="true">☷</span><select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value as 'all' | 'booked')} aria-label={isFrench ? 'Afficher les cours ou mes réservations' : 'Show classes or my bookings'}>
              <option value="all">{isFrench ? 'Tous les cours' : 'All classes'}</option>
              {member && <option value="booked">{isFrench ? 'Mes réservations' : 'My bookings'}</option>}
            </select><span className="booking-select-chevron">⌄</span></label>
            <label className="booking-filter-select"><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} aria-label={isFrench ? 'Type de cours' : 'Class type'}>
              <option value="all">{isFrench ? 'Tous les types' : 'All class types'}</option>
              {classNames.map((name) => <option value={name} key={name}>{name}</option>)}
            </select><span className="booking-select-chevron">⌄</span></label>
            <label className="booking-filter-select"><select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as typeof timeFilter)} aria-label={isFrench ? 'Horaire' : 'Time of day'}>
              <option value="all">{isFrench ? 'Tous les horaires' : 'All times'}</option>
              <option value="morning">{isFrench ? 'Matin' : 'Morning'}</option>
              <option value="midday">{isFrench ? 'Midi / après-midi' : 'Midday / afternoon'}</option>
              <option value="evening">{isFrench ? 'Soir' : 'Evening'}</option>
            </select><span className="booking-select-chevron">⌄</span></label>
            <div className="booking-layout-switch" role="group" aria-label={isFrench ? 'Affichage des cours' : 'Class layout'}>
              <button type="button" className={sessionLayout === 'grid' ? 'active' : ''} aria-label={isFrench ? 'Affichage en grille' : 'Grid view'} aria-pressed={sessionLayout === 'grid'} onClick={() => setSessionLayout('grid')}>▦</button>
              <button type="button" className={sessionLayout === 'list' ? 'active' : ''} aria-label={isFrench ? 'Affichage en liste' : 'List view'} aria-pressed={sessionLayout === 'list'} onClick={() => setSessionLayout('list')}>☷</button>
            </div>
          </div>
        </section>

        <div className="booking-day-heading"><h2>{selectedDate ? formatDate(selectedDate) : (isFrench ? 'Prochains cours' : 'Upcoming classes')}</h2><span>{selectedDateSessions.length} {isFrench ? 'cours disponibles' : 'classes available'}</span></div>
        {selectedDateSessions.length === 0 ? <section className="booking-empty booking-day-empty">
          <h2>{member && sessionFilter === 'booked' ? (isFrench ? 'Aucune réservation ce jour-là' : 'No bookings on this day') : (isFrench ? 'Aucun cours disponible ce jour-là' : 'No classes available on this day')}</h2>
          <p>{isFrench ? 'Choisis un autre jour ou modifie les filtres.' : 'Choose another day or change the filters.'}</p>
          {member && sessionFilter === 'booked' && <button type="button" className="booking-empty-action" onClick={() => setSessionFilter('all')}>{isFrench ? 'Voir tous les cours' : 'View all classes'}</button>}
        </section> : <div className={`booking-session-list booking-session-list-${sessionLayout}`}>
          {selectedDateSessions.map((session) => {
            const alreadyBooked = booked.has(session.id)
            const booking = member?.bookings.find((item) => item.sessionId === session.id)
            const availabilityLabel = alreadyBooked
              ? (isFrench ? 'Réservé·e' : 'Booked')
              : session.isWaitlist || session.availableSpots <= 0
                ? (isFrench ? 'Complet' : 'Full')
                : session.availableSpots <= 2
                  ? (isFrench
                    ? `${session.availableSpots} ${session.availableSpots === 1 ? 'place restante' : 'places restantes'}`
                    : `${session.availableSpots} ${session.availableSpots === 1 ? 'spot left' : 'spots left'}`)
                  : null
            return <article className="booking-session" key={session.id}>
              <div className="booking-session-time"><strong>{session.localStartTime}</strong><span>{session.localEndTime}</span></div>
              <div className="booking-session-copy">
                <div className="booking-session-title"><h3>{session.name}</h3>{session.category && <span>{session.category}</span>}</div>
                <div className="booking-session-meta"><span>◷</span>{session.duration} min{session.coachName ? ` · ${session.coachName}` : ''}{session.category && <><i />{session.category}</>}</div>
                {session.description && <p className="booking-session-description">{session.description}</p>}
                {session.conditions && <p className="booking-conditions"><span aria-hidden="true">♧</span>{session.conditions}</p>}
                {schedule?.location.cancellationPolicy && <details className="booking-session-terms">
                  <summary>{isFrench ? 'Conditions d’annulation' : 'Cancellation conditions'}</summary>
                  <ul>{reservationTerms(session, schedule.location.cancellationPolicy, isFrench).map((term) => <li key={term}>{term}</li>)}</ul>
                </details>}
              </div>
              <div className="booking-session-actions">
                {availabilityLabel && <span className={`booking-spots${!alreadyBooked && (session.isWaitlist || session.availableSpots <= 0) ? ' booking-spots-full' : !alreadyBooked ? ' booking-spots-low' : ''}`}>{alreadyBooked ? '✓ ' : (session.isWaitlist || session.availableSpots <= 0) ? '• ' : '♙ '}{availabilityLabel}</span>}
                <button type="button" className={`booking-session-action${alreadyBooked ? ' booking-manage-action' : ''}`} onClick={() => alreadyBooked && booking ? void openCancellation(session, booking.bookingId) : openBooking(session)}>{alreadyBooked ? (isFrench ? 'Gérer / annuler' : 'Manage / cancel') : session.isWaitlist || session.availableSpots <= 0 ? (isFrench ? 'Liste d’attente' : 'Join waitlist') : (isFrench ? 'Réserver' : 'Book')}<span>→</span></button>
                <small>{session.creditCost} {isFrench ? 'crédit' : 'credit'}{session.creditCost === 1 ? '' : 's'}</small>
              </div>
            </article>
          })}
        </div>}
      </>}

      {activeSection === 'offers' && <section className="booking-plans">
        <header className="booking-plans-heading">
          <p className="booking-eyebrow">{isFrench ? 'FORMULES DU STUDIO' : 'STUDIO PLANS'}</p>
          <h2>{isFrench ? 'Packs & abonnements' : 'Packs & memberships'}</h2>
          <p>{isFrench ? 'Choisis une formule pour profiter des cours de ce studio. Tes crédits seront associés à ton compte Ayana.' : 'Choose a plan for classes at this studio. Your credits will be added to your Ayana account.'}</p>
        </header>
        {offersLoading && <div className="booking-loading booking-plans-loading"><span className="booking-spinner" />{isFrench ? 'Chargement des formules…' : 'Loading plans…'}</div>}
        {!offersLoading && offers.length === 0 && !offersError && <div className="booking-empty booking-plans-empty"><h2>{isFrench ? 'Aucune formule disponible' : 'No plans available'}</h2><p>{isFrench ? 'Les formules disponibles à l’achat apparaîtront ici.' : 'Plans available to purchase will appear here.'}</p></div>}
        {offersError && <div className="booking-error" role="alert">{offersError}</div>}
        {offers.length > 0 && <div className="booking-plans-list">{offers.map((offer) => renderPricingOffer(offer, true))}</div>}
      </section>}
      <footer className="booking-footer">{isFrench ? 'AYANA FEELNESS CLUB · RÉSERVATION EN LIGNE' : 'AYANA FEELNESS CLUB · ONLINE BOOKING'}</footer>
    </>}

    {offerToPurchase && !accessModal && <div className="booking-overlay booking-flow-overlay" role="presentation" onClick={() => !purchasingOfferId && setOfferToPurchase(null)}><section className="booking-sheet booking-flow-panel booking-purchase-sheet" role="dialog" aria-modal="true" aria-labelledby="booking-purchase-title" onClick={(event) => event.stopPropagation()}>
      <div className="booking-flow-nav"><button type="button" disabled={Boolean(purchasingOfferId)} onClick={() => setOfferToPurchase(null)}><span aria-hidden="true">←</span>{isFrench ? 'Retour' : 'Back'}</button><button type="button" aria-label={isFrench ? 'Fermer' : 'Close'} disabled={Boolean(purchasingOfferId)} onClick={() => setOfferToPurchase(null)}>×</button></div>
      <button type="button" className="booking-close" aria-label={isFrench ? 'Fermer' : 'Close'} disabled={Boolean(purchasingOfferId)} onClick={() => setOfferToPurchase(null)}>×</button>
      <p className="booking-eyebrow">{isFrench ? 'TA COMMANDE' : 'YOUR ORDER'}</p>
      <h2 id="booking-purchase-title">{isFrench ? 'Paiement de la formule' : 'Plan payment'}</h2>
      <div className="booking-recap booking-purchase-summary">
        <strong>{new Intl.NumberFormat(isFrench ? 'fr-FR' : 'en-GB', { style: 'currency', currency: offerToPurchase.currency || 'EUR' }).format(offerToPurchase.price)}</strong>
        <b>{offerToPurchase.name}</b>
        {offerToPurchase.description && <span>{offerToPurchase.description}</span>}
        <span>{offerToPurchase.billingInterval && offerToPurchase.billingInterval !== 'ONCE' ? (isFrench ? `Abonnement · facturation ${offerToPurchase.billingInterval.toLowerCase()}` : `Membership · billed ${offerToPurchase.billingInterval.toLowerCase()}`) : (isFrench ? 'Paiement unique' : 'One-time payment')}{offerToPurchase.minimumCommitmentMonths ? ` · ${offerToPurchase.minimumCommitmentMonths} ${isFrench ? 'mois d’engagement minimum' : 'months minimum commitment'}` : ''}</span>
      </div>
      {!member ? <>
        <p className="booking-purchase-explanation">{isFrench ? 'Connecte-toi à ton compte Ayana, ou continue en invité avec tes coordonnées.' : 'Sign in to your Ayana account, or continue as a guest with your contact details.'}</p>
        {renderAccessButtons(accessState('offer'), 'booking-purchase-whatsapp')}
        {accessError && <div className="booking-error" role="alert">{accessError}</div>}
        <p className="booking-purchase-divider"><span>{isFrench ? 'ou continuer en invité' : 'or continue as a guest'}</span></p>
      </> : <div className="booking-purchase-account"><span>{isFrench ? 'Compte Ayana connecté' : 'Ayana account connected'}</span><strong>{[member.identity.firstName, member.identity.lastName].filter(Boolean).join(' ') || member.identity.email}</strong></div>}
      {!member?.identity.firstName?.trim() && <label className="booking-first-name booking-purchase-field">{isFrench ? 'Prénom' : 'First name'}<input autoComplete="given-name" required maxLength={80} value={member ? firstNameDraft : guestFirstName} onChange={(event) => member ? setFirstNameDraft(event.target.value) : updateGuestDraft('firstName', event.target.value)} placeholder={isFrench ? 'Prénom' : 'First name'} /></label>}
      {!member && <PhoneInput label={isFrench ? 'Téléphone' : 'Phone number'} value={guestPhone} placeholder={isFrench ? 'Numéro de téléphone' : 'Phone number'} required nativeCountrySelector onValueChange={(value) => updateGuestDraft('phone', value)} />}
      {!member && <label className="booking-first-name booking-purchase-field">{isFrench ? 'E-mail' : 'Email'}<input type="email" autoComplete="email" required maxLength={254} value={guestEmail} onChange={(event) => updateGuestDraft('email', event.target.value)} placeholder={isFrench ? 'adresse@exemple.com' : 'name@example.com'} /></label>}
      {offerCheckoutError && <div className="booking-error" role="alert">{offerCheckoutError}</div>}
      <div className="booking-purchase-actions">
        {schedule?.location.paymentMethods?.online !== false && <button type="button" className="booking-purchase-online" disabled={Boolean(purchasingOfferId) || !(member?.identity.firstName?.trim() || firstNameDraft.trim() || guestFirstName.trim()) || (!member && (Boolean(validatePhone(guestPhone)) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())))} onClick={() => void purchaseOffer(offerToPurchase.id, 'link')}>
          {purchasingOfferId === offerToPurchase.id ? (isFrench ? 'Préparation du paiement…' : 'Preparing payment…') : (isFrench ? 'Payer en ligne par carte' : 'Pay online by card')}<span>→</span>
        </button>}
        {schedule?.location.paymentMethods?.terminal && <button type="button" className="booking-purchase-terminal" disabled={Boolean(purchasingOfferId) || !(member?.identity.firstName?.trim() || firstNameDraft.trim() || guestFirstName.trim()) || (!member && (Boolean(validatePhone(guestPhone)) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())))} onClick={() => void purchaseOffer(offerToPurchase.id, 'terminal')}>
          {purchasingOfferId === offerToPurchase.id ? (isFrench ? 'Préparation…' : 'Preparing…') : (isFrench ? 'Payer sur place par carte' : 'Pay in person by card')}<span>→</span>
        </button>}
      </div>
    </section></div>}

    {selected && !offerToPurchase && !accessModal && <div className="booking-overlay booking-flow-overlay" role="presentation" onClick={() => !submitting && setSelected(null)}><section className="booking-sheet booking-flow-panel" role="dialog" aria-modal="true" aria-labelledby="booking-confirm-title" onClick={(event) => event.stopPropagation()}>
      <div className="booking-flow-nav"><button type="button" disabled={submitting} onClick={() => setSelected(null)}><span aria-hidden="true">←</span>{isFrench ? 'Retour au planning' : 'Back to schedule'}</button><button type="button" aria-label={isFrench ? 'Fermer' : 'Close'} disabled={submitting} onClick={() => setSelected(null)}>×</button></div>
      <button type="button" className="booking-close" aria-label={isFrench ? 'Fermer' : 'Close'} disabled={submitting} onClick={() => setSelected(null)}>×</button>
      <p className="booking-eyebrow">{bookingUpsell ? (isFrench ? 'RÉSERVATION CONFIRMÉE' : 'BOOKING CONFIRMED') : selectedAction === 'cancel' ? (isFrench ? 'POLITIQUE D’ANNULATION' : 'CANCELLATION POLICY') : (isFrench ? 'RÉCAPITULATIF' : 'BOOKING SUMMARY')}</p>
      <h2 id="booking-confirm-title">{bookingUpsell ? (isFrench ? 'C’est réservé !' : 'You’re booked!') : selectedAction === 'cancel' ? (isFrench ? 'Annuler cette réservation ?' : 'Cancel this booking?') : (isFrench ? 'Confirmer ce cours ?' : 'Confirm this class?')}</h2>
      <div className="booking-recap"><strong>{selected.name}</strong><span>{formatDate(selected.localDate)} · {selected.localStartTime}–{selected.localEndTime}</span><span>{schedule?.location.name}</span>{selectedAction === 'book' && <span>{selected.creditCost} {isFrench ? 'crédit(s)' : 'credit(s)'}</span>}{selected.description && <p className="booking-recap-description">{selected.description}</p>}{selected.conditions && <p>{selected.conditions}</p>}{selectedAction === 'book' && schedule?.location.cancellationPolicy && <ul className="booking-recap-terms">{reservationTerms(selected, schedule.location.cancellationPolicy, isFrench).map((term) => <li key={term}>{term}</li>)}</ul>}</div>
      {member && selectedAction === 'book' && !member.identity.firstName?.trim() && <label className="booking-first-name">{isFrench ? 'Ton prénom' : 'Your first name'}<input autoComplete="given-name" maxLength={80} value={firstNameDraft} onChange={(event) => setFirstNameDraft(event.target.value)} placeholder={isFrench ? 'Prénom' : 'First name'} /></label>}
      {bookingUpsell ? <>
        <p className="booking-upsell-confirmation">{isFrench ? 'La confirmation a été envoyée sur tes canaux liés. Pour ce cours, tu peux aussi apporter ces articles ou les acheter à la boutique du studio.' : 'Your confirmation was sent to your linked channels. You can bring these items for class or buy them from the studio shop.'}</p>
        {schedule?.location.cancellationPolicy && <ul className="booking-recap-terms booking-upsell-terms">{reservationTerms(selected, schedule.location.cancellationPolicy, isFrench).map((term) => <li key={term}>{term}</li>)}</ul>}
        <section className="booking-class-products" aria-label={isFrench ? 'Produits associés au cours' : 'Products for this class'}>
          <div className="booking-class-products-heading">
            <p className="booking-eyebrow">{isFrench ? 'POUR TON COURS' : 'FOR YOUR CLASS'}</p>
            <h2>{isFrench ? `À prévoir pour ${bookingUpsell.className}` : `For ${bookingUpsell.className}`}</h2>
          </div>
          <div className="booking-class-products-list">
            {bookingUpsell.products.map((product) => {
              const lowestPrice = Math.min(...product.variants.map((variant) => variant.price))
              return <article className="booking-class-product" key={product.id}>
                <div className="booking-class-product-copy">
                  <span className={`booking-class-product-kind ${product.kind === 'REQUIRED' ? 'required' : ''}`}>
                    {product.kind === 'REQUIRED' ? (isFrench ? 'Requis' : 'Required') : (isFrench ? 'Recommandé' : 'Recommended')}
                  </span>
                  <strong>{product.name}</strong>
                  {product.description && <p>{product.description}</p>}
                  {product.variants.length > 1 && <small>{isFrench ? 'Plusieurs formats disponibles' : 'Multiple options available'}</small>}
                </div>
                <div className="booking-class-product-action">
                  <b>{isFrench ? 'À partir de ' : 'From '}{new Intl.NumberFormat(isFrench ? 'fr-FR' : 'en-GB', { style: 'currency', currency: product.currency || 'EUR' }).format(lowestPrice)}</b>
                  <a href={product.orderUrl} target="_blank" rel="noreferrer">{isFrench ? 'Voir en boutique' : 'View in shop'}<span>↗</span></a>
                </div>
              </article>
            })}
          </div>
        </section>
      </> : !member ? <div className="booking-auth-hint"><p>{isFrench ? 'Connecte-toi pour réserver ce cours.' : 'Sign in to book this class.'}</p>{renderAccessButtons(accessState('session'), 'booking-whatsapp-cta')}{accessError && <div className="booking-error" role="alert">{accessError}</div>}</div>
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
          {offers.map((offer) => renderPricingOffer(offer))}
          {offersError && <div className="booking-error" role="alert">{offersError}</div>}
        </div>
        : <p className="booking-confirm-hint">{isFrench ? 'Ta réservation sera confirmée après validation.' : 'Your booking will be confirmed after you submit.'}</p>}
      {bookingError && <div className="booking-error" role="alert">{bookingError}</div>}
      <div className={`booking-sheet-actions${bookingUpsell ? ' booking-sheet-actions-done' : ''}`}>{bookingUpsell ? <button type="button" className="booking-confirm" onClick={() => { setBookingUpsell(null); setSelected(null) }}>{isFrench ? 'Terminé' : 'Done'}</button> : <><button type="button" className="booking-cancel" disabled={submitting} onClick={() => setSelected(null)}>{selectedAction === 'cancel' ? (isFrench ? 'Garder le cours' : 'Keep booking') : (isFrench ? 'Fermer' : 'Close')}</button>{member && selectedAction === 'cancel' && cancellationQuote?.canCancel && <button type="button" className="booking-confirm booking-danger" disabled={submitting || quoteLoading} onClick={() => void cancelBooking()}>{submitting ? (isFrench ? 'Annulation…' : 'Cancelling…') : (isFrench ? 'Confirmer l’annulation' : 'Confirm cancellation')}</button>}{member && selectedAction === 'book' && <button type="button" className="booking-confirm" disabled={submitting || needsCredits || (!member.identity.firstName?.trim() && !firstNameDraft.trim())} onClick={() => void createBooking()}>{submitting ? (isFrench ? 'Réservation…' : 'Booking…') : (isFrench ? 'Confirmer la réservation' : 'Confirm booking')}</button>}</>}</div>
    </section></div>}

    {accessModal && <div className="booking-overlay booking-flow-overlay" role="presentation" onClick={() => !emailAccessLoading && setAccessModal(null)}><section className="booking-sheet booking-flow-panel booking-access-sheet" role="dialog" aria-modal="true" aria-labelledby="booking-access-title" onClick={(event) => event.stopPropagation()}>
      <div className="booking-flow-nav"><button type="button" disabled={emailAccessLoading} onClick={backInAccessFlow}><span aria-hidden="true">←</span>{accessModal.view === 'choose' ? (isFrench ? 'Retour' : 'Back') : (isFrench ? 'Précédent' : 'Previous')}</button><button type="button" aria-label={isFrench ? 'Fermer' : 'Close'} disabled={emailAccessLoading} onClick={() => setAccessModal(null)}>×</button></div>
      <button type="button" className="booking-close" aria-label={isFrench ? 'Fermer' : 'Close'} disabled={emailAccessLoading} onClick={() => setAccessModal(null)}>×</button>
      <p className="booking-eyebrow">AYANA</p>
      <h2 id="booking-access-title">{accessModal.view === 'choose' ? (isFrench ? 'Connecte-toi à ton compte Ayana' : 'Sign in to your Ayana account') : accessModal.view === 'email' ? (isFrench ? 'Connexion par e-mail' : 'Sign in with email') : (isFrench ? 'Vérifie ton e-mail' : 'Check your email')}</h2>
      {accessModal.view === 'choose' ? <div className="booking-access-methods">
        <button type="button" className="booking-access-method booking-access-email" onClick={() => { setAccessError(''); setAccessModal({ ...accessModal, view: 'email' }) }}>{isFrench ? 'Continuer avec e-mail' : 'Continue with email'}<span>→</span></button>
        {schedule?.location.whatsappNumber && <button type="button" className="booking-access-method booking-access-whatsapp" disabled={Boolean(accessLoading)} onClick={() => void openAccessLink('WHATSAPP', accessModal.state)}>{accessLoading === 'WHATSAPP' ? (isFrench ? 'Préparation…' : 'Preparing…') : (isFrench ? 'Continuer avec WhatsApp' : 'Continue with WhatsApp')}<span>↗</span></button>}
        {schedule?.location.telegramBotUsername && <button type="button" className="booking-access-method booking-access-telegram" disabled={Boolean(accessLoading)} onClick={() => void openAccessLink('TELEGRAM', accessModal.state)}>{accessLoading === 'TELEGRAM' ? (isFrench ? 'Préparation…' : 'Preparing…') : (isFrench ? 'Continuer avec Telegram' : 'Continue with Telegram')}<span>↗</span></button>}
      </div> : accessModal.view === 'email' ? <form className="booking-access-form" onSubmit={(event) => void requestEmailAccessCode(event)}>
        <p>{isFrench ? 'Saisis ton adresse e-mail. Si tu as déjà un compte, tu seras connecté·e. Sinon, ton compte Ayana sera créé après vérification.' : 'Enter your email address. If you already have an account, you’ll be signed in. Otherwise, we’ll create your Ayana account after verification.'}</p>
        <label className="booking-first-name">E-mail<input type="email" autoComplete="email" autoFocus required maxLength={254} value={accessEmail} onChange={(event) => setAccessEmail(event.target.value)} placeholder="adresse@exemple.com" /></label>
        <button type="submit" className="booking-confirm" disabled={emailAccessLoading}>{emailAccessLoading ? (isFrench ? 'Envoi…' : 'Sending…') : (isFrench ? 'Recevoir un code' : 'Send me a code')}</button>
        <button type="button" className="booking-cancel" disabled={emailAccessLoading} onClick={() => { setAccessError(''); setAccessModal({ ...accessModal, view: 'choose' }) }}>{isFrench ? 'Retour aux options' : 'Back to sign-in options'}</button>
      </form> : <form className="booking-access-form" onSubmit={(event) => void verifyEmailAccessCode(event)}>
        <p>{isFrench ? `Saisis le code à 6 chiffres envoyé à ${accessModal.email}.` : `Enter the 6-digit code sent to ${accessModal.email}.`}</p>
        <label className="booking-first-name">{isFrench ? 'Code de vérification' : 'Verification code'}<input inputMode="numeric" autoComplete="one-time-code" autoFocus required minLength={6} maxLength={6} pattern="[0-9]{6}" value={accessCode} onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label>
        <button type="submit" className="booking-confirm" disabled={emailAccessLoading || accessCode.length !== 6}>{emailAccessLoading ? (isFrench ? 'Vérification…' : 'Verifying…') : (isFrench ? 'Valider et ouvrir le planning' : 'Verify and open schedule')}</button>
        <button type="button" className="booking-cancel" disabled={emailAccessLoading} onClick={() => { setAccessError(''); setAccessCode(''); setAccessModal({ ...accessModal, view: 'email', verificationId: undefined }) }}>{isFrench ? 'Changer d’adresse e-mail' : 'Use a different email'}</button>
      </form>}
      {accessError && <div className="booking-error" role="alert">{accessError}</div>}
    </section></div>}
  </main>
}

export function BookingPortalPage() { return <BookingPortalRoute /> }

export function BookingPortalApp() {
  const isFrench = browserLanguage() === 'fr'
  return <BrowserRouter><Routes><Route path="/:customerSlug/:locationSlug" element={<BookingPortalRoute />} /><Route path="*" element={<main className="ayana-booking"><section className="booking-empty"><h1>Ayana</h1><p>{isFrench ? 'Le lien du planning est incomplet.' : 'The schedule link is incomplete.'}</p></section></main>} /></Routes></BrowserRouter>
}
