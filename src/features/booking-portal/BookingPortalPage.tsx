import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { BrowserRouter, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import ayanaLogo from '@/assets/ayana-logo.png'
import { PhoneInput } from '@/components/ui/phone-input'
import { validatePhone } from '@/lib/phone'
import { createPublicAccessLink, type PublicAccessChannel } from '@/lib/public-access'
import './i18n'
import './booking-portal.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

type ClassSession = {
  id: string
  classTypeId: string
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
  coachLanguages?: string[]
  coachImageUrl?: string | null
  capacity: number
  bookedCount: number
  availableSpots: number
  isWaitlist: boolean
  egymAvailable?: boolean
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
  identity: { firstName?: string | null; lastName?: string | null; phone?: string | null; email?: string | null; language?: string | null }
  creditBalance: number
  hasUnlimitedContract: boolean
  classCreditBalances?: Record<string, { credits: number; unlimited: boolean }>
  bookedSessionIds: string[]
  bookings: Array<{ bookingId: string; sessionId: string; status: 'CONFIRMED' | 'WAITLISTED' }>
}

type BookingResult = { bookingId: string; status: 'CONFIRMED' | 'WAITLISTED'; creditBalance: number; shortMessage: string; relatedProducts?: ClassProductOffer[] }
type EgymBookingResult = { bookingId: string; status: 'CONFIRMED'; sessionToken?: string }
type EgymValidationResult = {
  valid: true
  sessionToken?: string
  member?: Omit<MemberState, 'token'>
  accountToken?: string
  refreshToken?: string
  message?: string | string[]
}
type EgymMemberPayload = Partial<MemberState> & { message?: string | string[] }
type PricingOffer = {
  id: string
  name: string
  description?: string | null
  type: string
  price: number
  originalPrice?: number
  discountPercent?: number
  partnershipName?: string
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

type BookingGuestDraft = { firstName: string; lastName: string; phone: string; email: string }
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
        lastName: typeof draft.lastName === 'string' ? draft.lastName : '',
        phone: typeof draft.phone === 'string' ? draft.phone : '',
        email: typeof draft.email === 'string' ? draft.email : '',
      }
    }
  } catch { /* allow guest checkout when browser storage is unavailable */ }
  return { firstName: '', lastName: '', phone: '', email: '' }
}

function saveGuestDraft(customerSlug: string, locationSlug: string, draft: BookingGuestDraft) {
  try { localStorage.setItem(guestDraftKey(customerSlug, locationSlug), JSON.stringify(draft)) } catch { /* checkout remains usable without browser storage */ }
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

const coachLanguageFlags: Record<string, string> = {
  ar: '🇸🇦', bg: '🇧🇬', bn: '🇧🇩', ca: '🏴', cs: '🇨🇿', da: '🇩🇰', de: '🇩🇪', el: '🇬🇷', en: '🇬🇧',
  es: '🇪🇸', et: '🇪🇪', fa: '🇮🇷', fi: '🇫🇮', fr: '🇫🇷', he: '🇮🇱', hi: '🇮🇳', hr: '🇭🇷', hu: '🇭🇺',
  id: '🇮🇩', it: '🇮🇹', ja: '🇯🇵', ko: '🇰🇷', lt: '🇱🇹', lv: '🇱🇻', ms: '🇲🇾', nl: '🇳🇱', no: '🇳🇴',
  pl: '🇵🇱', pt: '🇵🇹', ro: '🇷🇴', ru: '🇷🇺', sk: '🇸🇰', sl: '🇸🇮', sr: '🇷🇸', sv: '🇸🇪', sw: '🇹🇿',
  ta: '🇱🇰', th: '🇹🇭', tr: '🇹🇷', uk: '🇺🇦', ur: '🇵🇰', vi: '🇻🇳', zh: '🇨🇳',
}

const coachAvatarPalette = [
  { background: '#fbe6dc', color: '#97401e' },
  { background: '#e5ecdf', color: '#405b38' },
  { background: '#f0eaf6', color: '#72618d' },
  { background: '#f5ecd5', color: '#806320' },
  { background: '#e7eff1', color: '#55727c' },
]

function coachInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)[0]?.slice(0, 2).toLocaleUpperCase() || '?'
}

function BookingCoach({ name, languages, imageUrl, duration }: { name?: string | null; languages?: string[]; imageUrl?: string | null; duration: number }) {
  const [imageFailed, setImageFailed] = useState(false)
  const firstName = name?.trim().split(/\s+/).filter(Boolean)[0] ?? name
  const codes = [...new Set((languages ?? []).map((code) => code.trim().toLowerCase()).filter(Boolean))]
  if (!name) return <div className="booking-session-duration">{duration} min</div>
  let hash = 0
  for (const character of (firstName ?? name).toLocaleLowerCase()) hash = (hash * 31 + character.charCodeAt(0)) | 0
  const avatar = coachAvatarPalette[Math.abs(hash) % coachAvatarPalette.length]
  return <div className="booking-session-coach">
    {imageUrl && !imageFailed
      ? <img className="booking-session-coach-avatar" src={imageUrl} alt="" aria-hidden="true" onError={() => setImageFailed(true)} />
      : <span className="booking-session-coach-avatar booking-session-coach-initials" style={{ backgroundColor: avatar.background, color: avatar.color }} aria-hidden="true">{coachInitials(name)}</span>}
    <div className="booking-session-coach-copy">
      <div className="booking-session-coach-name">
        <span>{firstName}</span>
        {codes.map((code) => <span key={code} className="booking-session-coach-flag" title={code.toUpperCase()}>{coachLanguageFlags[code] ?? '🌐'}</span>)}
      </div>
      <span className="booking-session-duration">{duration} min</span>
    </div>
  </div>
}

