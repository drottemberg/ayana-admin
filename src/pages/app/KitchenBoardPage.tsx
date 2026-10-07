import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { getCustomerRequest, getCustomersListRequest } from '@/features/customers/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { getKitchenLocationsRequest, getKitchenOrdersRequest, getKitchenOrderDetailsRequest, reportKitchenOrderIssueRequest, resolveKitchenOrderIssueRequest, sendKitchenPickupReminderRequest, setKitchenOrderStatusRequest, type KitchenIssueCategory, type KitchenIssueResolution, type KitchenOrder } from '@/features/orders/api'
import { ordersQueryKeys } from '@/features/orders/query-keys'
import type { OrderStatus } from '@/types/order'
import type { Customer } from '@/types/customer'
import { apiClient, AUTH_TOKEN_REFRESHED_EVENT_NAME } from '@/lib/api-client'
import { getAppMode } from '@/features/app/app-mode'
import { useConnect } from '@/features/app/use-connect'
import ayanaLogo from '@/assets/ayana-logo.png'
import './KitchenBoardPage.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

function socketUrl() {
  return import.meta.env.VITE_SOCKET_URL || new URL(API_URL, window.location.origin).origin
}

const lanes: Array<{ status: 'RECEIVED' | 'PREPARING' | 'READY'; fr: string; en: string }> = [
  { status: 'RECEIVED', fr: 'À préparer', en: 'Received' },
  { status: 'PREPARING', fr: 'En préparation', en: 'Preparing' },
  { status: 'READY', fr: 'Prêtes', en: 'Ready' },
]

async function playBeep() {
  try {
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    if (context.state === 'suspended') await context.resume()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.14, context.currentTime + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.44)
    oscillator.onended = () => void context.close()
  } catch {
    // Browser audio can be unavailable until a user gesture; the board remains usable.
  }
}

function orderLabel(order: KitchenOrder) {
  return `#${order.shortCode ?? order.pickupNumber ?? order.id.slice(-5).toUpperCase()}`
}

function rollbackTargetFor(status: OrderStatus): OrderStatus | null {
  if (status === 'PREPARING') return 'RECEIVED'
  if (status === 'READY') return 'PREPARING'
  if (status === 'PICKED_UP') return 'READY'
  return null
}

function statusLabel(status: OrderStatus, language: 'fr' | 'en') {
  const labels: Partial<Record<OrderStatus, [string, string]>> = {
    RECEIVED: ['À préparer', 'Received'],
    PREPARING: ['En préparation', 'Preparing'],
    READY: ['Prête', 'Ready'],
    PICKED_UP: ['Récupérée', 'Picked up'],
  }
  const label = labels[status]
  return label ? label[language === 'fr' ? 0 : 1] : status
}

function formatTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function formatMoney(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}

const issueCategoryLabels: Record<KitchenIssueCategory, { fr: string; en: string }> = {
  MISSING_INGREDIENT: { fr: 'Ingrédient manquant', en: 'Missing ingredient' },
  OUT_OF_STOCK: { fr: 'Rupture de stock', en: 'Out of stock' },
  DELAY: { fr: 'Retard', en: 'Delay' },
  WRONG_ITEM: { fr: 'Erreur de préparation', en: 'Wrong item' },
  QUALITY: { fr: 'Problème de qualité', en: 'Quality issue' },
  OTHER: { fr: 'Autre', en: 'Other' },
}

function getIssueStatusLabel(status: string, language: 'fr' | 'en') {
  const labels: Record<string, [string, string]> = {
    OPEN: ['À traiter', 'Open'], WAITING_CUSTOMER: ['En attente du client', 'Waiting for customer'],
    CUSTOMER_ACCEPTED: ['Remplacement accepté', 'Replacement accepted'], CUSTOMER_DECLINED: ['Remplacement refusé', 'Replacement declined'],
    RESOLVED: ['Résolu', 'Resolved'], CANCELLED: ['Annulé', 'Cancelled'],
  }
  const label = labels[status]
  return label ? label[language === 'fr' ? 0 : 1] : status
}

function getAdminHomeUrl() {
  if (getAppMode() === 'admin') return '/'
  const hostname = window.location.hostname.replace(/^(www|app|customer)\./, '')
  const port = window.location.port ? `:${window.location.port}` : ''
  return `${window.location.protocol}//admin.${hostname}${port}/`
}

function modifierGlyph(name: string) {
  const value = name.toLowerCase()
  if (value.includes('froid') || value.includes('iced') || value.includes('ice')) return '❄'
  if (value.includes('lait') || value.includes('milk')) return '♧'
  if (value.includes('sirop') || value.includes('syrup')) return '●'
  return '·'
}

function KitchenCard({
  order,
  language,
  isUpdating,
  isSendingReminder,
  onAdvance,
  onRollback,
  onOpen,
  onSendReminder,
}: {
  order: KitchenOrder
  language: 'fr' | 'en'
  isUpdating: boolean
  isSendingReminder: boolean
  onAdvance: () => void
  onRollback: (() => void) | null
  onOpen: () => void
  onSendReminder: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { status: order.status },
    disabled: false,
  })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }
  const isDelivery = order.deliveryType === 'DELIVERY'

  return (
    <article ref={setNodeRef} style={style} className={`kitchen-card kitchen-card-${order.status.toLowerCase()}`}>
      <div className="kitchen-card-heading">
        <div className="kitchen-card-drag">
          <button type="button" className="kitchen-order-code kitchen-order-open" onClick={onOpen} aria-label={language === 'fr' ? `Voir le détail de ${orderLabel(order)}` : `View details for ${orderLabel(order)}`}>
            {orderLabel(order)}
          </button>
          <button {...attributes} {...listeners} type="button" className="kitchen-drag-grip" aria-label={language === 'fr' ? 'Déplacer la commande' : 'Drag order'}>⠿</button>
          {order.status === 'READY' && <span className="kitchen-ready-check" aria-label={language === 'fr' ? 'Commande prête' : 'Order ready'}>✓</span>}
        </div>
        <time className="kitchen-order-time">{formatTime(order.createdAt, language === 'fr' ? 'fr-FR' : 'en-GB')}</time>
      </div>

      <button type="button" className="kitchen-card-customer" onClick={onOpen}>
        {order.customerFirstName || order.customerLastName
          ? `${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim()
          : (language === 'fr' ? 'Client invité' : 'Guest customer')}
        <span>{language === 'fr' ? 'Voir le détail' : 'View details'} ↗</span>
      </button>

      <div className="kitchen-order-items">
        {order.items.map((item) => (
          <div key={item.id} className="kitchen-order-item">
            <div className="kitchen-product-line">
              <span className="kitchen-product-name">{item.quantity} × {item.productName}</span>
              {item.variantLabel && <span className="kitchen-product-size">{item.variantLabel}</span>}
            </div>
            {item.modifiers.length > 0 && (
              <ul className="kitchen-modifier-list">
                {item.modifiers.map((modifier) => (
                  <li key={modifier.id} className="kitchen-modifier">
                    <span className="kitchen-modifier-icon" aria-hidden="true">{modifierGlyph(modifier.name)}</span>
                    <span>{modifier.name}{modifier.quantity > 1 ? ` ×${modifier.quantity}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
            {item.notes && <p className="kitchen-item-note">{item.notes}</p>}
          </div>
        ))}
      </div>

      {(order.note || order.tableNumber) && (
        <div className="kitchen-order-note">
          {order.tableNumber && <span>{language === 'fr' ? 'Table' : 'Table'} {order.tableNumber}</span>}
          {order.tableNumber && order.note && <span> · </span>}
          {order.note}
        </div>
      )}

      {order.status === 'READY' && order.deliveryType !== 'DELIVERY' && order.canSendPickupReminder && (() => {
        const reminderSentAt = order.lastReminderAt ? new Date(order.lastReminderAt) : null
        const cooldownActive = Boolean(reminderSentAt && Date.now() - reminderSentAt.getTime() < 15 * 60_000)
        return (
          <button
            type="button"
            className="kitchen-card-reminder"
            disabled={isSendingReminder || cooldownActive}
            onClick={(event) => { event.stopPropagation(); onSendReminder() }}
          >
            {isSendingReminder
              ? (language === 'fr' ? 'Envoi du rappel…' : 'Sending reminder…')
              : cooldownActive && reminderSentAt
                ? `${language === 'fr' ? 'Rappel envoyé à' : 'Reminder sent at'} ${formatTime(reminderSentAt.toISOString(), language === 'fr' ? 'fr-FR' : 'en-GB')}`
                : (language === 'fr' ? 'Envoyer un rappel de retrait' : 'Send pickup reminder')}
          </button>
        )
      })()}

      <button
        type="button"
        onClick={onAdvance}
        disabled={isUpdating}
        className={`kitchen-card-action kitchen-card-action-${order.status.toLowerCase()}`}
      >
        {isUpdating ? (language === 'fr' ? 'Mise à jour…' : 'Updating…') : order.status === 'READY'
          ? isDelivery ? (language === 'fr' ? 'Marquer comme livrée' : 'Mark delivered') : (language === 'fr' ? 'Marquer comme récupérée' : 'Mark picked up')
          : order.status === 'RECEIVED'
            ? (language === 'fr' ? 'Commencer' : 'Start preparing')
            : (language === 'fr' ? 'Marquer comme prête' : 'Mark as ready')}
        <span className="kitchen-action-arrow" aria-hidden="true">{order.status === 'READY' ? '✓' : '→'}</span>
      </button>
      {onRollback && (
        <button type="button" className="kitchen-card-rollback" disabled={isUpdating} onClick={onRollback}>
          {language === 'fr' ? `↶ Revenir à « ${statusLabel(rollbackTargetFor(order.status)!, language)} »` : `↶ Move back to ${statusLabel(rollbackTargetFor(order.status)!, language)}`}
        </button>
      )}
    </article>
  )
}

function KitchenLane({
  status,
  title,
  orders,
  language,
  updatingId,
  reminderSendingId,
  onAdvance,
  onRollback,
  onOpen,
  onSendReminder,
}: {
  status: 'RECEIVED' | 'PREPARING' | 'READY'
  title: string
  orders: KitchenOrder[]
  language: 'fr' | 'en'
  updatingId: string | null
  reminderSendingId: string | null
  onAdvance: (order: KitchenOrder) => void
  onRollback: (order: KitchenOrder) => void
  onOpen: (order: KitchenOrder) => void
  onSendReminder: (order: KitchenOrder) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section ref={setNodeRef} className={`kitchen-lane kitchen-lane-${status.toLowerCase()} ${isOver ? 'kitchen-lane-drag-over' : ''}`}>
      <header className="kitchen-lane-heading">
        <h2>{title} <span>({orders.length})</span></h2>
      </header>
      <div className="kitchen-lane-orders">
        {orders.length ? orders.map((order) => (
          <KitchenCard
            key={order.id}
            order={order}
            language={language}
            isUpdating={updatingId === order.id}
            isSendingReminder={reminderSendingId === order.id}
            onAdvance={() => onAdvance(order)}
            onRollback={rollbackTargetFor(order.status) ? () => onRollback(order) : null}
            onOpen={() => onOpen(order)}
            onSendReminder={() => onSendReminder(order)}
          />
        )) : (
          <div className="kitchen-lane-empty">
            {language === 'fr' ? 'Aucune commande' : 'No orders'}
          </div>
        )}
      </div>
    </section>
  )
}