function reservationTerms(
  session: Pick<ClassSession, 'minimumParticipants'>,
  policy: Schedule['location']['cancellationPolicy'],
  t: TFunction<'bookingPortal'>,
) {
  const terms: string[] = []
  const creditPenalty = policy.lateCancelPenaltyCredits
  const latePenalty = [
    creditPenalty > 0 ? t('credit-unit', { count: creditPenalty }) : '',
    policy.lateCancelPenaltyAmount != null && policy.lateCancelPenaltyAmount > 0 ? `${policy.lateCancelPenaltyAmount.toFixed(2)} €` : '',
  ].filter(Boolean).join(t('and'))

  terms.push(latePenalty
    ? t('cancellation-window-with-penalty', { hours: policy.lateCancelWindowHours, penalty: latePenalty })
    : t('free-cancellation-window', { hours: policy.lateCancelWindowHours }))
  if (session.minimumParticipants != null && session.minimumParticipants > 0) {
    terms.push(t('minimum-participants', { count: session.minimumParticipants }))
  }
  return terms
}
function BookingPortalRoute() {
  const { customerSlug = '', locationSlug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [member, setMember] = useState<MemberState | null>(null)
  const [firstNameDraft, setFirstNameDraft] = useState('')
  const [lastNameDraft, setLastNameDraft] = useState('')
  const [memberPhoneDraft, setMemberPhoneDraft] = useState('')
  const [guestFirstName, setGuestFirstName] = useState(() => readGuestDraft(customerSlug, locationSlug).firstName)
  const [guestLastName, setGuestLastName] = useState(() => readGuestDraft(customerSlug, locationSlug).lastName)
  const [guestPhone, setGuestPhone] = useState(() => readGuestDraft(customerSlug, locationSlug).phone)
  const [guestEmail, setGuestEmail] = useState(() => readGuestDraft(customerSlug, locationSlug).email)
  const { t, i18n } = useTranslation('bookingPortal')
  const language: 'fr' | 'en' = (i18n.resolvedLanguage ?? i18n.language ?? 'fr').startsWith('fr') ? 'fr' : 'en'
  const locale = language === 'fr' ? 'fr-FR' : 'en-GB'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<ClassSession | null>(null)
  const [selectedAction, setSelectedAction] = useState<'book' | 'cancel'>('book')
  const [bookingConfirmation, setBookingConfirmation] = useState<{ session: ClassSession; email: string; terms: string[] } | null>(null)
  const [bookingError, setBookingError] = useState('')
  const [egymError, setEgymError] = useState('')
  const [egymCode, setEgymCode] = useState('')
  const [egymEmail, setEgymEmail] = useState('')
  const [egymPanelOpen, setEgymPanelOpen] = useState(false)
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
  const [offersReloadKey, setOffersReloadKey] = useState(0)
  const [offersLoading, setOffersLoading] = useState(false)
  const [offersError, setOffersError] = useState('')
  const [offerCheckoutError, setOfferCheckoutError] = useState('')
  const [offerToPurchase, setOfferToPurchase] = useState<PricingOffer | null>(null)
  const [forcedOfferFlow, setForcedOfferFlow] = useState(false)
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
  const restoredManageBooking = useRef(false)
  const handledPaymentReturn = useRef('')
  const checkoutFirstName = member ? member.identity.firstName?.trim() || firstNameDraft.trim() : guestFirstName.trim()
  const checkoutLastName = member ? member.identity.lastName?.trim() || lastNameDraft.trim() : guestLastName.trim()
  const checkoutPhone = member ? member.identity.phone?.trim() || memberPhoneDraft.trim() : guestPhone.trim()
  const canPurchaseOffer = Boolean(checkoutFirstName && checkoutLastName && checkoutPhone && !validatePhone(checkoutPhone))
    && (Boolean(member) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim()))

  useEffect(() => {
    const draft = readGuestDraft(customerSlug, locationSlug)
    setGuestFirstName(draft.firstName)
    setGuestLastName(draft.lastName)
    setGuestPhone(draft.phone)
    setGuestEmail(draft.email)
  }, [customerSlug, locationSlug])

  const updateGuestDraft = (field: keyof BookingGuestDraft, value: string) => {
    const draft = { firstName: guestFirstName, lastName: guestLastName, phone: guestPhone, email: guestEmail, [field]: value }
    setGuestFirstName(draft.firstName)
    setGuestLastName(draft.lastName)
    setGuestPhone(draft.phone)
    setGuestEmail(draft.email)
    saveGuestDraft(customerSlug, locationSlug, draft)
  }

  const changeLanguage = (nextLanguage: 'fr' | 'en') => {
    void i18n.changeLanguage(nextLanguage)
    try { localStorage.setItem('ayana-booking-language', nextLanguage) } catch { /* language still changes for this visit */ }
  }

  const logout = () => {
    try { localStorage.removeItem(sessionKey(customerSlug, locationSlug)) } catch { /* clear in-memory session even if storage is unavailable */ }
    setMember(null)
    setFirstNameDraft('')
    setLastNameDraft('')
    setMemberPhoneDraft('')
    setSessionFilter('all')
    setNotice('')
  }

  useEffect(() => {
    const url = new URL(window.location.href)
    const params = url.searchParams
    const syncParam = (key: string, value: string, defaultValue?: string) => {
      if (!value || value === defaultValue) params.delete(key)
      else params.set(key, value)
    }

    syncParam('section', activeSection, 'planning')
    syncParam('filter', sessionFilter, 'all')
    syncParam('class', classFilter, 'all')
    syncParam('time', timeFilter, 'all')
    syncParam('date', selectedDate)
    syncParam('layout', sessionLayout, 'list')

    const nextUrl = `${url.pathname}${url.search}${url.hash}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (nextUrl !== currentUrl) window.history.replaceState(window.history.state, '', nextUrl)
  }, [activeSection, sessionFilter, classFilter, timeFilter, selectedDate, sessionLayout])

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
        const scheduleResponse = await fetch(`${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}`, { cache: 'no-store' })
        const schedulePayload = await scheduleResponse.json().catch(() => ({})) as Schedule & { message?: string | string[] }
        if (!scheduleResponse.ok) throw new Error(responseMessage(schedulePayload, t("This schedule could not be found.")))
        if (!active) return
        setSchedule(schedulePayload)
        setSelectedDate((current) => current && schedulePayload.sessions.some((session) => session.localDate === current)
          ? current
          : schedulePayload.sessions[0]?.localDate ?? '')

        if (emailAccessId || emailAccessCode) {
          if (!emailAccessId || !emailAccessCode) {
            if (active) setNotice(t("This sign-in link is incomplete. Request a new one."))
            return
          }
          const accessResponse = await fetch(`${API_URL}/public-access/email/verify`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ verificationId: emailAccessId, code: emailAccessCode }),
          })
          const accessPayload = await accessResponse.json().catch(() => ({})) as { url?: string; message?: string | string[] }
          if (!accessResponse.ok || !accessPayload.url) {
            if (active) setNotice(responseMessage(accessPayload, t("This link has expired. Request a new one.")))
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
          if (active) setNotice(responseMessage(statePayload, t("This link has expired. Open the latest link from your messages.")))
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
          setLastNameDraft(nextMember.identity.lastName ?? '')
          setMemberPhoneDraft(nextMember.identity.phone ?? '')
          setNotice('')
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : (t("Could not load the schedule.")))
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
    if (sessionFilter !== 'booked') return sessions
    return member ? sessions.filter((session) => booked.has(session.id)) : []
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
  const selectedClassBalance = selected && member ? member.classCreditBalances?.[selected.classTypeId] : undefined
  const needsCredits = Boolean(selected && member && selectedAction === 'book' && !selectedClassBalance?.unlimited && (forcedOfferFlow || (selectedClassBalance?.credits ?? 0) < selected.creditCost))
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
      setAccessError(reason instanceof Error ? reason.message : (t("Could not prepare the link.")))
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
      if (!response.ok || !payload.verificationId) throw new Error(responseMessage(payload, t("Could not send the code.")))
      setAccessModal({ ...accessModal, view: 'code', email: accessEmail.trim(), verificationId: payload.verificationId })
    } catch (reason) {
      setAccessError(reason instanceof Error ? reason.message : (t("Could not send the code.")))
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
      if (!response.ok || !payload.url) throw new Error(responseMessage(payload, t("The code is incorrect or expired.")))
      window.location.assign(payload.url)
    } catch (reason) {
      setAccessError(reason instanceof Error ? reason.message : (t("The code is incorrect or expired.")))
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
    ...(searchParams.get('manageBooking') ? { manageBooking: searchParams.get('manageBooking') } : {}),
    ...(resume === 'session' && selected ? { resumeSession: selected.id } : {}),
    ...(resume === 'offer' && offerToPurchase ? { resumeOffer: offerToPurchase.id } : {}),
  })
  const renderAccessButtons = (state: Record<string, unknown>, buttonClass: string) => <div className="booking-access-buttons">
    <button type="button" className={buttonClass} onClick={() => openAccessModal(state)}>{t("Sign in")}<span>→</span></button>
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
    const shouldLoadOffers = activeSection === 'offers' || Boolean(selected && selectedAction === 'book')
    if (!shouldLoadOffers) {
      setOffers([])
      setOffersError('')
      return
    }
    let active = true
    setOffersLoading(true)
    setOffersError('')
    const url = `${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/offers`
    setOffers([])
    void fetch(url, { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', ...(member?.token ? { authorization: `Bearer ${member.token}` } : {}) }, body: JSON.stringify(activeSection === 'offers' ? {} : selected ? { sessionId: selected.id } : {}) })
      .then(async (response) => {
        const payload = await response.json().catch(() => []) as PricingOffer[] & { message?: string | string[] }
        if (!response.ok) throw new Error(responseMessage(payload, t("Could not load available plans.")))
        if (active) setOffers(Array.isArray(payload) ? payload : [])
      })
      .catch((reason) => { if (active) setOffersError(reason instanceof Error ? reason.message : (t("Could not load available plans."))) })
      .finally(() => { if (active) setOffersLoading(false) })
    return () => { active = false }
  }, [customerSlug, locationSlug, member?.token, needsCredits, selected?.id, selectedAction, activeSection, language, offersReloadKey])

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
    setNotice(t("Payment cancelled. You can continue whenever you’re ready."))
    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('payment')
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`)
  }, [searchParams, language])

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
    setNotice((session ? t("Payment complete. Refreshing your credits so you can continue this booking…") : t("Payment complete. Refreshing your credits…")))

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
            const usable = session ? updated.classCreditBalances?.[session.classTypeId] : undefined
            if (!session || usable?.unlimited || (usable?.credits ?? 0) >= session.creditCost) {
              setNotice((session ? t("Your credits are up to date. You can now confirm this booking.") : t("Your credits are up to date. You can view your plans and book a class.")))
              return
            }
          }
        } catch { /* Stripe webhook or network may still be settling; retry below. */ }
        await new Promise((resolve) => window.setTimeout(resolve, 1200))
      }
      if (active) setNotice((session ? t("Payment complete. Your balance is taking a little longer to update; this class is still selected, please try again shortly.") : t("Payment complete. Your balance is taking a little longer to update; please try again shortly.")))
    }
    void refreshCredits()
    return () => { active = false }
  }, [customerSlug, locationSlug, member?.token, schedule, searchParams, language])

  const openBooking = (session: ClassSession) => {
    setOffersReloadKey((value) => value + 1)
    setBookingError('')
    setEgymCode('')
    setEgymEmail(member?.identity.email ?? guestEmail)
    setEgymPanelOpen(false)
    setBookingUpsell(null)
    setForcedOfferFlow(false)
    setSelectedAction('book')
    setCancellationQuote(null)
    setSelected(session)
  }

  const openCancellation = async (session: ClassSession, bookingId: string) => {
    if (!member) return
    setEgymPanelOpen(false)
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
      if (!response.ok) throw new Error(responseMessage(payload, t("Cancellation policy could not be loaded.")))
      setCancellationQuote(payload)
    } catch (reason) {
      setBookingError(reason instanceof Error ? reason.message : (t("Cancellation policy could not be loaded.")))
    } finally { setQuoteLoading(false) }
  }

  useEffect(() => {
    if (!schedule || !member || restoredManageBooking.current) return
    const bookingId = searchParams.get('manageBooking')
    if (!bookingId) return
    const booking = member.bookings.find((item) => item.bookingId === bookingId)
    const session = booking ? schedule.sessions.find((item) => item.id === booking.sessionId) : null
    if (!booking || !session) return
    restoredManageBooking.current = true
    setActiveSection('planning')
    setSessionFilter('booked')
    setSelectedDate(session.localDate)
    void openCancellation(session, booking.bookingId)
    const url = new URL(window.location.href)
    url.searchParams.delete('manageBooking')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }, [schedule, member, searchParams])

  const purchaseOffer = async (pricingOptionId: string) => {
    if (offerPurchaseInFlight.current) return
    const firstName = checkoutFirstName
    const lastName = checkoutLastName
    const phone = checkoutPhone
    if (!firstName || !lastName || !phone || validatePhone(phone)) {
      setOfferCheckoutError(t("Enter your first name, last name and a valid phone number to continue."))
      return
    }
    if (!member && (validatePhone(guestPhone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim()))) {
      setOfferCheckoutError(t("Check your phone number and email address."))
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
          paymentMethod: 'link',
          language,
          firstName,
          lastName,
          phone,
          ...(!member ? { email: guestEmail.trim() } : {}),
        }),
      })
      const payload = await response.json().catch(() => ({})) as { checkoutUrl?: string; message?: string | string[] }
      if (!response.ok) throw new Error(responseMessage(payload, t("Could not prepare checkout.")))
      if (!payload.checkoutUrl) throw new Error(responseMessage(payload, t("Could not prepare online checkout.")))
      if (member && (!member.identity.firstName?.trim() || !member.identity.lastName?.trim() || !member.identity.phone?.trim())) {
        const updated = { ...member, identity: {
          ...member.identity,
          firstName: member.identity.firstName?.trim() || firstName,
          lastName: member.identity.lastName?.trim() || lastName,
          phone: member.identity.phone?.trim() || phone,
        } }
        setMember(updated)
        localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(updated))
      }
      window.location.assign(payload.checkoutUrl)
    } catch (reason) {
      setOfferCheckoutError(reason instanceof Error ? reason.message : (t("Could not prepare checkout.")))
    } finally {
      offerPurchaseInFlight.current = false
      setPurchasingOfferId('')
    }
  }

  const createBooking = async () => {
    if (!selected || !member) return
    if (!member.identity.firstName?.trim() && !firstNameDraft.trim()) {
      setBookingError(t("Enter your first name before booking this class."))
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
      if (!response.ok) throw new Error(responseMessage(payload, t("The booking could not be confirmed.")))
      const nextMember = {
        ...member,
        identity: { ...member.identity, firstName: member.identity.firstName?.trim() || firstNameDraft.trim() },
        creditBalance: payload.creditBalance,
        bookedSessionIds: [...new Set([...member.bookedSessionIds, selected.id])],
        bookings: [...member.bookings.filter((booking) => booking.sessionId !== selected.id), { bookingId: payload.bookingId, sessionId: selected.id, status: payload.status }],
      }
      localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(nextMember))
      setMember(nextMember)
      void fetch(`${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/me`, {
        method: 'POST', headers: { authorization: `Bearer ${member.token}` },
      }).then(async (response) => response.ok ? response.json() : null).then((latest: Partial<MemberState> | null) => {
        if (!latest?.identity) return
        const refreshed = { ...nextMember, ...latest, token: member.token } as MemberState
        setMember(refreshed)
        localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(refreshed))
      }).catch(() => undefined)
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
        ? reservationTerms(selected, schedule.location.cancellationPolicy, t)
        : []
      const confirmationMessage = payload.status === 'WAITLISTED'
        ? (t("You are on the waitlist. A confirmation was sent to your linked channels."))
        : (t("Booking confirmed. A confirmation was sent to your linked channels."))
      setNotice(hasBookingUpsell
        ? ''
        : [confirmationMessage, ...terms.map((term) => `• ${term}`)].join('\n'))
      setBookingUpsell(hasBookingUpsell
        ? { className: selected.name, products }
        : null)
      if (!hasBookingUpsell) setSelected(null)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : (t("Booking failed. Please try again."))
      setBookingError(message)
      if (/credit|crédit|balance/i.test(message)) setForcedOfferFlow(true)
    } finally { setSubmitting(false) }
  }

  const confirmEgymBooking = async () => {
    if (!selected || selectedAction !== 'book' || !selected.egymAvailable || selected.isWaitlist || submitting) return
    const email = member?.identity.email?.trim() || (member ? egymEmail.trim() : guestEmail.trim())
    if (!egymCode.trim()) {
      setEgymError(t("Enter your Wellpass code."))
      return
    }
    if (!email) {
      setEgymError(t("Enter the email address for your Wellpass account."))
      return
    }
    if (!member && (!guestFirstName.trim() || !guestLastName.trim())) {
      setEgymError(t("Enter your first and last name."))
      return
    }
    if (member && !member.identity.firstName?.trim() && !firstNameDraft.trim()) {
      setEgymError(t("Enter your first name before booking this class."))
      return
    }

    const payload = {
      sessionId: selected.id,
      code: egymCode.trim(),
      email,
      language,
      ...(member
        ? (!member.identity.firstName?.trim() ? { firstName: firstNameDraft.trim() } : {})
        : { firstName: guestFirstName.trim(), lastName: guestLastName.trim() }),
    }
    const endpoint = `${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/bookings/egym`
    setSubmitting(true)
    setEgymError('')
    try {
      let authorizationToken = member?.token
      let authenticatedByValidation = false
      const headers = () => ({ 'content-type': 'application/json', ...(authorizationToken ? { authorization: `Bearer ${authorizationToken}` } : {}) })
      const validateResponse = await fetch(`${endpoint}/validate`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) })
      const validatePayload = await validateResponse.json().catch(() => ({})) as EgymValidationResult
      if (!validateResponse.ok) throw new Error(responseMessage(validatePayload, t("Could not verify the Wellpass code.")))

      if (validatePayload.sessionToken && validatePayload.member) {
        authorizationToken = validatePayload.sessionToken
        authenticatedByValidation = true
        const nextMember = {
          ...validatePayload.member,
          token: authorizationToken,
          hasUnlimitedContract: validatePayload.member.hasUnlimitedContract === true,
          bookedSessionIds: validatePayload.member.bookedSessionIds ?? [],
          bookings: validatePayload.member.bookings ?? [],
        } as MemberState
        setMember(nextMember)
        setFirstNameDraft(nextMember.identity.firstName ?? '')
        setLastNameDraft(nextMember.identity.lastName ?? '')
        setMemberPhoneDraft(nextMember.identity.phone ?? '')
        localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(nextMember))
      }

      const response = await fetch(`${endpoint}/confirm`, { method: 'POST', headers: headers(), body: JSON.stringify(payload) })
      const result = await response.json().catch(() => ({})) as EgymBookingResult & { message?: string | string[] }
      if (!response.ok) throw new Error(responseMessage(result, t("The Wellpass booking could not be confirmed.")))

      const sessionToken = result.sessionToken || authorizationToken || member?.token
      if (sessionToken) {
        const memberResponse = await fetch(`${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}/me`, {
          method: 'POST',
          headers: { authorization: `Bearer ${sessionToken}` },
        })
        const memberPayload = await memberResponse.json().catch(() => ({})) as EgymMemberPayload
        if (memberResponse.ok && memberPayload.identity && typeof memberPayload.creditBalance === 'number') {
          const nextMember = {
            ...memberPayload,
            token: sessionToken,
            hasUnlimitedContract: memberPayload.hasUnlimitedContract === true,
            bookedSessionIds: memberPayload.bookedSessionIds ?? [],
            bookings: memberPayload.bookings ?? [],
          } as MemberState
          setMember(nextMember)
          setFirstNameDraft(nextMember.identity.firstName ?? '')
          setLastNameDraft(nextMember.identity.lastName ?? '')
          setMemberPhoneDraft(nextMember.identity.phone ?? '')
          localStorage.setItem(sessionKey(customerSlug, locationSlug), JSON.stringify(nextMember))
        }
      }

      if (!member && !authenticatedByValidation && sessionToken) {
        saveGuestDraft(customerSlug, locationSlug, { firstName: guestFirstName, lastName: guestLastName, phone: guestPhone, email })
      }
      setSchedule((current) => current ? {
        ...current,
        sessions: current.sessions.map((session) => session.id === selected.id ? {
          ...session,
          bookedCount: Math.min(session.capacity, session.bookedCount + 1),
          availableSpots: Math.max(0, session.availableSpots - 1),
          isWaitlist: session.bookedCount + 1 >= session.capacity,
        } : session),
      } : current)
      const terms = schedule ? reservationTerms(selected, schedule.location.cancellationPolicy, t) : []
      setNotice('')
      setBookingConfirmation({ session: selected, email, terms })
      setSelected(null)
      setEgymPanelOpen(false)
      setEgymCode('')
    } catch (reason) {
      setEgymError(reason instanceof Error ? reason.message : (t("The Wellpass booking could not be confirmed.")))
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
      if (!response.ok) throw new Error(responseMessage(payload, t("Cancellation failed.")))
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
      setNotice(t("Booking cancelled. The credit policy has been applied."))
      setSelected(null)
      setCancellationQuote(null)
    } catch (reason) {
      setBookingError(reason instanceof Error ? reason.message : (t("Cancellation failed.")))
    } finally { setSubmitting(false) }
  }

  const formatDate = (date: string) => {
    const [year, month, day] = date.split('-').map(Number)
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: schedule?.location.timezone ?? 'Europe/Paris',
    }).format(new Date(Date.UTC(year, month - 1, day, 12)))
  }

  const formatDateParts = (date: string) => {
    const [year, month, day] = date.split('-').map(Number)
    const value = new Date(Date.UTC(year, month - 1, day, 12))
    return {
      weekday: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: schedule?.location.timezone ?? 'Europe/Paris' }).format(value).replace('.', ''),
      day: new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', timeZone: schedule?.location.timezone ?? 'Europe/Paris' }).format(value).replace('.', ''),
    }
  }

  const renderPricingOffer = (offer: PricingOffer, standalone = false) => {
    const price = new Intl.NumberFormat(locale, { style: 'currency', currency: offer.currency || 'EUR' }).format(offer.price)
    const originalPrice = offer.originalPrice == null ? null : new Intl.NumberFormat(locale, { style: 'currency', currency: offer.currency || 'EUR' }).format(offer.originalPrice)
    const creditsLabel = offer.creditsTotal != null
      ? `${offer.creditsTotal} ${t("total credits")}`
      : offer.creditsPerPeriod != null
        ? `${offer.creditsPerPeriod} ${t("credits")} / ${t((offer.creditsRefreshInterval ?? 'MONTHLY').toLowerCase())}`
        : (t("Unlimited access"))
    const billingLabel = offer.billingInterval && offer.billingInterval !== 'ONCE'
      ? `${t("Billed")} ${offer.billingInterval.toLowerCase()}`
      : (t("One-time payment"))
    return <article className={`booking-offer${standalone ? ' booking-offer-standalone' : ''}`} key={offer.id}>
      <div><strong>{offer.name}</strong><b><span>{price}</span>{originalPrice ? <><del>{originalPrice}</del><small className="booking-partnership-discount">−{offer.discountPercent}% {offer.partnershipName}</small></> : null}</b></div>
      {offer.description && <p>{offer.description}</p>}
      <small>{creditsLabel}{offer.validityDays ? ` · ${offer.validityDays} ${t("days validity")}` : ''} · {billingLabel}{offer.minimumCommitmentMonths ? ` · ${offer.minimumCommitmentMonths} ${t("months minimum commitment")}` : ''}</small>
      {!!offer.perks?.length && <small>{offer.perks.join(' · ')}</small>}
      <button type="button" className="booking-offer-buy" onClick={() => { setOfferToPurchase(offer); setOfferCheckoutError('') }}>{t("Buy")}<span>→</span></button>
    </article>
  }

  const refreshPlanning = async () => {
    setSchedule(null)
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/public-booking/${encodeURIComponent(customerSlug)}/${encodeURIComponent(locationSlug)}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({})) as Schedule & { message?: string | string[] }
      if (!response.ok) throw new Error(responseMessage(payload, t("Could not load the schedule.")))
      setSchedule(payload)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Could not load the schedule."))
    } finally {
      setLoading(false)
    }
  }

  return <main className="ayana-booking">
    <header className="booking-topbar"><img src={ayanaLogo} alt="Ayana Feelness Club" /><span>{t("SCHEDULE & BOOKING")}</span><div className="booking-language" role="group" aria-label={t("Language")}><button type="button" aria-pressed={language === 'fr'} className={language === 'fr' ? 'active' : ''} onClick={() => changeLanguage('fr')}>FR</button><button type="button" aria-pressed={language === 'en'} className={language === 'en' ? 'active' : ''} onClick={() => changeLanguage('en')}>EN</button></div></header>
    {loading ? <div className="booking-loading"><span className="booking-spinner" />{t("Loading schedule…")}</div> : error ? <section className="booking-empty"><p className="booking-eyebrow">AYANA FEELNESS CLUB</p><h1>{t("Schedule unavailable")}</h1><p>{error}</p></section> : <>
      <section className="booking-hero">
        <p className="booking-eyebrow">{schedule?.location.name}</p>
        <h1>{activeSection === 'offers' ? (t("Our plans")) : (t("Class schedule"))}<br /><em>{schedule?.location.name}</em></h1>
        <p>{activeSection === 'offers'
          ? (t("Choose a pack or membership to book classes."))
          : (t("Choose your class and book in just a few taps."))}</p>
        <div className="booking-hero-pillars" aria-label={t("The Ayana experience")}>
          <div><span aria-hidden="true">♧</span><p>Reformer<br />Pilates</p></div>
          <div><span aria-hidden="true">☕</span><p>Coffee<br />Matcha</p></div>
          <div><span aria-hidden="true">✧</span><p>Wellness<br />Lifestyle</p></div>
        </div>
      </section>

      {member
        ? <section className="booking-member">
          <div className="booking-member-identity"><span className="booking-avatar">{(member.identity.firstName?.[0] ?? member.identity.lastName?.[0] ?? 'A').toUpperCase()}</span><div><span>{t("Signed in")}</span><strong>{[member.identity.firstName, member.identity.lastName].filter(Boolean).join(' ')}</strong></div></div>
          <div className="booking-member-actions"><div className="booking-balance"><b>{member.hasUnlimitedContract ? '∞' : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(member.creditBalance)}</b><span>{member.hasUnlimitedContract ? (t("unlimited")) : (t("credits"))}</span></div><button type="button" className="booking-member-plans" onClick={() => { setActiveSection('offers'); setOffersReloadKey((value) => value + 1) }}><span aria-hidden="true">▤</span>{t("Packs & memberships")}<b>→</b></button><button type="button" className="booking-logout" onClick={logout} aria-label={t("Log out")} title={t("Log out")}>↪</button></div>
        </section>
        : activeSection !== 'offers' && sessionFilter !== 'booked' && <section className="booking-login-card"><div><strong>{t("Sign in to your Ayana account")}</strong><span>{t("Return to the schedule with your bookings and credits.")}</span></div><div>{renderAccessButtons(accessState(), 'booking-whatsapp-cta')}{accessError && <p className="booking-error" role="alert">{accessError}</p>}</div></section>}
      {notice && <div className="booking-notice" role="status">{notice}</div>}

      <nav className="booking-section-tabs" role="tablist" aria-label={t("Schedule and plans")}>
      <button type="button" role="tab" aria-selected={activeSection === 'planning'} className={activeSection === 'planning' ? 'active' : ''} onClick={() => { setActiveSection('planning'); setOffersReloadKey((value) => value + 1); void refreshPlanning() }}><span aria-hidden="true">▣</span>{t("Schedule")}</button>
      <button type="button" role="tab" aria-selected={activeSection === 'offers'} className={activeSection === 'offers' ? 'active' : ''} onClick={() => { setActiveSection('offers'); setOffersReloadKey((value) => value + 1) }}><span aria-hidden="true">◇</span>{t("Packs & memberships")}</button>
      </nav>

      {activeSection === 'planning' && <>
        <section className="booking-calendar-controls" aria-label={t("Choose a date and filter classes")}>
          <div className="booking-date-carousel">
            <button type="button" className="booking-date-arrow" aria-label={t("Previous days")} disabled={!selectedDateIndex || selectedDateIndex < 0} onClick={() => moveSelectedDate(-1)}>‹</button>
            <div className="booking-date-strip">
              {dateWindow.map((date) => {
                const parts = formatDateParts(date)
                return <button type="button" key={date} className={`booking-date-option${date === selectedDate ? ' active' : ''}`} aria-pressed={date === selectedDate} onClick={() => setSelectedDate(date)}>
                  <span>{parts.weekday}</span><strong>{parts.day}</strong>
                </button>
              })}
            </div>
            <button type="button" className="booking-date-arrow" aria-label={t("Next days")} disabled={selectedDateIndex < 0 || selectedDateIndex >= sessionDates.length - 1} onClick={() => moveSelectedDate(1)}>›</button>
          </div>

          <div className="booking-filterbar">
            <label className="booking-filter-select booking-filter-bookings"><span aria-hidden="true">☷</span><select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value as 'all' | 'booked')} aria-label={t("Show classes or my bookings")}>
              <option value="all">{t("All classes")}</option>
              <option value="booked">{t("My classes")}</option>
            </select><span className="booking-select-chevron">⌄</span></label>
            <label className="booking-filter-select"><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} aria-label={t("Class type")}>
              <option value="all">{t("All class types")}</option>
              {classNames.map((name) => <option value={name} key={name}>{name}</option>)}
            </select><span className="booking-select-chevron">⌄</span></label>
            <label className="booking-filter-select"><select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as typeof timeFilter)} aria-label={t("Time of day")}>
              <option value="all">{t("All times")}</option>
              <option value="morning">{t("Morning")}</option>
              <option value="midday">{t("Midday / afternoon")}</option>
              <option value="evening">{t("Evening")}</option>
            </select><span className="booking-select-chevron">⌄</span></label>
            <div className="booking-layout-switch" role="group" aria-label={t("Class layout")}>
              <button type="button" className={sessionLayout === 'grid' ? 'active' : ''} aria-label={t("Grid view")} aria-pressed={sessionLayout === 'grid'} onClick={() => setSessionLayout('grid')}>▦</button>
              <button type="button" className={sessionLayout === 'list' ? 'active' : ''} aria-label={t("List view")} aria-pressed={sessionLayout === 'list'} onClick={() => setSessionLayout('list')}>☷</button>
            </div>
          </div>
        </section>

        <div className="booking-day-heading"><h2>{selectedDate ? formatDate(selectedDate) : (t("Upcoming classes"))}</h2><span>{selectedDateSessions.length} {t("classes available")}</span></div>
        {selectedDateSessions.length === 0 ? <section className="booking-empty booking-day-empty">
          {!member && sessionFilter === 'booked' ? <>
            <h2>{t("Sign in to see your classes")}</h2>
            <p>{t("Find your bookings here and manage them directly from the schedule.")}</p>
            {renderAccessButtons(accessState(), 'booking-empty-action')}
          </> : <>
            <h2>{sessionFilter === 'booked' ? (t("No bookings on this day")) : (t("No classes available on this day"))}</h2>
            <p>{t("Choose another day or change the filters.")}</p>
            {sessionFilter === 'booked' && <button type="button" className="booking-empty-action" onClick={() => setSessionFilter('all')}>{t("View all classes")}</button>}
          </>}
        </section> : <div className={`booking-session-list booking-session-list-${sessionLayout}`}>
          {selectedDateSessions.map((session) => {
            const alreadyBooked = booked.has(session.id)
            const booking = member?.bookings.find((item) => item.sessionId === session.id)
            const availabilityLabel = alreadyBooked
              ? (t("Booked"))
              : session.isWaitlist || session.availableSpots <= 0
                ? (t("Full"))
                : session.availableSpots <= 3
                  ? (t("{{value0}} {{value1}}", { value0: session.availableSpots, value1: (session.availableSpots === 1 ? t("spot left") : t("spots left")) }))
                  : null
            return <article className="booking-session" key={session.id}>
              <div className="booking-session-time"><strong>{session.localStartTime}</strong><span>{session.localEndTime}</span></div>
              <div className="booking-session-copy">
                <div className="booking-session-title"><h3>{session.name}</h3>{session.category && <span>{session.category}</span>}</div>
                <BookingCoach name={session.coachName} languages={session.coachLanguages} imageUrl={session.coachImageUrl} duration={session.duration} />
                {session.description && <details className="booking-session-terms">
                  <summary>Description</summary>
                  <p className="booking-session-description">{session.description}</p>
                </details>}
                {session.conditions && <details className="booking-session-terms">
                  <summary>Conditions</summary>
                  <p className="booking-conditions"><span aria-hidden="true">♧</span>{session.conditions}</p>
                </details>}
                {schedule?.location.cancellationPolicy && <details className="booking-session-terms">
                  <summary>{t("Cancellation conditions")}</summary>
                  <ul>{reservationTerms(session, schedule.location.cancellationPolicy, t).map((term) => <li key={term}>{term}</li>)}</ul>
                </details>}
              </div>
              <div className="booking-session-actions">
                {availabilityLabel && <span className={`booking-spots${!alreadyBooked && (session.isWaitlist || session.availableSpots <= 0) ? ' booking-spots-full' : !alreadyBooked ? ' booking-spots-low' : ''}`}>{alreadyBooked ? '✓ ' : (session.isWaitlist || session.availableSpots <= 0) ? '• ' : '♙ '}{availabilityLabel}</span>}
                <button type="button" className={`booking-session-action${alreadyBooked ? ' booking-manage-action' : ''}`} onClick={() => alreadyBooked && booking ? void openCancellation(session, booking.bookingId) : openBooking(session)}>{alreadyBooked ? (t("Manage / cancel")) : session.isWaitlist || session.availableSpots <= 0 ? (t("Join waitlist")) : (t("Book"))}<span>→</span></button>
                <small>{session.creditCost} {t("credit")}{session.creditCost === 1 ? '' : 's'}</small>
              </div>
            </article>
          })}
        </div>}
      </>}

      {activeSection === 'offers' && <section className="booking-plans">
        <header className="booking-plans-heading">
          <p className="booking-eyebrow">{t("STUDIO PLANS")}</p>
          <h2>{t("Packs & memberships")}</h2>
          <p>{t("Choose a plan for classes at this studio. Your credits will be added to your Ayana account.")}</p>
        </header>
        {offersLoading && <div className="booking-loading booking-plans-loading"><span className="booking-spinner" />{t("Loading plans…")}</div>}
        {!offersLoading && offers.length === 0 && !offersError && <div className="booking-empty booking-plans-empty"><h2>{t("No plans available")}</h2><p>{t("Plans available to purchase will appear here.")}</p></div>}
        {offersError && <div className="booking-error" role="alert">{offersError}</div>}
        {offers.length > 0 && <div className="booking-plans-list">{offers.map((offer) => renderPricingOffer(offer, true))}</div>}
      </section>}
      <footer className="booking-footer">{t("AYANA FEELNESS CLUB · ONLINE BOOKING")}</footer>
    </>}

    {offerToPurchase && !accessModal && <div className="booking-overlay booking-flow-overlay" role="presentation" onClick={() => !purchasingOfferId && setOfferToPurchase(null)}><section className="booking-sheet booking-flow-panel booking-purchase-sheet" role="dialog" aria-modal="true" aria-labelledby="booking-purchase-title" onClick={(event) => event.stopPropagation()}>
      <div className="booking-flow-nav"><button type="button" disabled={Boolean(purchasingOfferId)} onClick={() => setOfferToPurchase(null)}><span aria-hidden="true">←</span>{t("Back")}</button><button type="button" aria-label={t("Close")} disabled={Boolean(purchasingOfferId)} onClick={() => setOfferToPurchase(null)}>×</button></div>
      <button type="button" className="booking-close" aria-label={t("Close")} disabled={Boolean(purchasingOfferId)} onClick={() => setOfferToPurchase(null)}>×</button>
      <p className="booking-eyebrow">{t("YOUR ORDER")}</p>
      <h2 id="booking-purchase-title">{t("Plan payment")}</h2>
      <div className="booking-recap booking-purchase-summary">
        <strong>{new Intl.NumberFormat(locale, { style: 'currency', currency: offerToPurchase.currency || 'EUR' }).format(offerToPurchase.price)}</strong>
        <b>{offerToPurchase.name}</b>
        {offerToPurchase.description && <span>{offerToPurchase.description}</span>}
        <span>{offerToPurchase.billingInterval && offerToPurchase.billingInterval !== 'ONCE' ? (t("Membership · billed {{value0}}", { value0: offerToPurchase.billingInterval.toLowerCase() })) : (t("One-time payment"))}{offerToPurchase.minimumCommitmentMonths ? ` · ${offerToPurchase.minimumCommitmentMonths} ${t("months minimum commitment")}` : ''}</span>
      </div>
      {!member ? <>
        <p className="booking-purchase-explanation">{t("Sign in to your Ayana account, or continue as a guest with your contact details.")}</p>
        {renderAccessButtons(accessState('offer'), 'booking-purchase-whatsapp')}
        {accessError && <div className="booking-error" role="alert">{accessError}</div>}
        <p className="booking-purchase-divider"><span>{t("or continue as a guest")}</span></p>
      </> : <div className="booking-purchase-account"><span>{t("Ayana account connected")}</span><strong>{[member.identity.firstName, member.identity.lastName].filter(Boolean).join(' ') || member.identity.email}</strong></div>}
      {(!member || !member.identity.firstName?.trim()) && <label className="booking-first-name booking-purchase-field">{t("First name")}<input autoComplete="given-name" required maxLength={80} value={member ? firstNameDraft : guestFirstName} onChange={(event) => member ? setFirstNameDraft(event.target.value) : updateGuestDraft('firstName', event.target.value)} placeholder={t("First name")} /></label>}
      {(!member || !member.identity.lastName?.trim()) && <label className="booking-first-name booking-purchase-field">{t("Last name")}<input autoComplete="family-name" required maxLength={80} value={member ? lastNameDraft : guestLastName} onChange={(event) => member ? setLastNameDraft(event.target.value) : updateGuestDraft('lastName', event.target.value)} placeholder={t("Last name")} /></label>}
      {(!member || !member.identity.phone?.trim()) && <PhoneInput label={t("Phone number")} value={member ? memberPhoneDraft : guestPhone} placeholder={t("Phone number__numero-de-telephone")} required nativeCountrySelector onValueChange={(value) => member ? setMemberPhoneDraft(value) : updateGuestDraft('phone', value)} />}
      {!member && <label className="booking-first-name booking-purchase-field">{t("Email")}<input type="email" autoComplete="email" required maxLength={254} value={guestEmail} onChange={(event) => updateGuestDraft('email', event.target.value)} placeholder={t("name@example.com")} /></label>}
      {offerCheckoutError && <div className="booking-error" role="alert">{offerCheckoutError}</div>}
      <div className="booking-purchase-actions">
        <button type="button" className="booking-purchase-online" disabled={Boolean(purchasingOfferId) || !canPurchaseOffer} onClick={() => void purchaseOffer(offerToPurchase.id)}>
          {purchasingOfferId === offerToPurchase.id ? (t("Preparing payment…")) : (t("Pay online by card"))}<span>→</span>
        </button>
      </div>
    </section></div>}

    {selected && !offerToPurchase && !accessModal && <div className="booking-overlay booking-flow-overlay" role="presentation" onClick={() => !submitting && setSelected(null)}><section className="booking-sheet booking-flow-panel" role="dialog" aria-modal="true" aria-labelledby="booking-confirm-title" onClick={(event) => event.stopPropagation()}>
      <div className="booking-flow-nav"><button type="button" disabled={submitting} onClick={() => setSelected(null)}><span aria-hidden="true">←</span>{t("Back to schedule")}</button><button type="button" aria-label={t("Close")} disabled={submitting} onClick={() => setSelected(null)}>×</button></div>
      <button type="button" className="booking-close" aria-label={t("Close")} disabled={submitting} onClick={() => setSelected(null)}>×</button>
      <p className="booking-eyebrow">{bookingUpsell ? (t("BOOKING CONFIRMED")) : selectedAction === 'cancel' ? (t("CANCELLATION POLICY")) : (t("BOOKING SUMMARY"))}</p>
      <h2 id="booking-confirm-title">{bookingUpsell ? (t("You’re booked!")) : selectedAction === 'cancel' ? (t("Cancel this booking?")) : (t("Confirm this class?"))}</h2>
      <div className="booking-recap"><strong>{selected.name}</strong><span>{formatDate(selected.localDate)} · {selected.localStartTime}–{selected.localEndTime}</span><span>{schedule?.location.name}</span>{selectedAction === 'book' && <span>{selected.creditCost} {t("credit(s)")}</span>}{selected.description && <p className="booking-recap-description">{selected.description}</p>}{selected.conditions && <p>{selected.conditions}</p>}{selectedAction === 'book' && schedule?.location.cancellationPolicy && <ul className="booking-recap-terms">{reservationTerms(selected, schedule.location.cancellationPolicy, t).map((term) => <li key={term}>{term}</li>)}</ul>}</div>
      {member && selectedAction === 'book' && !member.identity.firstName?.trim() && <label className="booking-first-name">{t("Your first name")}<input autoComplete="given-name" maxLength={80} value={firstNameDraft} onChange={(event) => setFirstNameDraft(event.target.value)} placeholder={t("First name")} /></label>}
      {bookingUpsell ? <>
        <p className="booking-upsell-confirmation">{t("Your confirmation was sent to your linked channels. You can bring these items for class or buy them from the studio shop.")}</p>
        {schedule?.location.cancellationPolicy && <ul className="booking-recap-terms booking-upsell-terms">{reservationTerms(selected, schedule.location.cancellationPolicy, t).map((term) => <li key={term}>{term}</li>)}</ul>}
        <section className="booking-class-products" aria-label={t("Products for this class")}>
          <div className="booking-class-products-heading">
            <p className="booking-eyebrow">{t("FOR YOUR CLASS")}</p>
            <h2>{t("For {{value0}}", { value0: bookingUpsell.className })}</h2>
          </div>
          <div className="booking-class-products-list">
            {bookingUpsell.products.map((product) => {
              const lowestPrice = Math.min(...product.variants.map((variant) => variant.price))
              return <article className="booking-class-product" key={product.id}>
                <div className="booking-class-product-copy">
                  <span className={`booking-class-product-kind ${product.kind === 'REQUIRED' ? 'required' : ''}`}>
                    {product.kind === 'REQUIRED' ? (t("Required")) : (t("Recommended"))}
                  </span>
                  <strong>{product.name}</strong>
                  {product.description && <p>{product.description}</p>}
                  {product.variants.length > 1 && <small>{t("Multiple options available")}</small>}
                </div>
                <div className="booking-class-product-action">
                  <b>{t("From ")}{new Intl.NumberFormat(locale, { style: 'currency', currency: product.currency || 'EUR' }).format(lowestPrice)}</b>
                  <a href={product.orderUrl} target="_blank" rel="noreferrer">{t("View in shop")}<span>↗</span></a>
                </div>
              </article>
            })}
          </div>
        </section>
      </> : !member ? <div className="booking-auth-hint"><p>{t("Sign in to book this class.")}</p>{renderAccessButtons(accessState('session'), 'booking-whatsapp-cta')}{accessError && <div className="booking-error" role="alert">{accessError}</div>}</div>
        : selectedAction === 'cancel' ? <div className="booking-cancellation-policy">
          {quoteLoading ? <p>{t("Checking cancellation policy…")}</p> : cancellationQuote ? <>
            {cancellationQuote.isLate
              ? <p className="booking-policy-warning">{t("This cancellation is within the {{value0}}-hour late cancellation window.", { value0: cancellationQuote.lateCancelWindowHours })}</p>
              : <p>{t("This cancellation is outside the penalty window.")}</p>}
            {cancellationQuote.creditsToReturn > 0 && <p>{t("{{value0}} credit(s) will be returned.", { value0: cancellationQuote.creditsToReturn })}</p>}
            {cancellationQuote.bookingCreditsRetained > 0 && <p>{t("{{value0}} booking credit(s) will be retained as a penalty.", { value0: cancellationQuote.bookingCreditsRetained })}</p>}
            {cancellationQuote.extraPenaltyCredits > 0 && <p>{t("{{value0}} additional credit(s) will be deducted.", { value0: cancellationQuote.extraPenaltyCredits })}</p>}
            {cancellationQuote.penaltyAmount > 0 && <p>{t("A {{value0}} {{value1}} fee applies. Contact the studio to cancel.", { value0: cancellationQuote.penaltyAmount.toFixed(2), value1: cancellationQuote.currency })}</p>}
            {cancellationQuote.canCancel && <p className="booking-confirm-hint">{t("Confirm only if you really want to cancel this class.")}</p>}
          </> : null}
        </div>
        : needsCredits ? <div className="booking-offers">
          <div className="booking-no-credit"><strong>{t("Not enough credits")}</strong><span>{t("This class requires {{value0}} credit(s). Your balance is {{value1}}. Here are the plans available to buy.", { value0: selected.creditCost, value1: selectedClassBalance?.credits ?? 0 })}</span></div>
          {offersLoading && <p className="booking-confirm-hint">{t("Loading plans…")}</p>}
          {!offersLoading && offers.length === 0 && !offersError && <p className="booking-confirm-hint">{t("No plans are currently available to buy for this studio.")}</p>}
          {offers.map((offer) => renderPricingOffer(offer))}
          {offersError && <div className="booking-error" role="alert">{offersError}</div>}
        </div>
        : <p className="booking-confirm-hint">{t("Your booking will be confirmed after you submit.")}</p>}
      {!bookingUpsell && selectedAction === 'book' && selected.egymAvailable && !selected.isWaitlist && <section className="booking-egym-section">
        <button type="button" className="booking-egym-action" aria-expanded={egymPanelOpen} onClick={() => {
          setEgymPanelOpen((open) => !open)
          setEgymEmail(member?.identity.email ?? guestEmail)
          setBookingError('')
          setEgymError('')
        }}>{egymPanelOpen ? (t("Close Wellpass")) : (t("Reserve with Wellpass"))}<span>{egymPanelOpen ? '−' : '→'}</span></button>
        {egymPanelOpen && <div className="booking-egym-fields">
          <label className="booking-first-name"><span>{t("Wellpass code")}</span><input autoComplete="off" required value={egymCode} onChange={(event) => setEgymCode(event.target.value)} placeholder={t("Enter your code")} /></label>
          {!member && <>
            <label className="booking-first-name"><span>{t("First name")}</span><input autoComplete="given-name" required maxLength={80} value={guestFirstName} onChange={(event) => updateGuestDraft('firstName', event.target.value)} /></label>
            <label className="booking-first-name"><span>{t("Last name")}</span><input autoComplete="family-name" required maxLength={80} value={guestLastName} onChange={(event) => updateGuestDraft('lastName', event.target.value)} /></label>
          </>}
          {(!member || !member.identity.email?.trim()) && <label className="booking-first-name"><span>{t("Email")}</span><input type="email" autoComplete="email" required maxLength={254} value={member ? egymEmail : guestEmail} onChange={(event) => member ? setEgymEmail(event.target.value) : updateGuestDraft('email', event.target.value)} placeholder={t("name@example.com")} /></label>}
          {egymError && <div className="booking-error" role="alert">{egymError}</div>}
          <button type="button" className="booking-egym-submit" disabled={submitting} onClick={() => void confirmEgymBooking()}>{submitting ? (t("Checking…")) : (t("Confirm with Wellpass"))}<span>→</span></button>
        </div>}
      </section>}
      {bookingError && <div className="booking-error" role="alert">{bookingError}</div>}
      <div className={`booking-sheet-actions${bookingUpsell ? ' booking-sheet-actions-done' : ''}`}>{bookingUpsell ? <button type="button" className="booking-confirm" onClick={() => { setBookingUpsell(null); setSelected(null) }}>{t("Done")}</button> : <><button type="button" className="booking-cancel" disabled={submitting} onClick={() => setSelected(null)}>{selectedAction === 'cancel' ? (t("Keep booking")) : (t("Close"))}</button>{member && selectedAction === 'cancel' && cancellationQuote?.canCancel && <button type="button" className="booking-confirm booking-danger" disabled={submitting || quoteLoading} onClick={() => void cancelBooking()}>{submitting ? (t("Cancelling…")) : (t("Confirm cancellation"))}</button>}{member && selectedAction === 'book' && <button type="button" className="booking-confirm" disabled={submitting || needsCredits || (!member.identity.firstName?.trim() && !firstNameDraft.trim())} onClick={() => void createBooking()}>{submitting ? (t("Booking…")) : (t("Confirm booking"))}</button>}</>}</div>
    </section></div>}

    {bookingConfirmation && <div className="booking-overlay booking-flow-overlay" role="presentation" onClick={() => setBookingConfirmation(null)}><section className="booking-sheet booking-flow-panel booking-success-sheet" role="dialog" aria-modal="true" aria-labelledby="booking-success-title" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="booking-close" aria-label={t("Close")} onClick={() => setBookingConfirmation(null)}>×</button>
      <p className="booking-eyebrow">{schedule?.location.name ?? 'AYANA'}</p>
      <span className="booking-success-mark" aria-hidden="true">✓</span>
      <h2 id="booking-success-title">{t("Your booking is confirmed!")}</h2>
      <div className="booking-success-summary">
        <strong>{bookingConfirmation.session.name}</strong>
        <span>{new Date(`${bookingConfirmation.session.localDate}T${bookingConfirmation.session.localStartTime}:00`).toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
        <span>{schedule?.location.name}</span>
        {bookingConfirmation.session.conditions && <p>{bookingConfirmation.session.conditions}</p>}
      </div>
      <p className="booking-success-email">{t("A confirmation email was sent to {{value0}}.", { value0: bookingConfirmation.email })}</p>
      {bookingConfirmation.terms.length > 0 && <ul className="booking-success-terms">{bookingConfirmation.terms.map((term) => <li key={term}>{term}</li>)}</ul>}
      <button type="button" className="booking-confirm booking-success-done" onClick={() => setBookingConfirmation(null)}>{t("Back to schedule")}</button>
    </section></div>}

    {accessModal && <div className="booking-overlay booking-flow-overlay" role="presentation" onClick={() => !emailAccessLoading && setAccessModal(null)}><section className="booking-sheet booking-flow-panel booking-access-sheet" role="dialog" aria-modal="true" aria-labelledby="booking-access-title" onClick={(event) => event.stopPropagation()}>
      <div className="booking-flow-nav"><button type="button" disabled={emailAccessLoading} onClick={backInAccessFlow}><span aria-hidden="true">←</span>{accessModal.view === 'choose' ? (t("Back")) : (t("Previous"))}</button><button type="button" aria-label={t("Close")} disabled={emailAccessLoading} onClick={() => setAccessModal(null)}>×</button></div>
      <button type="button" className="booking-close" aria-label={t("Close")} disabled={emailAccessLoading} onClick={() => setAccessModal(null)}>×</button>
      <p className="booking-eyebrow">AYANA</p>
      <h2 id="booking-access-title">{accessModal.view === 'choose' ? (t("Sign in to your Ayana account")) : accessModal.view === 'email' ? (t("Sign in with email")) : (t("Check your email"))}</h2>
      {accessModal.view === 'choose' ? <div className="booking-access-methods">
        <button type="button" className="booking-access-method booking-access-email" onClick={() => { setAccessError(''); setAccessModal({ ...accessModal, view: 'email' }) }}>{t("Continue with email")}<span>→</span></button>
        {schedule?.location.whatsappNumber && <button type="button" className="booking-access-method booking-access-whatsapp" disabled={Boolean(accessLoading)} onClick={() => void openAccessLink('WHATSAPP', accessModal.state)}>{accessLoading === 'WHATSAPP' ? (t("Preparing…")) : (t("Continue with WhatsApp"))}<span>↗</span></button>}
        {schedule?.location.telegramBotUsername && <button type="button" className="booking-access-method booking-access-telegram" disabled={Boolean(accessLoading)} onClick={() => void openAccessLink('TELEGRAM', accessModal.state)}>{accessLoading === 'TELEGRAM' ? (t("Preparing…")) : (t("Continue with Telegram"))}<span>↗</span></button>}
      </div> : accessModal.view === 'email' ? <form className="booking-access-form" onSubmit={(event) => void requestEmailAccessCode(event)}>
        <p>{t("Enter your email address. If you already have an account, you’ll be signed in. Otherwise, we’ll create your Ayana account after verification.")}</p>
        <label className="booking-first-name">{t("Email")}<input type="email" autoComplete="email" autoFocus required maxLength={254} value={accessEmail} onChange={(event) => setAccessEmail(event.target.value)} placeholder={t("name@example.com")} /></label>
        <button type="submit" className="booking-confirm" disabled={emailAccessLoading}>{emailAccessLoading ? (t("Sending…")) : (t("Send me a code"))}</button>
        <button type="button" className="booking-cancel" disabled={emailAccessLoading} onClick={() => { setAccessError(''); setAccessModal({ ...accessModal, view: 'choose' }) }}>{t("Back to sign-in options")}</button>
      </form> : <form className="booking-access-form" onSubmit={(event) => void verifyEmailAccessCode(event)}>
        <p>{t("Enter the 6-digit code sent to {{value0}}.", { value0: accessModal.email })}</p>
        <label className="booking-first-name">{t("Verification code")}<input inputMode="numeric" autoComplete="one-time-code" autoFocus required minLength={6} maxLength={6} pattern="[0-9]{6}" value={accessCode} onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label>
        <button type="submit" className="booking-confirm" disabled={emailAccessLoading || accessCode.length !== 6}>{emailAccessLoading ? (t("Verifying…")) : (t("Verify and open schedule"))}</button>
        <button type="button" className="booking-cancel" disabled={emailAccessLoading} onClick={() => { setAccessError(''); setAccessCode(''); setAccessModal({ ...accessModal, view: 'email', verificationId: undefined }) }}>{t("Use a different email")}</button>
      </form>}
      {accessError && <div className="booking-error" role="alert">{accessError}</div>}
    </section></div>}
  </main>
}

export function BookingPortalPage() { return <BookingPortalRoute /> }

function BookingPortalNotFound() {
  const { t } = useTranslation('bookingPortal')
  return <main className="ayana-booking"><section className="booking-empty"><h1>Ayana</h1><p>{t('schedule-link-incomplete')}</p></section></main>
}

export function BookingPortalApp() {
  return <BrowserRouter><Routes><Route path="/:customerSlug/:locationSlug" element={<BookingPortalRoute />} /><Route path="*" element={<BookingPortalNotFound />} /></Routes></BrowserRouter>
}