export default function KitchenBoardPage() {
  const queryClient = useQueryClient()
  const { session, isLoading: isConnectLoading } = useConnect()
  const appMode = getAppMode()
  const isAdminMode = appMode === 'admin'
  const adminCustomerStorageKey = 'ayana:kitchen:customer'
  const [adminCustomerId, setAdminCustomerId] = useState(() =>
    isAdminMode ? localStorage.getItem(adminCustomerStorageKey) ?? '' : '',
  )
  const [adminCustomer, setAdminCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('')
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(0)
  const customerPickerRef = useRef<HTMLDivElement>(null)
  const customerId = isAdminMode ? adminCustomerId : session?.currentOrganization?.id ?? ''
  const customerName = isAdminMode ? adminCustomer?.name : session?.currentOrganization?.name
  const [locationId, setLocationId] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [rollbackRequest, setRollbackRequest] = useState<{ orderId: string; fromStatus: OrderStatus; status: OrderStatus } | null>(null)
  const [rollbackReason, setRollbackReason] = useState('')
  const [reportFormOpen, setReportFormOpen] = useState(false)
  const [issueCategory, setIssueCategory] = useState<KitchenIssueCategory>('OUT_OF_STOCK')
  const [issueItemId, setIssueItemId] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [proposedReplacement, setProposedReplacement] = useState('')
  const [replacementVariantId, setReplacementVariantId] = useState('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [accessToken, setAccessToken] = useState(() => apiClient.getAuthToken())
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const knownOrderIds = useRef<Set<string> | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const selectedOrderIdRef = useRef<string | null>(selectedOrderId)
  selectedOrderIdRef.current = selectedOrderId
  const language = apiClient.getCulture().toLowerCase().startsWith('fr') ? 'fr' : 'en'
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedCustomerSearch(customerSearch.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [customerSearch])

  const customersQuery = useQuery({
    queryKey: [...customersQueryKeys.all, 'kitchen-customer-picker', debouncedCustomerSearch],
    queryFn: () => getCustomersListRequest({ contractId: null }, debouncedCustomerSearch),
    enabled: isAdminMode && customerPickerOpen,
    staleTime: 30_000,
  })
  const customerOptions = customersQuery.data ?? []
  const selectedCustomerQuery = useQuery({
    queryKey: [...customersQueryKeys.all, 'kitchen-selected-customer', adminCustomerId],
    queryFn: () => getCustomerRequest(adminCustomerId),
    enabled: isAdminMode && Boolean(adminCustomerId) && adminCustomer?.id !== adminCustomerId,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (selectedCustomerQuery.data?.id === adminCustomerId) {
      setAdminCustomer(selectedCustomerQuery.data)
    }
  }, [adminCustomerId, selectedCustomerQuery.data])

  useEffect(() => {
    if (!customerPickerOpen) return
    const closeWhenOutside = (event: PointerEvent) => {
      if (!customerPickerRef.current?.contains(event.target as Node)) setCustomerPickerOpen(false)
    }
    document.addEventListener('pointerdown', closeWhenOutside)
    return () => document.removeEventListener('pointerdown', closeWhenOutside)
  }, [customerPickerOpen])

  function chooseCustomer(customer: Customer) {
    if (customer.id !== adminCustomerId) {
      setAdminCustomerId(customer.id)
      setLocationId('')
      knownOrderIds.current = null
    }
    localStorage.setItem(adminCustomerStorageKey, customer.id)
    setAdminCustomer(customer)
    setCustomerSearch('')
    setCustomerPickerOpen(false)
    setActiveCustomerIndex(0)
  }

  const locationStorageKey = `ayana:kitchen:location:${customerId || 'unselected'}`
  const locationsQuery = useQuery({
    queryKey: ['orders', 'kitchen-locations', customerId],
    queryFn: () => getKitchenLocationsRequest(isAdminMode ? customerId : undefined),
    enabled: Boolean(customerId),
    staleTime: 30_000,
  })
  const locations = locationsQuery.data ?? []

  useEffect(() => {
    if (!customerId || locationsQuery.isLoading) return
    if (!locations.length) {
      setLocationId('')
      return
    }
    const savedLocationId = localStorage.getItem(locationStorageKey)
    if (!locations.some((location) => location.id === locationId)) {
      const next = locations.some((location) => location.id === savedLocationId) ? savedLocationId! : locations[0].id
      setLocationId(next)
      localStorage.setItem(locationStorageKey, next)
    }
  }, [customerId, locationId, locationStorageKey, locations, locationsQuery.isLoading])

  const kitchenQuery = useQuery({
    queryKey: ordersQueryKeys.kitchen(locationId),
    queryFn: () => getKitchenOrdersRequest(locationId),
    enabled: Boolean(customerId && locationId),
    refetchInterval: isRealtimeConnected ? 30_000 : 4_000,
    refetchOnWindowFocus: true,
  })
  const allOrders = kitchenQuery.data?.activeOrders ?? []
  const recentOrders = kitchenQuery.data?.recentOrders ?? []
  const selectedKitchenOrder = allOrders.find((order) => order.id === selectedOrderId)
  const lastReminderAt = selectedKitchenOrder?.lastReminderAt ? new Date(selectedKitchenOrder.lastReminderAt) : null
  const reminderCooldownActive = Boolean(lastReminderAt && Date.now() - lastReminderAt.getTime() < 15 * 60_000)
  const detailQuery = useQuery({
    queryKey: ['orders', 'kitchen-detail', selectedOrderId, locationId],
    queryFn: () => getKitchenOrderDetailsRequest(selectedOrderId!, locationId),
    enabled: Boolean(selectedOrderId && locationId),
    refetchInterval: selectedOrderId ? (isRealtimeConnected ? 30_000 : 8_000) : false,
  })
  const orderDetails = detailQuery.data

  useEffect(() => {
    const syncToken = () => setAccessToken(apiClient.getAuthToken())
    window.addEventListener(AUTH_TOKEN_REFRESHED_EVENT_NAME, syncToken)
    return () => window.removeEventListener(AUTH_TOKEN_REFRESHED_EVENT_NAME, syncToken)
  }, [])

  useEffect(() => {
    if (!accessToken || !customerId || !locationId) {
      setIsRealtimeConnected(false)
      return
    }

    const socket = io(`${socketUrl()}/kitchen`, {
      path: '/api/socket.io',
      auth: { token: accessToken, organizationId: customerId },
      reconnection: true,
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket
    setIsRealtimeConnected(false)

    const refreshKitchenQueries = (orderId?: string) => {
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.kitchen(locationId) })
      const selectedOrderId = selectedOrderIdRef.current
      if (selectedOrderId && (!orderId || orderId === selectedOrderId)) {
        void queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen-detail', selectedOrderId, locationId] })
      }
    }

    socket.on('connect', () => {
      setIsRealtimeConnected(false)
      socket.emit('kitchen:subscribe', { customerId, locationId }, (response: { ok?: boolean; error?: string }) => {
        if (!response?.ok) {
          setIsRealtimeConnected(false)
          if (response?.error) console.warn('[Kitchen] Realtime subscription failed:', response.error)
          return
        }
        setIsRealtimeConnected(true)
        refreshKitchenQueries()
      })
    })
    socket.on('kitchen:orders-changed', (event: { locationId?: string; orderId?: string }) => {
      if (event?.locationId !== locationId) return
      refreshKitchenQueries(event.orderId)
    })
    socket.on('disconnect', () => setIsRealtimeConnected(false))
    socket.on('connect_error', () => setIsRealtimeConnected(false))

    return () => {
      socket.disconnect()
      if (socketRef.current === socket) socketRef.current = null
      setIsRealtimeConnected(false)
    }
  }, [accessToken, customerId, locationId, queryClient])

  useEffect(() => {
    setSelectedOrderId(null)
    setRollbackRequest(null)
    setReportFormOpen(false)
  }, [locationId])

  useEffect(() => {
    if (!kitchenQuery.data) return
    const incoming = kitchenQuery.data.activeOrders
      .filter((order) => order.status === 'RECEIVED')
      .map((order) => order.id)
    if (knownOrderIds.current == null) {
      knownOrderIds.current = new Set(incoming)
      return
    }
    const newOrders = incoming.some((id) => !knownOrderIds.current?.has(id))
    incoming.forEach((id) => knownOrderIds.current?.add(id))
    if (newOrders && soundEnabled) void playBeep()
  }, [kitchenQuery.data, soundEnabled])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status, comment }: { orderId: string; status: OrderStatus; comment?: string }) =>
      setKitchenOrderStatusRequest(orderId, locationId, status, comment),
    onSuccess: (_result, variables) => {
      if (variables.comment) {
        setRollbackRequest(null)
        setRollbackReason('')
        toast.success(tr('Statut corrigé et motif enregistré.', 'Status corrected and reason recorded.'))
      }
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.kitchen(locationId) })
      void queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen-detail', variables.orderId, locationId] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : tr('Impossible de mettre à jour la commande.', 'Could not update the order.')),
  })
  const reminderMutation = useMutation({
    mutationFn: (orderId: string) => sendKitchenPickupReminderRequest(orderId, locationId),
    onSuccess: () => {
      toast.success(tr('Rappel envoyé au client.', 'Pickup reminder sent to the customer.'))
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.kitchen(locationId) })
      void queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen-detail', selectedOrderId, locationId] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : tr('Impossible d’envoyer le rappel.', 'Could not send the reminder.')),
  })
  const reportIssueMutation = useMutation({
    mutationFn: () => reportKitchenOrderIssueRequest(selectedOrderId!, locationId, {
      category: issueCategory,
      itemId: issueItemId || undefined,
      description: issueDescription,
    }),
    onSuccess: () => {
      toast.success(tr('Problème signalé.', 'Problem reported.'))
      setReportFormOpen(false)
      setIssueDescription('')
      setIssueItemId('')
      void queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen-detail', selectedOrderId, locationId] })
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.kitchen(locationId) })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : tr('Impossible de signaler ce problème.', 'Could not report the problem.')),
  })
  const resolveIssueMutation = useMutation({
    mutationFn: ({ issueId, resolution }: { issueId: string; resolution: KitchenIssueResolution }) => resolveKitchenOrderIssueRequest(
      selectedOrderId!, issueId, locationId, {
        resolution,
        proposedReplacement: proposedReplacement.trim() || undefined,
        replacementVariantId: replacementVariantId || undefined,
        resolutionNote: resolutionNote.trim() || undefined,
        refundAmount: refundAmount.trim() ? Number(refundAmount) : undefined,
      },
    ),
    onSuccess: () => {
      toast.success(tr('Décision enregistrée.', 'Resolution saved.'))
      setProposedReplacement('')
      setReplacementVariantId('')
      setResolutionNote('')
      setRefundAmount('')
      void queryClient.invalidateQueries({ queryKey: ['orders', 'kitchen-detail', selectedOrderId, locationId] })
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.kitchen(locationId) })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : tr('Impossible d’enregistrer cette décision.', 'Could not save this resolution.')),
  })

  const ordersByStatus = useMemo(() => ({
    RECEIVED: allOrders.filter((order) => order.status === 'RECEIVED'),
    PREPARING: allOrders.filter((order) => order.status === 'PREPARING'),
    READY: allOrders.filter((order) => order.status === 'READY'),
  }), [allOrders])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  function advance(order: KitchenOrder) {
    const status: OrderStatus = order.status === 'RECEIVED'
      ? 'PREPARING'
      : order.status === 'PREPARING'
        ? 'READY'
        : order.deliveryType === 'DELIVERY' ? 'DELIVERED' : 'PICKED_UP'
    statusMutation.mutate({ orderId: order.id, status })
  }

  function requestRollback(orderId: string, fromStatus: OrderStatus) {
    const status = rollbackTargetFor(fromStatus)
    if (!status) return
    setRollbackReason('')
    setRollbackRequest({ orderId, fromStatus, status })
  }

  function confirmRollback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const reason = rollbackReason.trim()
    if (!rollbackRequest || !reason) return
    statusMutation.mutate({ orderId: rollbackRequest.orderId, status: rollbackRequest.status, comment: reason })
  }

  function onDragEnd(event: DragEndEvent) {
    const order = allOrders.find((candidate) => candidate.id === String(event.active.id))
    const target = String(event.over?.id ?? '')
    if (!order) return
    if ((order.status === 'RECEIVED' && target === 'PREPARING') || (order.status === 'PREPARING' && target === 'READY')) {
      statusMutation.mutate({ orderId: order.id, status: target as OrderStatus })
    } else if ((order.status === 'PREPARING' && target === 'RECEIVED') || (order.status === 'READY' && target === 'PREPARING')) {
      requestRollback(order.id, order.status)
    }
  }

  const enableSound = () => {
    setSoundEnabled((enabled) => !enabled)
    if (!soundEnabled) void playBeep()
  }

  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
      else await document.exitFullscreen()
    } catch {
      toast.error(tr('Le plein écran n’est pas disponible dans ce navigateur.', 'Fullscreen is not available in this browser.'))
    }
  }

  if (customerId && locationsQuery.isError) {
    return <div className="flex min-h-svh items-center justify-center bg-[#0b0c0a] p-6 text-center text-white">{tr('Impossible de charger les locations.', 'Could not load locations.')}</div>
  }

  return (
    <div className="kitchen-screen">
      <header className="kitchen-header">
        <div className="kitchen-header-brand">
          <Link to="/" className="kitchen-brand-logo">
            <img src={ayanaLogo} alt="Ayana Feelness Club" />
          </Link>
          <span className="kitchen-header-divider" />
          {isAdminMode ? (
            <div className="kitchen-customer-field kitchen-customer-picker" ref={customerPickerRef}>
              <div className="kitchen-customer-control">
                <input
                  type="text"
                  role="combobox"
                  aria-label={tr('Client', 'Customer')}
                  aria-autocomplete="list"
                  aria-expanded={customerPickerOpen}
                  aria-controls="kitchen-customer-options"
                  aria-activedescendant={customerPickerOpen && customerOptions[activeCustomerIndex] ? `kitchen-customer-option-${activeCustomerIndex}` : undefined}
                  autoComplete="off"
                  className="kitchen-customer-select"
                  placeholder={tr('Choisir un client', 'Select customer')}
                  value={customerPickerOpen ? customerSearch : adminCustomer?.name ?? ''}
                  onFocus={() => {
                    setCustomerSearch('')
                    setActiveCustomerIndex(0)
                    setCustomerPickerOpen(true)
                  }}
                  onChange={(event) => {
                    setCustomerSearch(event.target.value)
                    setActiveCustomerIndex(0)
                    setCustomerPickerOpen(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' && customerOptions.length) {
                      event.preventDefault()
                      setActiveCustomerIndex((index) => Math.min(index + 1, customerOptions.length - 1))
                    } else if (event.key === 'ArrowUp' && customerOptions.length) {
                      event.preventDefault()
                      setActiveCustomerIndex((index) => Math.max(index - 1, 0))
                    } else if (event.key === 'Enter' && customerPickerOpen && customerOptions[activeCustomerIndex]) {
                      event.preventDefault()
                      chooseCustomer(customerOptions[activeCustomerIndex])
                    } else if (event.key === 'Escape') {
                      setCustomerPickerOpen(false)
                    }
                  }}
                />
                <button
                  type="button"
                  className="kitchen-customer-trigger"
                  aria-label={customerPickerOpen ? tr('Fermer la liste des clients', 'Close customer list') : tr('Ouvrir la liste des clients', 'Open customer list')}
                  aria-expanded={customerPickerOpen}
                  onClick={() => {
                    setCustomerSearch('')
                    setActiveCustomerIndex(0)
                    setCustomerPickerOpen((open) => !open)
                  }}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
                </button>
              </div>
              {customerPickerOpen && (
                <div className="kitchen-customer-options" id="kitchen-customer-options" role="listbox" aria-label={tr('Clients', 'Customers')}>
                  {customersQuery.isFetching && !customerOptions.length ? (
                    <div className="kitchen-customer-option-message">{tr('Chargement des clients…', 'Loading customers…')}</div>
                  ) : customersQuery.isError ? (
                    <div className="kitchen-customer-option-message is-error">{tr('Impossible de charger les clients.', 'Could not load customers.')}</div>
                  ) : customerOptions.length ? customerOptions.map((customer, index) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={customer.id === adminCustomerId}
                      id={`kitchen-customer-option-${index}`}
                      key={customer.id}
                      className={`kitchen-customer-option ${index === activeCustomerIndex ? 'is-active' : ''}`}
                      onMouseEnter={() => setActiveCustomerIndex(index)}
                      onClick={() => chooseCustomer(customer)}
                    >
                      {customer.name}
                    </button>
                  )) : (
                    <div className="kitchen-customer-option-message">{tr('Aucun client trouvé.', 'No customers found.')}</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="kitchen-customer-fixed">
              <span>{tr('Client', 'Customer')}</span>
              <strong>{customerName || tr('Chargement…', 'Loading…')}</strong>
            </div>
          )}
          <label className="kitchen-location-picker">
            <span className="sr-only">{tr('Location', 'Location')}</span>
            <select
              value={locationId}
              onChange={(event) => {
                setLocationId(event.target.value)
                if (event.target.value) localStorage.setItem(locationStorageKey, event.target.value)
                knownOrderIds.current = null
              }}
              disabled={!customerId || !locations.length}
              className="kitchen-location-select"
            >
              {!customerId
                ? <option value="">{tr('Choisissez un client', 'Select customer first')}</option>
                : locationsQuery.isLoading
                  ? <option value="">{tr('Chargement des locations…', 'Loading locations…')}</option>
                  : !locations.length
                    ? <option value="">{tr('Aucune location accessible', 'No accessible locations')}</option>
                    : null}
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </label>
        </div>

        <div className="kitchen-header-tools">
          <button type="button" onClick={enableSound} className={`kitchen-sound-toggle ${soundEnabled ? 'is-enabled' : ''}`} aria-pressed={soundEnabled} aria-label={soundEnabled ? tr('Désactiver le son', 'Disable sound') : tr('Activer le son', 'Enable sound')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>
          </button>
          <span className="kitchen-header-divider" />
          <div className="kitchen-clock">
            <div className="kitchen-clock-time">{new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(now)}</div>
            <div className="kitchen-clock-date">{new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(now)}</div>
          </div>
          <div className="kitchen-header-counts">
            <span>{tr('À préparer', 'To prepare')} <b className="count-received">{ordersByStatus.RECEIVED.length}</b></span>
            <span>{tr('En préparation', 'Preparing')} <b className="count-preparing">{ordersByStatus.PREPARING.length}</b></span>
          </div>
          <button type="button" onClick={() => void enterFullscreen()} className="kitchen-fullscreen-toggle" aria-label={tr('Plein écran', 'Full screen')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg>
          </button>
          <a href={getAdminHomeUrl()} className="kitchen-admin-back" aria-label={tr('Retour à l’administration', 'Back to admin')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7M8 12h13"/></svg>
            <span>{tr('Admin', 'Admin')}</span>
          </a>
        </div>
      </header>

      <main className="kitchen-main">
        {!isAdminMode && !customerId ? (
          <div className="kitchen-empty-access">{isConnectLoading ? tr('Chargement du client…', 'Loading customer…') : tr('Aucun client associé à ce compte.', 'No customer is linked to this account.')}</div>
        ) : isAdminMode && !customerId ? (
          <div className="kitchen-empty-access">{tr('Choisissez un client pour afficher ses commandes.', 'Select a customer to load its orders.')}</div>
        ) : customerId && !locations.length && !locationsQuery.isLoading ? (
          <div className="kitchen-empty-access">{tr('Aucune location accessible avec le rôle Front Desk.', 'No locations are available for your Front Desk role.')}</div>
        ) : (
          <>
            <div className="kitchen-board-wrap">
              {kitchenQuery.isError ? (
                <div className="kitchen-load-error">
                  <span>{tr('Impossible de charger les commandes.', 'Could not load orders.')}</span>
                  <button type="button" onClick={() => void kitchenQuery.refetch()}>{tr('Réessayer', 'Retry')}</button>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <div className="kitchen-board">
                    {lanes.map((lane) => (
                      <KitchenLane
                        key={lane.status}
                        status={lane.status}
                        title={language === 'fr' ? lane.fr : lane.en}
                        orders={ordersByStatus[lane.status]}
                        language={language}
                        updatingId={statusMutation.isPending ? statusMutation.variables?.orderId ?? null : null}
                        reminderSendingId={reminderMutation.isPending ? reminderMutation.variables ?? null : null}
                        onAdvance={advance}
                        onRollback={(order) => requestRollback(order.id, order.status)}
                        onOpen={(order) => { setSelectedOrderId(order.id); setReportFormOpen(false) }}
                        onSendReminder={(order) => reminderMutation.mutate(order.id)}
                      />
                    ))}
                  </div>
                </DndContext>
              )}
            </div>

            <details className="kitchen-recent">
              <summary>
                {tr('Terminées récemment', 'Recently completed')} ({recentOrders.length})
                {kitchenQuery.isFetching && <span className="kitchen-refresh-state">· {tr('actualisation…', 'refreshing…')}</span>}
              </summary>
              {recentOrders.length ? (
                <div className="kitchen-recent-list">
                  {recentOrders.map((order) => (
                    <button key={order.id} type="button" className="kitchen-recent-card" onClick={() => { setSelectedOrderId(order.id); setReportFormOpen(false) }}>
                      <div><strong>{orderLabel(order)}</strong><span>{order.status === 'DELIVERED' ? tr('Livrée', 'Delivered') : tr('Récupérée', 'Picked up')}</span></div>
                      <small>{`${order.customerFirstName ?? ''} ${order.customerLastName ?? ''}`.trim() || tr('Client invité', 'Guest customer')}</small>
                      <p>{order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}</p>
                    </button>
                  ))}
                </div>
              ) : <p className="kitchen-recent-empty">{tr('Aucune commande terminée récemment.', 'No recently completed orders.')}</p>}
            </details>
          </>
        )}
      </main>

      {selectedOrderId && (
        <div className="kitchen-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOrderId(null) }}>
          <section className="kitchen-detail-panel" role="dialog" aria-modal="true" aria-label={tr('Détail de la commande', 'Order details')}>
            <header className="kitchen-detail-header">
              <div>
                <span>{tr('Détail de la commande', 'Order details')}</span>
                <h2>{orderDetails ? `#${orderDetails.order.shortCode ?? orderDetails.order.pickupNumber ?? orderDetails.order.id.slice(-5).toUpperCase()}` : '…'}</h2>
              </div>
              <button type="button" className="kitchen-detail-close" onClick={() => setSelectedOrderId(null)} aria-label={tr('Fermer', 'Close')}>×</button>
            </header>
            {detailQuery.isLoading ? <div className="kitchen-detail-state">{tr('Chargement du détail…', 'Loading order details…')}</div> : detailQuery.isError || !orderDetails ? (
              <div className="kitchen-detail-state is-error">{tr('Impossible de charger le détail.', 'Could not load order details.')}</div>
            ) : (
              <div className="kitchen-detail-content">
                <section className="kitchen-detail-summary">
                  <div>
                    <span>{tr('Client', 'Customer')}</span>
                    <strong>{`${orderDetails.order.customer?.firstName ?? ''} ${orderDetails.order.customer?.lastName ?? ''}`.trim() || tr('Client invité', 'Guest customer')}</strong>
                    {orderDetails.order.customer?.email && <small>{tr('E-mail', 'Email')}: {orderDetails.order.customer.email}</small>}
                    {orderDetails.order.customer?.phone && <small>{tr('Téléphone', 'Phone')}: {orderDetails.order.customer.phone}</small>}
                  </div>
                  <div><span>{tr('Statut', 'Status')}</span><strong>{orderDetails.order.status}</strong><small>{orderDetails.order.location.name}</small></div>
                  <div><span>{tr('Paiement', 'Payment')}</span><strong>{orderDetails.order.paymentStatus}</strong><small>{formatMoney(orderDetails.order.total, orderDetails.order.currency, language === 'fr' ? 'fr-FR' : 'en-GB')}</small></div>
                  <div><span>{tr('Reçue à', 'Received at')}</span><strong>{formatTime(orderDetails.order.createdAt, language === 'fr' ? 'fr-FR' : 'en-GB')}</strong><small>{orderDetails.order.deliveryType}</small></div>
                </section>

                {rollbackTargetFor(orderDetails.order.status) && (orderDetails.order.status !== 'PICKED_UP' || orderDetails.order.deliveryType !== 'DELIVERY') && (
                  <button
                    type="button"
                    className="kitchen-detail-rollback"
                    disabled={statusMutation.isPending}
                    onClick={() => requestRollback(orderDetails.order.id, orderDetails.order.status)}
                  >
                    {tr(
                      `↶ Corriger le statut · revenir à « ${statusLabel(rollbackTargetFor(orderDetails.order.status)!, language)} »`,
                      `↶ Correct status · move back to ${statusLabel(rollbackTargetFor(orderDetails.order.status)!, language)}`,
                    )}
                  </button>
                )}

                {orderDetails.order.status === 'READY' && orderDetails.order.deliveryType !== 'DELIVERY' && orderDetails.order.customer && (
                  <button type="button" className="kitchen-reminder-button" disabled={reminderMutation.isPending || reminderCooldownActive} onClick={() => reminderMutation.mutate(orderDetails.order.id)}>
                    {reminderMutation.isPending
                      ? tr('Envoi du rappel…', 'Sending reminder…')
                      : reminderCooldownActive && lastReminderAt
                        ? `${tr('Rappel envoyé à', 'Reminder sent at')} ${formatTime(lastReminderAt.toISOString(), language === 'fr' ? 'fr-FR' : 'en-GB')}`
                        : tr('Envoyer un rappel de retrait', 'Send pickup reminder')}
                  </button>
                )}

                <section className="kitchen-detail-section">
                  <h3>{tr('Articles', 'Items')}</h3>
                  <div className="kitchen-detail-items">
                    {orderDetails.items.map((item) => {
                      const itemIssue = orderDetails.issues.some((issue) => issue.itemId === item.id && issue.status === 'RESOLVED' && issue.resolution === 'REMOVE_ITEM_REFUND')
                      return (
                        <article key={item.id} className={`kitchen-detail-item ${itemIssue ? 'is-removed' : ''}`}>
                          <div className="kitchen-detail-item-heading"><strong>{item.quantity} × {item.productName}{(item.variantLabel || item.variantName) ? ` · ${item.variantLabel || item.variantName}` : ''}</strong><b>{formatMoney(item.unitPrice * item.quantity, orderDetails.order.currency, language === 'fr' ? 'fr-FR' : 'en-GB')}</b></div>
                          <small>{tr('Prix unitaire', 'Unit price')}: {formatMoney(item.unitPrice, orderDetails.order.currency, language === 'fr' ? 'fr-FR' : 'en-GB')} · TVA {item.vatRate}%</small>
                          {item.modifiers.map((modifier) => <div className="kitchen-detail-modifier" key={modifier.id}>+ {modifier.name}{modifier.quantity > 1 ? ` ×${modifier.quantity}` : ''} · {formatMoney(modifier.price * modifier.quantity, orderDetails.order.currency, language === 'fr' ? 'fr-FR' : 'en-GB')}</div>)}
                          {item.modifiers.length > 0 && <div className="kitchen-detail-item-total">{tr('Total article', 'Item total')}: {formatMoney(item.subtotal, orderDetails.order.currency, language === 'fr' ? 'fr-FR' : 'en-GB')}</div>}
                          {item.notes && <p>{item.notes}</p>}
                          {itemIssue && <span className="kitchen-issue-pill">{tr('Retiré et remboursé', 'Removed and refunded')}</span>}
                        </article>
                      )
                    })}
                  </div>
                  <div className="kitchen-detail-total"><span>{tr('Total', 'Total')}</span><strong>{formatMoney(orderDetails.order.total, orderDetails.order.currency, language === 'fr' ? 'fr-FR' : 'en-GB')}</strong></div>
                </section>

                <section className="kitchen-detail-section">
                  <div className="kitchen-detail-section-heading"><h3>{tr('Problèmes de commande', 'Order problems')}</h3>{['RECEIVED', 'PREPARING', 'READY'].includes(orderDetails.order.status) && <button type="button" onClick={() => setReportFormOpen((open) => !open)}>{reportFormOpen ? tr('Fermer', 'Close') : `+ ${tr('Signaler un problème', 'Report a problem')}`}</button>}</div>
                  {reportFormOpen && ['RECEIVED', 'PREPARING', 'READY'].includes(orderDetails.order.status) && (
                    <form className="kitchen-issue-form" onSubmit={(event) => { event.preventDefault(); reportIssueMutation.mutate() }}>
                      <label>{tr('Type', 'Type')}<select value={issueCategory} onChange={(event) => setIssueCategory(event.target.value as KitchenIssueCategory)}>{(Object.keys(issueCategoryLabels) as KitchenIssueCategory[]).map((category) => <option key={category} value={category}>{issueCategoryLabels[category][language === 'fr' ? 'fr' : 'en']}</option>)}</select></label>
                      <label>{tr('Article concerné', 'Affected item')}<select value={issueItemId} onChange={(event) => setIssueItemId(event.target.value)}><option value="">{tr('Commande entière / aucun article', 'Whole order / no specific item')}</option>{orderDetails.items.map((item) => <option key={item.id} value={item.id}>{item.productName}{(item.variantLabel || item.variantName) ? ` · ${item.variantLabel || item.variantName}` : ''}</option>)}</select></label>
                      <label>{tr('Description', 'Description')}<textarea required value={issueDescription} onChange={(event) => setIssueDescription(event.target.value)} placeholder={tr('Ex. lait d’avoine indisponible', 'E.g. oat milk is unavailable')} /></label>
                      <button type="submit" disabled={reportIssueMutation.isPending || !issueDescription.trim()}>{reportIssueMutation.isPending ? tr('Enregistrement…', 'Saving…') : tr('Signaler', 'Report')}</button>
                    </form>
                  )}
                  {orderDetails.issues.length ? orderDetails.issues.map((issue) => (
                    <article key={issue.id} className="kitchen-issue-card">
                      <div className="kitchen-issue-card-heading"><strong>{issueCategoryLabels[issue.category as KitchenIssueCategory]?.[language === 'fr' ? 'fr' : 'en'] ?? issue.category}</strong><span className={`kitchen-issue-pill status-${issue.status.toLowerCase()}`}>{getIssueStatusLabel(issue.status, language)}</span></div>
                      <p>{issue.description}</p>
                      {issue.proposedReplacement && <small>{tr('Remplacement proposé', 'Proposed replacement')}: {issue.proposedReplacement}</small>}
                      {issue.resolutionNote && <small>{issue.resolutionNote}</small>}
                      {issue.resolutionAmount != null && <small>{tr('Remboursement', 'Refund')}: {formatMoney(issue.resolutionAmount, orderDetails.order.currency, language === 'fr' ? 'fr-FR' : 'en-GB')}</small>}
                      {issue.status === 'OPEN' && ['RECEIVED', 'PREPARING', 'READY'].includes(orderDetails.order.status) && (
                        <div className="kitchen-issue-actions">
                          {issue.itemId && issue.replacementOptions?.length ? (
                            <select value={replacementVariantId} onChange={(event) => {
                              const selected = issue.replacementOptions?.find((option) => option.id === event.target.value)
                              setReplacementVariantId(event.target.value)
                              setProposedReplacement(selected?.label ?? '')
                            }}>
                              <option value="">{tr('Choisir un remplacement disponible au même prix', 'Choose an available replacement at the same price')}</option>
                              {issue.replacementOptions.map((option) => <option key={option.id} value={option.id}>{option.label} · {formatMoney(option.price, orderDetails.order.currency, language === 'fr' ? 'fr-FR' : 'en-GB')} · {tr('stock', 'stock')} {option.stock === -1 ? '∞' : option.stock}</option>)}
                            </select>
                          ) : <input value={proposedReplacement} onChange={(event) => setProposedReplacement(event.target.value)} placeholder={tr('Aucun remplacement disponible au même prix', 'No same-price replacement is available')} disabled={Boolean(issue.itemId)} />}
                          <input value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder={tr('Note ou motif (facultatif)', 'Note or reason (optional)')} />
                          {issue.itemId && <input type="number" min="0.01" step="0.01" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder={tr('Remboursement article (vide = montant de l’article)', 'Item refund (blank = item amount)')} />}
                          <button type="button" disabled={resolveIssueMutation.isPending || !proposedReplacement.trim() || (Boolean(issue.itemId) && !replacementVariantId)} onClick={() => resolveIssueMutation.mutate({ issueId: issue.id, resolution: 'ASK_CUSTOMER' })}>{tr('Proposer un remplacement', 'Offer replacement')}</button>
                          {issue.itemId && <button type="button" disabled={resolveIssueMutation.isPending} onClick={() => resolveIssueMutation.mutate({ issueId: issue.id, resolution: 'REMOVE_ITEM_REFUND' })}>{tr('Retirer l’article et rembourser', 'Remove item and refund')}</button>}
                          <button type="button" disabled={resolveIssueMutation.isPending} onClick={() => resolveIssueMutation.mutate({ issueId: issue.id, resolution: 'CANCEL_ORDER_REFUND' })}>{tr('Annuler la commande et rembourser', 'Cancel order and refund')}</button>
                          {!issue.itemId && <button type="button" disabled={resolveIssueMutation.isPending} onClick={() => resolveIssueMutation.mutate({ issueId: issue.id, resolution: 'CONTINUE_REMAINDER' })}>{tr('Continuer le reste de la commande', 'Continue with the rest of the order')}</button>}
                        </div>
                      )}
                      {issue.status === 'CUSTOMER_ACCEPTED' && ['RECEIVED', 'PREPARING', 'READY'].includes(orderDetails.order.status) && (
                        <div className="kitchen-issue-actions">
                          {issue.replacementOptions?.length ? (
                            <>
                              <select value={replacementVariantId} onChange={(event) => {
                                const selected = issue.replacementOptions?.find((option) => option.id === event.target.value)
                                setReplacementVariantId(event.target.value)
                                setProposedReplacement(selected?.label ?? '')
                              }}>
                                <option value="">{tr('Choisir le remplacement accepté', 'Choose the accepted replacement')}</option>
                                {issue.replacementOptions.map((option) => <option key={option.id} value={option.id}>{option.label} · {formatMoney(option.price, orderDetails.order.currency, language === 'fr' ? 'fr-FR' : 'en-GB')} · {tr('stock', 'stock')} {option.stock === -1 ? '∞' : option.stock}</option>)}
                              </select>
                              <button type="button" disabled={resolveIssueMutation.isPending || !replacementVariantId} onClick={() => resolveIssueMutation.mutate({ issueId: issue.id, resolution: 'OTHER' })}>{tr('Appliquer le remplacement accepté', 'Apply the accepted replacement')}</button>
                            </>
                          ) : <small>{tr('Aucun remplacement disponible au même prix ; une intervention manuelle est nécessaire.', 'No same-price replacement is available; staff follow-up is required.')}</small>}
                          <input value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder={tr('Note de remplacement effectué (facultatif)', 'Replacement completed (optional note)')} />
                          {issue.itemId && <button type="button" disabled={resolveIssueMutation.isPending} onClick={() => resolveIssueMutation.mutate({ issueId: issue.id, resolution: 'REMOVE_ITEM_REFUND' })}>{tr('Rembourser l’article à la place', 'Refund the item instead')}</button>}
                          <button type="button" disabled={resolveIssueMutation.isPending} onClick={() => resolveIssueMutation.mutate({ issueId: issue.id, resolution: 'CANCEL_ORDER_REFUND' })}>{tr('Annuler et rembourser la commande', 'Cancel and refund the order')}</button>
                        </div>
                      )}
                      {issue.status === 'CUSTOMER_DECLINED' && ['RECEIVED', 'PREPARING', 'READY'].includes(orderDetails.order.status) && (
                        <div className="kitchen-issue-actions">
                          {issue.itemId && <button type="button" disabled={resolveIssueMutation.isPending} onClick={() => resolveIssueMutation.mutate({ issueId: issue.id, resolution: 'REMOVE_ITEM_REFUND' })}>{tr('Retirer l’article et rembourser', 'Remove item and refund')}</button>}
                          <button type="button" disabled={resolveIssueMutation.isPending} onClick={() => resolveIssueMutation.mutate({ issueId: issue.id, resolution: 'CANCEL_ORDER_REFUND' })}>{tr('Annuler et rembourser la commande', 'Cancel and refund order')}</button>
                          {!issue.itemId && <button type="button" disabled={resolveIssueMutation.isPending} onClick={() => resolveIssueMutation.mutate({ issueId: issue.id, resolution: 'CONTINUE_REMAINDER' })}>{tr('Continuer le reste de la commande', 'Continue with the rest of the order')}</button>}
                        </div>
                      )}
                    </article>
                  )) : !reportFormOpen && <p className="kitchen-detail-empty">{tr('Aucun problème signalé.', 'No reported problems.')}</p>}
                </section>

                <section className="kitchen-detail-section">
                  <h3>{tr('Paiements et remboursements', 'Payments and refunds')}</h3>
                  {orderDetails.transactions.length ? orderDetails.transactions.map((transaction) => <div className="kitchen-detail-history-row" key={transaction.id}><span>{transaction.type} · {transaction.status}{transaction.reason ? ` · ${transaction.reason}` : ''}</span><strong>{formatMoney(transaction.amount, transaction.currency, language === 'fr' ? 'fr-FR' : 'en-GB')}</strong></div>) : <p className="kitchen-detail-empty">{tr('Aucune transaction enregistrée.', 'No financial transactions recorded.')}</p>}
                </section>

                <section className="kitchen-detail-section">
                  <h3>{tr('Historique', 'History')}</h3>
                  {orderDetails.history.map((entry, index) => <div className="kitchen-detail-history-row" key={`${entry.createdAt}-${index}`}><span>{entry.status}{entry.comment?.startsWith('Rollback ') ? ` · ${entry.comment}` : entry.comment?.startsWith('pickup-reminder:') ? ` · ${tr('Rappel envoyé', 'Reminder sent')}` : entry.comment?.startsWith('issue-') ? ` · ${tr('Mise à jour du problème', 'Issue update')}` : entry.comment ? ` · ${entry.comment}` : ''}</span><time>{new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(entry.createdAt))}</time></div>)}
                </section>
              </div>
            )}
          </section>
        </div>
      )}
      {rollbackRequest && (
        <div className="kitchen-rollback-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !statusMutation.isPending) setRollbackRequest(null) }}>
          <form className="kitchen-rollback-dialog" role="dialog" aria-modal="true" aria-labelledby="kitchen-rollback-title" onSubmit={confirmRollback}>
            <h2 id="kitchen-rollback-title">{tr('Corriger le statut de la commande', 'Correct the order status')}</h2>
            <p>{tr(
              `Passer de « ${statusLabel(rollbackRequest.fromStatus, language)} » à « ${statusLabel(rollbackRequest.status, language)} ». Indiquez pourquoi le statut doit être corrigé.`,
              `Move from “${statusLabel(rollbackRequest.fromStatus, language)}” back to “${statusLabel(rollbackRequest.status, language)}”. Please provide a reason.`,
            )}</p>
            <label htmlFor="kitchen-rollback-reason">{tr('Motif obligatoire', 'Reason required')}</label>
            <textarea
              id="kitchen-rollback-reason"
              autoFocus
              required
              maxLength={500}
              value={rollbackReason}
              onChange={(event) => setRollbackReason(event.target.value)}
              placeholder={tr('Ex. commande marquée prête par erreur', 'E.g. order was marked ready by mistake')}
            />
            <div className="kitchen-rollback-actions">
              <button type="button" disabled={statusMutation.isPending} onClick={() => setRollbackRequest(null)}>{tr('Annuler', 'Cancel')}</button>
              <button type="submit" disabled={statusMutation.isPending || !rollbackReason.trim()}>{statusMutation.isPending ? tr('Correction…', 'Correcting…') : tr('Confirmer la correction', 'Confirm correction')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
