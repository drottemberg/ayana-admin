import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon'
import TransactionHistoryIcon from '@hugeicons/core-free-icons/TransactionHistoryIcon'

import { DataTable, DataTableAsync, type DataTableState } from '@/components/data-table'
import { DetailPageLayout, DetailSidePanel, type DetailPanelSection } from '@/components/app/detail-page-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createPageHeaderAction, PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getCustomersListRequest } from '@/features/customers/api'
import { getAllLocationsForCustomerRequest } from '@/features/locations/api'
import { useConnect } from '@/features/app/use-connect'
import { getAppMode } from '@/features/app/app-mode'
import { getCampaignColumns } from '@/features/customer-messaging/campaign-columns'
import { CampaignMessageEditor } from '@/features/customer-messaging/CampaignMessageEditor'
import {
  getBroadcastCustomerOptions,
  getApprovedWhatsappTemplatesRequest,
  getWhatsappTemplateLibraryRequest,
  createWhatsappTemplateFromLibraryRequest,
  getBroadcastCampaignDetailRequest,
  getBroadcastCampaignsRequest,
  retryBroadcastCampaignRequest,
  getCustomerBroadcastAudienceRequest,
  getCustomerBroadcastDraftRequest,
  getCustomerBroadcastDraftMediaRequest,
  saveCustomerBroadcastDraftRequest,
  deleteCustomerBroadcastDraftRequest,
  sendCustomerBroadcastRequest,
  sendCustomerBroadcastTestEmailRequest,
  type BroadcastActivity,
  type BroadcastAudienceFilters,
  type BroadcastChannel,
  type BroadcastDelivery,
  type BroadcastHistoryDetail,
  type BroadcastHistoryItem,
  type BroadcastRecipient,
} from '@/features/customer-messaging/api'

const MAX_IMAGE_COUNT = 5
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const EMPTY_RECIPIENTS: BroadcastRecipient[] = []
const CAMPAIGN_KEY_STORAGE = 'ayana-admin:customer-broadcast-idempotency-key'
const createCampaignKey = () => {
  const key = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  try { sessionStorage.setItem(CAMPAIGN_KEY_STORAGE, key) } catch { /* Session storage can be unavailable in restricted browsers. */ }
  return key
}
const getCampaignKey = () => {
  try {
    const existing = sessionStorage.getItem(CAMPAIGN_KEY_STORAGE)
    if (existing) return existing
  } catch { /* Generate an in-memory key if session storage is unavailable. */ }
  return createCampaignKey()
}

export default function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { session } = useConnect()
  const [customerSearch, setCustomerSearch] = useState('')
  const [recipientSearch, setRecipientSearch] = useState('')
  const [customerIdState, setCustomerId] = useState(searchParams.get('customerId') ?? '')
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [activity, setActivity] = useState<BroadcastActivity>('ALL')
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([])
  const [emailSubject, setEmailSubject] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [draftId, setDraftId] = useState('')
  const [message, setMessage] = useState('')
  const [replyButtons, setReplyButtons] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [selectedChannels, setSelectedChannels] = useState<BroadcastChannel[]>(['WHATSAPP', 'TELEGRAM', 'EMAIL'])
  const [sendWhatsappTemplate, setSendWhatsappTemplate] = useState(false)
  const [whatsappTemplateName, setWhatsappTemplateName] = useState('')
  const [whatsappTemplateLanguage, setWhatsappTemplateLanguage] = useState('')
  const [whatsappTemplateParameters, setWhatsappTemplateParameters] = useState('')
  const [whatsappTemplateParameterNames, setWhatsappTemplateParameterNames] = useState('')
  const [whatsappTemplateHeaderImage, setWhatsappTemplateHeaderImage] = useState(false)
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false)
  const [libraryLanguage, setLibraryLanguage] = useState('fr')
  const [librarySearch, setLibrarySearch] = useState('')
  const [selectedLibraryTemplateKey, setSelectedLibraryTemplateKey] = useState('')
  const [libraryTemplateName, setLibraryTemplateName] = useState('')
  const [libraryButtonValues, setLibraryButtonValues] = useState<Record<number, { baseUrl?: string; urlSuffixExample?: string; phoneNumber?: string }>>({})
  const [campaignRequestKey, setCampaignRequestKey] = useState(getCampaignKey)
  const [mode, setMode] = useState<'LIST' | 'CREATE' | 'DETAIL'>(searchParams.get('campaignId') ? 'DETAIL' : searchParams.get('customerId') ? 'CREATE' : 'LIST')
  const [selectedBroadcastId, setSelectedBroadcastId] = useState(searchParams.get('campaignId') ?? '')
  const [failedDeliveries, setFailedDeliveries] = useState<BroadcastAudienceResult['failed']>([])
  const [deliveryWarnings, setDeliveryWarnings] = useState<BroadcastAudienceResult['warnings']>([])
  const [suppressedDeliveryCount, setSuppressedDeliveryCount] = useState(0)
  const draftLoadingKey = useRef('')
  const restoredDraftKey = useRef('')
  const queryClient = useQueryClient()
  const isCustomerContext = getAppMode() === 'customer'
  const activeCustomer = session?.currentOrganization
  const customerId = isCustomerContext ? activeCustomer?.id || session?.orgId || '' : customerIdState

  const canSend = Boolean(session?.permissions.messaging?.broadcast)
  const customersQuery = useQuery({
    queryKey: ['customer-broadcast', 'customers'],
    queryFn: () => getCustomersListRequest({ contractId: null }),
    enabled: canSend && !isCustomerContext,
  })
  const customers = customersQuery.data ?? []
  const selectedCustomer = customers.find((customer) => customer.id === customerId)
    ?? (isCustomerContext && activeCustomer ? { id: activeCustomer.id, name: activeCustomer.name } : undefined)

  const locationsQuery = useQuery({
    queryKey: ['customer-broadcast', customerId, 'locations'],
    queryFn: () => getAllLocationsForCustomerRequest(customerId),
    enabled: Boolean(customerId && canSend),
  })
  const locations = locationsQuery.data ?? []
  const filters = useMemo<BroadcastAudienceFilters>(() => ({ locationIds, activity }), [locationIds, activity])

  const audienceQuery = useQuery({
    queryKey: ['customer-broadcast', customerId, 'audience', filters],
    queryFn: () => getCustomerBroadcastAudienceRequest(customerId, filters),
    enabled: Boolean(customerId && canSend),
  })
  const detailQuery = useQuery({
    queryKey: ['customer-broadcast', 'campaigns', selectedBroadcastId],
    queryFn: () => getBroadcastCampaignDetailRequest(selectedBroadcastId),
    enabled: Boolean(selectedBroadcastId && canSend && mode === 'DETAIL'),
  })
  const whatsappTemplatesQuery = useQuery({
    queryKey: ['customer-broadcast', customerId, 'whatsapp-templates'],
    queryFn: () => getApprovedWhatsappTemplatesRequest(customerId),
    enabled: Boolean(customerId && canSend && sendWhatsappTemplate && selectedChannels.includes('WHATSAPP')),
  })
  const whatsappTemplateLibraryQuery = useQuery({
    queryKey: ['customer-broadcast', customerId, 'whatsapp-template-library', libraryLanguage, librarySearch],
    queryFn: () => getWhatsappTemplateLibraryRequest(customerId, libraryLanguage, librarySearch),
    enabled: Boolean(customerId && canSend && showTemplateLibrary && sendWhatsappTemplate && selectedChannels.includes('WHATSAPP')),
  })
  const approvedWhatsappTemplates = whatsappTemplatesQuery.data ?? []
  const selectedWhatsappTemplate = approvedWhatsappTemplates.find((template) => template.name === whatsappTemplateName && template.language === whatsappTemplateLanguage)
  const templateBodyParameterNames = selectedWhatsappTemplate?.bodyParameterNames?.length
    ? selectedWhatsappTemplate.bodyParameterNames
    : Array.from({ length: selectedWhatsappTemplate?.bodyParameterCount ?? 0 }, (_, index) => String(index + 1))
  const enteredWhatsappTemplateValues = whatsappTemplateParameters.split('\n').map((value) => value.trim())
  const whatsappTemplateBodyParameterValues = selectedWhatsappTemplate
    ? enteredWhatsappTemplateValues.slice(0, selectedWhatsappTemplate.bodyParameterCount)
    : enteredWhatsappTemplateValues.filter(Boolean)
  const libraryTemplates = whatsappTemplateLibraryQuery.data ?? []
  const selectedLibraryTemplate = libraryTemplates.find((template) => `${template.name}::${template.language}` === selectedLibraryTemplateKey)
  const recipients = audienceQuery.data?.items ?? EMPTY_RECIPIENTS
  const filteredRecipients = useMemo(() => {
    const search = recipientSearch.trim().toLocaleLowerCase()
    if (!search) return recipients
    return recipients.filter((recipient) => [recipient.userName, recipient.email, recipient.phone, recipient.channelLabel]
      .some((value) => value?.toLocaleLowerCase().includes(search)),
    )
  }, [recipientSearch, recipients])
  const sendMutation = useMutation({
    mutationFn: () => sendCustomerBroadcastRequest({
      customerId,
      name: campaignName,
      idempotencyKey: campaignRequestKey,
      draftId: draftId || undefined,
      recipientIds: selectedRecipientIds,
      filters,
      channels: selectedChannels,
      emailSubject,
      message,
      files,
      buttons: replyButtons.map((label) => label.trim()).filter(Boolean).map((label) => ({ label })),
      whatsappTemplate: sendWhatsappTemplate && selectedChannels.includes('WHATSAPP') && whatsappTemplateName.trim()
        ? {
            name: whatsappTemplateName.trim(),
            language: whatsappTemplateLanguage.trim(),
            bodyParameters: whatsappTemplateBodyParameterValues,
            bodyParameterNames: templateBodyParameterNames.some((name) => !/^\d+$/.test(name))
              ? templateBodyParameterNames
              : whatsappTemplateParameterNames.split(',').map((value) => value.trim()).filter(Boolean),
            headerImage: whatsappTemplateHeaderImage,
          }
        : undefined,
    }),
    onSuccess: (result) => {
      try { sessionStorage.removeItem(CAMPAIGN_KEY_STORAGE) } catch { /* Ignore unavailable session storage. */ }
      setFailedDeliveries(result.failed)
      setDeliveryWarnings(result.warnings ?? [])
      setSuppressedDeliveryCount(result.suppressed?.length ?? 0)
      void queryClient.invalidateQueries({ queryKey: ['customer-broadcast', 'campaigns'] })
      if (result.inProgress) {
        toast.info('This campaign is already being processed. No duplicate messages were sent.')
      } else if (result.failed.length) {
        toast.warning(`Accepted by the notification queue: ${result.channelsAccepted}/${result.channelsTotal} chat messages and ${result.emailsAccepted}/${result.emailsTotal} emails.`)
      } else if (result.warnings?.length) {
        toast.warning(`Another WhatsApp message failed for ${result.warnings.length} recipient(s); the template or regular message was accepted.`)
      } else {
        toast.success(`Accepted by the notification queue: ${result.channelsAccepted} chat messages and ${result.emailsAccepted} emails.`)
      }
      setMessage('')
      setCampaignName('')
      setEmailSubject('')
      setTestEmail('')
      setReplyButtons([])
      setFiles([])
      restoredDraftKey.current = ''
      setDraftId('')
      setDraftSavedAt(null)
      setSendWhatsappTemplate(false)
      setWhatsappTemplateName('')
      setWhatsappTemplateLanguage('')
      setWhatsappTemplateParameters('')
      setWhatsappTemplateParameterNames('')
      setWhatsappTemplateHeaderImage(false)
      setSelectedBroadcastId(result.campaignId)
      setMode('DETAIL')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not send the message.'),
  })
  const sendTestEmailMutation = useMutation({
    mutationFn: () => sendCustomerBroadcastTestEmailRequest({ customerId, to: testEmail, subject: emailSubject, message, files }),
    onSuccess: ({ to, unsubscribeLinkIncluded }) => toast.success(
      unsubscribeLinkIncluded
        ? `Test email queued for ${to}, with the unsubscribe link.`
        : `Test email queued for ${to}. No unsubscribe link: this address is not a user of this customer.`,
    ),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not send the test email.'),
  })
  const retryCampaignMutation = useMutation({
    mutationFn: retryBroadcastCampaignRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['customer-broadcast', 'campaigns'] })
      toast.success(`Retried ${result.retried} failed delivery(s): ${result.sent} sent, ${result.failed} still failed.`)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not retry the campaign.'),
  })
  const importLibraryTemplateMutation = useMutation({
    mutationFn: () => {
      if (!selectedLibraryTemplate) throw new Error('Choose a template from the library first.')
      const dynamicButtons = selectedLibraryTemplate.buttons
        .map((button, index) => ({ button, index }))
        .filter(({ button }) => ['URL', 'PHONE_NUMBER'].includes(button.type.toUpperCase()))
      if (dynamicButtons.some(({ button, index }) => button.type.toUpperCase() === 'URL' && !libraryButtonValues[index]?.baseUrl?.trim())) {
        throw new Error('Enter a base URL for every URL button.')
      }
      if (dynamicButtons.some(({ button, index }) => button.type.toUpperCase() === 'PHONE_NUMBER' && !libraryButtonValues[index]?.phoneNumber?.trim())) {
        throw new Error('Enter a phone number for every phone button.')
      }
      const unsupported = selectedLibraryTemplate.buttons.some((button) => !['URL', 'PHONE_NUMBER', 'QUICK_REPLY'].includes(button.type.toUpperCase()))
      if (unsupported) throw new Error('This library template has a button type that is not supported by the campaign importer. Choose another template or add it in WhatsApp Manager.')
      const buttonInputs = dynamicButtons.map(({ button, index }) => button.type.toUpperCase() === 'URL'
        ? {
            type: 'URL',
            url: {
              base_url: libraryButtonValues[index]?.baseUrl?.trim(),
              ...(libraryButtonValues[index]?.urlSuffixExample?.trim() ? { url_suffix_example: libraryButtonValues[index].urlSuffixExample.trim() } : {}),
            },
          }
        : { type: 'PHONE_NUMBER', phone_number: libraryButtonValues[index]?.phoneNumber?.trim() },
      )
      return createWhatsappTemplateFromLibraryRequest({
        customerId,
        name: libraryTemplateName.trim(),
        libraryTemplateName: selectedLibraryTemplate.name,
        language: selectedLibraryTemplate.language,
        buttonInputs,
      })
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['customer-broadcast', customerId, 'whatsapp-templates'] })
      if (result.status === 'APPROVED') {
        setWhatsappTemplateName(result.name)
        setWhatsappTemplateLanguage(result.language)
        setWhatsappTemplateParameters(Array.from({ length: selectedLibraryTemplate?.bodyParameterCount ?? 0 }, () => '').join('\n'))
        toast.success('Template added and ready to use.')
      } else {
        toast.info(`Template added to this customer’s WhatsApp account with status ${result.status}. It will appear for sending when approved.`)
      }
      setShowTemplateLibrary(false)
      setSelectedLibraryTemplateKey('')
      setLibraryTemplateName('')
      setLibraryButtonValues({})
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not add the library template.'),
  })

  useEffect(() => {
    const next = new URLSearchParams()
    if (mode === 'DETAIL' && selectedBroadcastId) next.set('campaignId', selectedBroadcastId)
    else if (mode === 'CREATE' && customerId) next.set('customerId', customerId)
    setSearchParams(next, { replace: true })
  }, [customerId, mode, selectedBroadcastId, setSearchParams])

  useEffect(() => {
    if (mode !== 'CREATE' || !customerId) return
    let active = true
    draftLoadingKey.current = customerId
    void getCustomerBroadcastDraftRequest(customerId)
      .then(async (draft) => {
        if (!active) return
        if (draft) {
          const data = draft.filters as Record<string, any>
          const restoredFiles = await Promise.all(draft.media.map(async (item, index) => {
            const blob = await getCustomerBroadcastDraftMediaRequest(customerId, draft.id, index)
            return new File([blob], item.name, { type: item.mimeType })
          }))
          if (!active) return
          restoredDraftKey.current = customerId
          setDraftId(draft.id)
          setCampaignName(draft.name ?? '')
          setLocationIds(data.locationIds ?? [])
          setActivity(data.activity ?? 'ALL')
          setSelectedRecipientIds(data.selectedRecipientIds ?? [])
          setSelectedChannels(data.selectedChannels ?? ['WHATSAPP', 'TELEGRAM', 'EMAIL'])
          setEmailSubject(data.emailSubject ?? '')
          setTestEmail(data.testEmail ?? '')
          setMessage(draft.message ?? '')
          setReplyButtons(data.replyButtons ?? [])
          setFiles(restoredFiles)
          setSendWhatsappTemplate(data.sendWhatsappTemplate ?? false)
          setWhatsappTemplateName(data.whatsappTemplateName ?? '')
          setWhatsappTemplateLanguage(data.whatsappTemplateLanguage ?? '')
          setWhatsappTemplateParameters(data.whatsappTemplateParameters ?? '')
          setWhatsappTemplateParameterNames(data.whatsappTemplateParameterNames ?? '')
          setWhatsappTemplateHeaderImage(data.whatsappTemplateHeaderImage ?? false)
          setDraftSavedAt(draft.updatedAt)
          toast.info('Draft restored. You can continue where you left off.')
        }
      })
      .catch(() => { if (active) toast.error('Could not load the saved campaign draft.') })
      .finally(() => { if (active && draftLoadingKey.current === customerId) draftLoadingKey.current = '' })
    return () => { active = false }
  }, [customerId, mode])

  useEffect(() => {
    restoredDraftKey.current = ''
    draftLoadingKey.current = ''
    setDraftId('')
    setDraftSavedAt(null)
    setMessage('')
    setCampaignName('')
    setEmailSubject('')
    setTestEmail('')
    setFiles([])
    setLocationIds([])
    setSelectedRecipientIds([])
    setFailedDeliveries([])
    setDeliveryWarnings([])
    setSuppressedDeliveryCount(0)
    setSendWhatsappTemplate(false)
    setWhatsappTemplateName('')
    setWhatsappTemplateLanguage('')
    setWhatsappTemplateParameters('')
    setWhatsappTemplateParameterNames('')
    setWhatsappTemplateHeaderImage(false)
    setReplyButtons([])
    setShowTemplateLibrary(false)
    setSelectedLibraryTemplateKey('')
    setLibraryTemplateName('')
    setLibraryButtonValues({})
  }, [customerId])

  useEffect(() => {
    if (draftLoadingKey.current === customerId || restoredDraftKey.current === customerId) return
    setSelectedRecipientIds(recipients.map((recipient) => recipient.id))
    setFailedDeliveries([])
  }, [customerId, recipients])

  const saveDraft = async () => {
    if (!customerId) return toast.error('Select a customer before saving a draft.')
    if (!campaignName.trim()) return toast.error('Enter a campaign name before saving the draft.')
    const draft = {
      name: campaignName.trim(),
      locationIds,
      activity,
      selectedRecipientIds,
      selectedChannels,
      emailSubject,
      testEmail,
      message,
      replyButtons,
      sendWhatsappTemplate,
      whatsappTemplateName,
      whatsappTemplateLanguage,
      whatsappTemplateParameters,
      whatsappTemplateParameterNames,
      whatsappTemplateHeaderImage,
    }
    try {
      const saved = await saveCustomerBroadcastDraftRequest(customerId, draft, files)
      setDraftId(saved.id)
      setDraftSavedAt(saved.updatedAt)
      restoredDraftKey.current = customerId
      toast.success('Campaign draft saved.')
      void queryClient.invalidateQueries({ queryKey: ['customer-broadcast', 'campaigns'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the campaign draft.')
    }
  }

  const removeDraft = async () => {
    if (!customerId || !draftId) return
    try {
      await deleteCustomerBroadcastDraftRequest(customerId)
      setDraftId('')
      setDraftSavedAt(null)
      restoredDraftKey.current = customerId
      void queryClient.invalidateQueries({ queryKey: ['customer-broadcast', 'campaigns'] })
      toast.success('Campaign draft deleted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the campaign draft.')
    }
  }

  const filteredCustomers = useMemo(() => {
    const normalized = customerSearch.trim().toLowerCase()
    return normalized
      ? customers.filter((customer) => customer.name?.toLowerCase().includes(normalized))
      : customers
  }, [customerSearch, customers])

  const loadCampaigns = useCallback((state: DataTableState<BroadcastHistoryItem>) => getBroadcastCampaignsRequest(state), [])
  const openCampaign = useCallback((campaign: BroadcastHistoryItem) => {
    if (campaign.status === 'DRAFT') {
      setCustomerId(campaign.customerId)
      setMode('CREATE')
      return
    }
    setSelectedBroadcastId(campaign.id)
    setMode('DETAIL')
  }, [])
  const campaignColumns = useMemo(() => getCampaignColumns(openCampaign), [openCampaign])
  const backToCampaignList = () => {
    setMode('LIST')
    setSelectedBroadcastId('')
    setCustomerId('')
  }

  const selectedRecipients = recipients.filter((recipient) => selectedRecipientIds.includes(recipient.id))
  const selectedChatCount = selectedRecipients.filter((recipient) => selectedChannels.includes(recipient.channel)).length
  const selectedWhatsappRecipients = selectedChannels.includes('WHATSAPP')
    ? selectedRecipients.filter((recipient) => recipient.channel === 'WHATSAPP')
    : []
  const selectedWhatsappOutsideWindow = selectedWhatsappRecipients.filter((recipient) => !recipient.whatsappWindowOpen).length
  const selectedEmailCount = selectedChannels.includes('EMAIL')
    ? new Set(selectedRecipients.filter((recipient) => recipient.email && !recipient.emailInvalid).map((recipient) => recipient.userId)).size
    : 0
  const availableEmailCount = new Set(recipients.filter((recipient) => recipient.email && !recipient.emailInvalid).map((recipient) => recipient.userId)).size
  const allSelected = filteredRecipients.length > 0 && filteredRecipients.every((recipient) => selectedRecipientIds.includes(recipient.id))
  const toggleAll = () => setSelectedRecipientIds((current) => allSelected
    ? current.filter((id) => !filteredRecipients.some((recipient) => recipient.id === id))
    : [...new Set([...current, ...filteredRecipients.map((recipient) => recipient.id)])],
  )
  const toggleRecipient = (recipientId: string) => setSelectedRecipientIds((current) =>
    current.includes(recipientId) ? current.filter((id) => id !== recipientId) : [...current, recipientId],
  )
  const toggleLocation = (locationId: string) => {
    setLocationIds((current) => current.includes(locationId)
      ? current.filter((id) => id !== locationId)
      : [...current, locationId],
    )
  }
  const toggleChannel = (channel: BroadcastChannel) => {
    const next = selectedChannels.includes(channel)
      ? selectedChannels.filter((item) => item !== channel)
      : [...selectedChannels, channel]
    setSelectedChannels(next)
    if (!next.some((item) => item === 'WHATSAPP' || item === 'TELEGRAM')) setReplyButtons([])
  }
  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const next = [...files]
    for (const file of Array.from(incoming)) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        toast.error(`${file.name}: choose a JPEG or PNG image.`)
        continue
      }
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error(`${file.name}: images must be 5 MB or smaller.`)
        continue
      }
      if (next.length >= MAX_IMAGE_COUNT) {
        toast.error(`Attach up to ${MAX_IMAGE_COUNT} images.`)
        break
      }
      next.push(file)
    }
    setFiles(next)
  }

  const handleSend = () => {
    if (sendMutation.isPending) return
    if (!campaignName.trim()) return toast.error('Enter a campaign name.')
    if (!selectedRecipientIds.length) return toast.error('Select at least one recipient.')
    if (!selectedChannels.length) return toast.error('Select at least one channel.')
    if (selectedChannels.includes('EMAIL') && !emailSubject.trim()) return toast.error('Enter an email subject.')
    if (selectedWhatsappOutsideWindow && !sendWhatsappTemplate) {
      return toast.error(`${selectedWhatsappOutsideWindow} WhatsApp recipient(s) need an approved template because their last message was over 24 hours ago.`)
    }
    if (sendWhatsappTemplate && selectedChannels.includes('WHATSAPP') && !whatsappTemplateName.trim()) {
      return toast.error('Enter the approved WhatsApp template name.')
    }
    if (sendWhatsappTemplate && selectedChannels.includes('WHATSAPP') && !whatsappTemplateLanguage.trim()) {
      return toast.error('Enter the approved WhatsApp template language.')
    }
    if (sendWhatsappTemplate && selectedWhatsappTemplate) {
      const enteredValues = enteredWhatsappTemplateValues.slice(0, selectedWhatsappTemplate.bodyParameterCount)
      if (enteredValues.length !== selectedWhatsappTemplate.bodyParameterCount || enteredValues.some((value) => !value)) {
        return toast.error(`This template needs exactly ${selectedWhatsappTemplate.bodyParameterCount} body variable value(s).`)
      }
      if (selectedWhatsappTemplate.headerImage && !files.length) {
        return toast.error('This template requires an image header. Attach an image first.')
      }
    }
    if (sendWhatsappTemplate && !selectedWhatsappTemplate && whatsappTemplateParameterNames.trim()) {
      const names = whatsappTemplateParameterNames.split(',').map((value) => value.trim()).filter(Boolean)
      const values = whatsappTemplateParameters.split('\n').map((value) => value.trim()).filter(Boolean)
      if (names.length !== values.length) return toast.error('Enter one named variable for each body variable value.')
    }
    if (replyButtons.some((label) => !label.trim())) return toast.error('Complete or remove every reply button.')
    const normalizedButtons = replyButtons.map((label) => label.trim().toLocaleLowerCase())
    if (new Set(normalizedButtons).size !== normalizedButtons.length) return toast.error('Reply button labels must be unique.')
    if (replyButtons.length && !selectedChannels.some((channel) => channel === 'WHATSAPP' || channel === 'TELEGRAM')) {
      return toast.error('Reply buttons are only available for WhatsApp and Telegram.')
    }
    if (replyButtons.length && !message.trim()) return toast.error('Write a message to go with the reply buttons.')
    if (replyButtons.length && selectedWhatsappRecipients.some((recipient) => recipient.whatsappWindowOpen) && message.length > 1024) {
      return toast.error('WhatsApp messages with reply buttons must be 1,024 characters or fewer.')
    }
    if (replyButtons.length && selectedChatCount === 0) return toast.error('Select at least one WhatsApp or Telegram recipient for the reply buttons.')
    if (!message.trim() && !files.length && !(sendWhatsappTemplate && selectedChannels.includes('WHATSAPP'))) {
      return toast.error('Write a message, attach an image, or choose an approved WhatsApp template.')
    }
    if (files.reduce((total, file) => total + file.size, 0) > 25 * 1024 * 1024) {
      return toast.error('Images must total 25 MB or less.')
    }
    setFailedDeliveries([])
    setDeliveryWarnings([])
    setSuppressedDeliveryCount(0)
    sendMutation.mutate()
  }

  if (!canSend) {
    return <section className="p-6"><p className="text-sm text-muted-foreground">You do not have permission to send customer messages.</p></section>
  }

  return (
    <>
      {mode === 'DETAIL' ? (
        <CampaignDetailPage
          campaignId={selectedBroadcastId}
          detail={detailQuery.data}
          isLoading={detailQuery.isLoading}
          isError={detailQuery.isError}
          onBack={backToCampaignList}
          onRetry={() => retryCampaignMutation.mutate(selectedBroadcastId)}
          isRetrying={retryCampaignMutation.isPending}
        />
      ) : (
        <>
      <PageHeader
        title={mode === 'LIST' ? 'Message campaigns' : 'New campaign'}
        subtitle={mode === 'LIST' ? 'Review campaigns, recipients, and delivery status.' : 'Choose an audience, review recipients, and compose the message.'}
        primaryAction={mode === 'LIST'
          ? createPageHeaderAction('New campaign', () => { setCampaignRequestKey(createCampaignKey()); setSelectedBroadcastId(''); setMode('CREATE') })
          : { children: 'Back to campaigns', variant: 'outline', onClick: backToCampaignList }}
      />
      <main className="space-y-5 p-4 md:p-6">
        {mode === 'LIST' ? (
          <DataTableAsync
            queryKey={['customer-broadcast', 'campaigns', 'table']}
            loadData={loadCampaigns}
            refetchOnMount="always"
            tableKey="customer-broadcast.campaigns"
            columns={campaignColumns}
            onRowClick={openCampaign}
            disabledSelection
            searchPlaceholder={isCustomerContext ? 'Search by campaign name or ID' : 'Search by campaign name, customer or ID'}
            searchColumns={isCustomerContext ? ['id', 'name'] : ['id', 'name', 'customerName']}
            filters={[{
              id: 'status',
              label: 'Status',
              column: 'status',
              options: ['DRAFT', 'SENDING', 'SENT', 'PARTIAL', 'FAILED'],
              getValue: (campaign) => campaign.status,
            }, ...(!isCustomerContext ? [{
              id: 'customerId',
              label: 'Customer',
              column: 'customerId',
              selectionMode: 'single' as const,
              queryFn: getBroadcastCustomerOptions,
              getValue: (campaign: BroadcastHistoryItem) => campaign.customerId,
            }] : []), {
              id: 'activity',
              label: 'Audience',
              column: 'filters',
              options: ['ALL', 'CLASS_BOOKING', 'PRODUCT_PURCHASE', 'BOTH'],
              getValue: (campaign) => campaign.filters?.activity ?? 'ALL',
            }]}
            getRowCommands={(campaign) => [
              ...(campaign.counts.FAILED ? [{ label: 'Retry failed deliveries', onClick: () => retryCampaignMutation.mutate(campaign.id) }] : []),
              { label: 'View details', onClick: () => { setSelectedBroadcastId(campaign.id); setMode('DETAIL') } },
            ]}
            loadingMessage="Loading campaigns..."
            emptyMessage="No campaigns found."
            errorMessage="Failed to load campaigns."
          />
        ) : (
          <>
        <section className="rounded-xl border border-border bg-card p-5">
          <label className="grid max-w-2xl gap-1.5 text-sm font-medium">
            <span>Campaign name</span>
            <Input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} maxLength={100} placeholder="e.g. November class schedule" required />
            <span className="text-xs font-normal text-muted-foreground">Internal label shown in the campaign list; it is not sent to recipients.</span>
          </label>
        </section>
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="text-base font-semibold">Audience</h2>
            <p className="text-sm text-muted-foreground">Choose a customer, then filter their reachable contacts by location and activity.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {isCustomerContext ? (
              <div className="grid content-start gap-1.5 text-sm">
                <span className="font-medium">Customer</span>
                <p className="rounded-lg border border-input bg-muted/40 px-3 py-2">{activeCustomer?.name ?? 'Loading customer…'}</p>
              </div>
            ) : (
              <label className="grid gap-1.5 text-sm font-medium">
                <span>Customer</span>
                <Input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customers..." />
                <select
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  disabled={customersQuery.isLoading}
                >
                  <option value="">Select a customer</option>
                  {filteredCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                </select>
              </label>
            )}
            <label className="grid content-start gap-1.5 text-sm font-medium">
              <span>People</span>
              <Select value={activity} onValueChange={(value) => setActivity(value as BroadcastActivity)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Everyone who contacted this customer</SelectItem>
                  <SelectItem value="CLASS_BOOKING">Booked a class</SelectItem>
                  <SelectItem value="CLASS_PURCHASE">Purchased a class pack or membership</SelectItem>
                  <SelectItem value="CLASS_BOOKING_OR_PURCHASE">Booked or purchased a class pack</SelectItem>
                  <SelectItem value="PRODUCT_PURCHASE">Purchased a product</SelectItem>
                  <SelectItem value="BOTH">Booked a class and purchased a product</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          {customerId ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium">Locations</h3>
                  <p className="text-xs text-muted-foreground">No location selected means all locations.</p>
                </div>
                {locationIds.length ? <Button variant="ghost" size="sm" onClick={() => setLocationIds([])}>Clear location filter</Button> : null}
              </div>
              {locationsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading locations…</p> : null}
              {!locationsQuery.isLoading && locations.length ? (
                <div className="flex flex-wrap gap-2">
                  {locations.map((location) => (
                    <label key={location.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <input type="checkbox" checked={locationIds.includes(location.id)} onChange={() => toggleLocation(location.id)} />
                      {location.name}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {customerId ? (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
            <section className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                <div>
                  <h2 className="font-semibold">Recipients</h2>
                  <p className="text-sm text-muted-foreground">
                    {audienceQuery.isFetching ? 'Loading recipients…' : `${audienceQuery.data?.people ?? 0} people · ${recipients.length} chat channels · ${availableEmailCount} email addresses`}
                  </p>
                  <p className="text-xs text-muted-foreground">Users who opted out of this customer’s campaigns are excluded. Addresses marked invalid after a hard bounce are excluded from email.</p>
                  {selectedWhatsappRecipients.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      WhatsApp: {selectedWhatsappRecipients.length - selectedWhatsappOutsideWindow} direct message(s) · {selectedWhatsappOutsideWindow} approved-template fallback(s) needed.
                    </p>
                  ) : null}
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll} disabled={!filteredRecipients.length || audienceQuery.isFetching}>
                  {allSelected ? 'Deselect all' : 'Select all'}
                </Button>
              </div>
              <div className="border-b border-border p-3">
                <Input value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder="Search by name, email, or phone..." />
              </div>
              <div className="max-h-[520px] divide-y divide-border overflow-y-auto">
                {audienceQuery.isError ? <p className="p-4 text-sm text-destructive">Could not load recipients.</p> : null}
                {!audienceQuery.isFetching && !recipients.length ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No reachable contacts match these filters.</p>
                ) : null}
                {!audienceQuery.isFetching && recipients.length > 0 && !filteredRecipients.length ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No recipients match this search.</p>
                ) : null}
                {filteredRecipients.map((recipient) => (
                  <RecipientRow
                    key={recipient.id}
                    recipient={recipient}
                    checked={selectedRecipientIds.includes(recipient.id)}
                    onToggle={() => toggleRecipient(recipient.id)}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-border bg-card p-5">
              <div>
                <h2 className="font-semibold">Compose</h2>
                <p className="text-sm text-muted-foreground">Sending through {selectedChatCount} selected chat channels and {selectedEmailCount} email addresses for {selectedCustomer?.name ?? 'this customer'}.</p>
              </div>
              <fieldset className="grid gap-2 rounded-lg border border-border p-3">
                <legend className="px-1 text-sm font-medium">Delivery channels</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {([
                    ['WHATSAPP', 'WhatsApp'],
                    ['TELEGRAM', 'Telegram'],
                    ['EMAIL', 'Email'],
                  ] as const).map(([channel, label]) => (
                    <label key={channel} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedChannels.includes(channel)} onChange={() => toggleChannel(channel)} />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Email is sent once per selected person unless the address is marked invalid after a hard bounce.</p>
              </fieldset>
              {selectedChannels.includes('WHATSAPP') ? (
                <fieldset className="grid gap-3 rounded-lg border border-border p-3">
                  <legend className="px-1 text-sm font-medium">WhatsApp template</legend>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={sendWhatsappTemplate} onChange={(event) => setSendWhatsappTemplate(event.target.checked)} />
                    Use an approved template automatically outside the 24-hour window
                  </label>
                  <p className="text-xs text-muted-foreground">Ayana checks each recipient’s latest incoming WhatsApp message when sending. Contacts within 24 hours get your regular message; older conversations get only this approved template. Add a template when any selected WhatsApp contact is outside the window.</p>
                  {selectedWhatsappOutsideWindow > 0 && !sendWhatsappTemplate ? (
                    <p className="text-xs text-destructive">{selectedWhatsappOutsideWindow} selected WhatsApp contact(s) are outside the window. Enable the template fallback to send this campaign to them.</p>
                  ) : null}
                  {selectedWhatsappOutsideWindow > 0 && sendWhatsappTemplate && (files.length > Number(whatsappTemplateHeaderImage) || replyButtons.length > 0) ? (
                    <p className="text-xs text-muted-foreground">Outside the window, WhatsApp sends only the approved template and its configured header image. Other campaign images and reply buttons are sent only to contacts within 24 hours.</p>
                  ) : null}
                  <div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowTemplateLibrary((current) => !current)}>
                      {showTemplateLibrary ? 'Hide Meta template library' : 'Browse Meta template library'}
                    </Button>
                  </div>
                  {showTemplateLibrary ? (
                    <div className="grid gap-3 rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">Add a Meta utility template to {selectedCustomer?.name ?? 'this customer'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">The template is added to this customer’s WhatsApp account. Its text comes from Meta’s library and cannot be edited here.</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
                        <Input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Search templates..." />
                        <Input value={libraryLanguage} onChange={(event) => setLibraryLanguage(event.target.value)} placeholder="Language (e.g. fr)" aria-label="Template library language" />
                      </div>
                      {whatsappTemplateLibraryQuery.isError ? <p className="text-sm text-destructive">{whatsappTemplateLibraryQuery.error instanceof Error ? whatsappTemplateLibraryQuery.error.message : 'Could not load Meta’s template library.'}</p> : null}
                      {whatsappTemplateLibraryQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading Meta templates…</p> : null}
                      {!whatsappTemplateLibraryQuery.isLoading && !whatsappTemplateLibraryQuery.isError && !libraryTemplates.length ? <p className="text-sm text-muted-foreground">No utility templates were found for this language and search.</p> : null}
                      {libraryTemplates.length ? (
                        <div className="max-h-72 space-y-2 overflow-y-auto">
                          {libraryTemplates.map((template) => {
                            const key = `${template.name}::${template.language}`
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setSelectedLibraryTemplateKey(key)
                                  setLibraryTemplateName(`ayana_${template.name}`.slice(0, 512))
                                  const values: Record<number, { baseUrl?: string; urlSuffixExample?: string; phoneNumber?: string }> = {}
                                  template.buttons.forEach((button, index) => {
                                    if (button.type.toUpperCase() === 'URL') values[index] = { baseUrl: '', urlSuffixExample: '' }
                                    if (button.type.toUpperCase() === 'PHONE_NUMBER') values[index] = { phoneNumber: '' }
                                  })
                                  setLibraryButtonValues(values)
                                }}
                                className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${selectedLibraryTemplateKey === key ? 'border-primary bg-muted/40' : 'border-border'}`}
                              >
                                <span className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium">{template.name}</span>
                                  <span className="text-xs text-muted-foreground">{template.language} · {template.topic ?? 'Utility'}</span>
                                </span>
                                <span className="mt-1 block whitespace-pre-wrap text-xs text-muted-foreground">{template.body}</span>
                                {template.buttons.length ? <span className="mt-2 block text-xs">Buttons: {template.buttons.map((button) => button.text ?? button.type).join(', ')}</span> : null}
                              </button>
                            )
                          })}
                        </div>
                      ) : null}
                      {selectedLibraryTemplate ? (
                        <div className="grid gap-3 rounded-md border border-primary/30 p-3">
                          <p className="text-sm font-medium">Add “{selectedLibraryTemplate.name}” to this customer’s WhatsApp account</p>
                          <label className="grid gap-1.5 text-sm font-medium">
                            <span>Template name in WhatsApp</span>
                            <Input value={libraryTemplateName} onChange={(event) => setLibraryTemplateName(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="ayana_template_name" />
                          </label>
                          {selectedLibraryTemplate.buttons.map((button, index) => button.type.toUpperCase() === 'URL' ? (
                            <div key={`${button.type}-${index}`} className="grid gap-2 sm:grid-cols-2">
                              <label className="grid gap-1.5 text-sm font-medium"><span>URL button: {button.text ?? `Button ${index + 1}`} · base URL</span><Input value={libraryButtonValues[index]?.baseUrl ?? ''} onChange={(event) => setLibraryButtonValues((current) => ({ ...current, [index]: { ...current[index], baseUrl: event.target.value } }))} placeholder="https://ayana.club/booking" /></label>
                              <label className="grid gap-1.5 text-sm font-medium"><span>URL example (if required)</span><Input value={libraryButtonValues[index]?.urlSuffixExample ?? ''} onChange={(event) => setLibraryButtonValues((current) => ({ ...current, [index]: { ...current[index], urlSuffixExample: event.target.value } }))} placeholder="Example URL" /></label>
                            </div>
                          ) : button.type.toUpperCase() === 'PHONE_NUMBER' ? (
                            <label key={`${button.type}-${index}`} className="grid gap-1.5 text-sm font-medium"><span>Phone button: {button.text ?? `Button ${index + 1}`}</span><Input value={libraryButtonValues[index]?.phoneNumber ?? ''} onChange={(event) => setLibraryButtonValues((current) => ({ ...current, [index]: { ...current[index], phoneNumber: event.target.value } }))} placeholder="+33123456789" /></label>
                          ) : null)}
                          {selectedLibraryTemplate.buttons.some((button) => !['URL', 'PHONE_NUMBER', 'QUICK_REPLY'].includes(button.type.toUpperCase())) ? <p className="text-xs text-destructive">This template contains a button type the campaign importer cannot configure. Add it through WhatsApp Manager instead.</p> : null}
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              loading={importLibraryTemplateMutation.isPending}
                              disabled={!libraryTemplateName.trim() || selectedLibraryTemplate.buttons.some((button, index) => (button.type.toUpperCase() === 'URL' && !libraryButtonValues[index]?.baseUrl?.trim()) || (button.type.toUpperCase() === 'PHONE_NUMBER' && !libraryButtonValues[index]?.phoneNumber?.trim()) || !['URL', 'PHONE_NUMBER', 'QUICK_REPLY'].includes(button.type.toUpperCase()))}
                              onClick={() => importLibraryTemplateMutation.mutate()}
                            >
                              Add to customer WhatsApp
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {sendWhatsappTemplate ? <>
                    {whatsappTemplatesQuery.isError ? (
                      <div className="grid gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                        <p className="text-xs text-muted-foreground">{whatsappTemplatesQuery.error instanceof Error ? whatsappTemplatesQuery.error.message : 'Could not load templates from Meta.'} Enter the exact approved template name and language translation below.</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-1.5 text-sm font-medium"><span>Approved template name</span><Input value={whatsappTemplateName} onChange={(event) => setWhatsappTemplateName(event.target.value)} placeholder="Template name from WhatsApp Manager" /></label>
                          <label className="grid gap-1.5 text-sm font-medium"><span>Exact language code</span><Input value={whatsappTemplateLanguage} onChange={(event) => setWhatsappTemplateLanguage(event.target.value)} placeholder="e.g. fr_FR" /></label>
                        </div>
                        <label className="grid gap-1.5 text-sm font-medium">
                          <span>Body variables <span className="font-normal text-muted-foreground">(one value per placeholder, in order)</span></span>
                          <Textarea value={whatsappTemplateParameters} onChange={(event) => setWhatsappTemplateParameters(event.target.value)} rows={3} placeholder={'Value for {{1}}\nValue for {{2}}'} />
                        </label>
                        <label className="grid gap-1.5 text-sm font-medium">
                          <span>Named body variables <span className="font-normal text-muted-foreground">(optional, comma-separated)</span></span>
                          <Input value={whatsappTemplateParameterNames} onChange={(event) => setWhatsappTemplateParameterNames(event.target.value)} placeholder="body, first_name" />
                        </label>
                      </div>
                    ) : (
                      <label className="grid gap-1.5 text-sm font-medium">
                        <span>Approved template and language</span>
                        <Select
                          value={selectedWhatsappTemplate ? `${selectedWhatsappTemplate.name}::${selectedWhatsappTemplate.language}` : ''}
                          onValueChange={(value) => {
                            const template = approvedWhatsappTemplates.find((item) => `${item.name}::${item.language}` === value)
                            if (!template) return
                            setWhatsappTemplateName(template.name)
                            setWhatsappTemplateLanguage(template.language)
                            setWhatsappTemplateParameters(Array.from({ length: template.bodyParameterCount }, () => '').join('\n'))
                            setWhatsappTemplateParameterNames(template.bodyParameterNames?.join(', ') ?? '')
                            setWhatsappTemplateHeaderImage(template.headerImage)
                          }}
                          disabled={whatsappTemplatesQuery.isLoading || !approvedWhatsappTemplates.length}
                        >
                          <SelectTrigger className="w-full"><SelectValue placeholder={whatsappTemplatesQuery.isLoading ? 'Loading approved templates…' : 'Choose an approved template'} /></SelectTrigger>
                          <SelectContent>
                            {approvedWhatsappTemplates.map((template) => <SelectItem key={`${template.name}-${template.language}`} value={`${template.name}::${template.language}`}>{template.name} · {template.language} · {template.category}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {!whatsappTemplatesQuery.isLoading && !approvedWhatsappTemplates.length ? <span className="text-xs font-normal text-muted-foreground">No approved templates were returned by Meta for this customer.</span> : null}
                      </label>
                    )}
                    {selectedWhatsappTemplate ? <div className="space-y-2 rounded-md border p-3 text-xs">
                      <p className="font-medium">Approved template text</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{selectedWhatsappTemplate.bodyText || 'No text body.'}</p>
                    </div> : null}
                    {selectedWhatsappTemplate?.bodyParameterCount ? <div className="grid gap-3">
                      <p className="text-sm font-medium">Body variables <span className="font-normal text-muted-foreground">({selectedWhatsappTemplate.bodyParameterCount} values)</span></p>
                      {templateBodyParameterNames.map((name, index) => {
                        const values = whatsappTemplateParameters.split('\n')
                        return <label key={`${name}-${index}`} className="grid gap-1.5 text-sm font-medium">
                          <span>{`{{${name}}}`}</span>
                          <Input
                            value={values[index] ?? ''}
                            onChange={(event) => {
                              while (values.length < templateBodyParameterNames.length) values.push('')
                              values[index] = event.target.value
                              setWhatsappTemplateParameters(values.join('\n'))
                            }}
                            placeholder={`Value for {{${name}}}`}
                          />
                        </label>
                      })}
                      <span className="text-xs font-normal text-muted-foreground">Each value replaces the matching placeholder in the approved template.</span>
                    </div> : null}
                    {selectedWhatsappTemplate?.headerImage ? <>
                      <p className="text-sm">This template requires an image header; the first attached image will be used.</p>
                      {whatsappTemplateHeaderImage && !files.length ? <p className="text-xs text-destructive">Attach an image for the template header.</p> : null}
                    </> : null}
                    {whatsappTemplatesQuery.isError ? <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={whatsappTemplateHeaderImage} onChange={(event) => setWhatsappTemplateHeaderImage(event.target.checked)} />
                      This manually entered template requires an image header
                    </label> : null}
                  </> : null}
                </fieldset>
              ) : null}
              {selectedChannels.includes('EMAIL') ? (
                <div className="grid gap-3">
                  <label className="grid gap-1.5 text-sm font-medium">
                    <span>Test email address</span>
                    <Input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} maxLength={254} placeholder="you@example.com" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    <span>Email subject</span>
                    <Input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} maxLength={200} placeholder="Subject of the email" />
                  </label>
                </div>
              ) : null}
              <div className="grid gap-1.5 text-sm font-medium">
                <span>Message</span>
                <CampaignMessageEditor value={message} onChange={setMessage} maxLength={4096} />
                <span className="text-right text-xs font-normal text-muted-foreground">{message.length}/4096</span>
              </div>
              {selectedChannels.some((channel) => channel === 'WHATSAPP' || channel === 'TELEGRAM') ? (
                <fieldset className="grid gap-3 rounded-lg border border-border p-3">
                  <legend className="px-1 text-sm font-medium">Reply buttons · WhatsApp and Telegram</legend>
                  <p className="text-xs text-muted-foreground">When someone taps a button, its label is sent back as their reply. Email recipients receive the message without buttons.</p>
                  {replyButtons.map((label, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={label}
                        onChange={(event) => setReplyButtons((current) => current.map((value, buttonIndex) => buttonIndex === index ? event.target.value : value))}
                        maxLength={20}
                        placeholder={`Button ${index + 1} label`}
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => setReplyButtons((current) => current.filter((_, buttonIndex) => buttonIndex !== index))}>Remove</Button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3">
                    <Button type="button" variant="outline" size="sm" disabled={replyButtons.length >= 3} onClick={() => setReplyButtons((current) => [...current, ''])}>Add reply button</Button>
                    <span className="text-xs text-muted-foreground">{replyButtons.length}/3 · up to 20 characters each</span>
                  </div>
                </fieldset>
              ) : null}
              <label className="grid gap-1.5 text-sm font-medium">
                <span>Images <span className="font-normal text-muted-foreground">(JPEG or PNG, up to 5 images, 5 MB each)</span></span>
                <Input type="file" accept="image/jpeg,image/png" multiple onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = '' }} />
              </label>
              {files.length ? (
                <div className="space-y-2">
                  {files.map((file, index) => <AttachedImage key={`${file.name}-${file.size}-${index}`} file={file} onRemove={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} />)}
                </div>
              ) : null}
              {failedDeliveries.length ? (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium text-destructive">Some messages could not be delivered</p>
                  {failedDeliveries.map((failure) => (
                    <p key={`${failure.recipientId}-${failure.channel}`} className="text-muted-foreground">{failure.userName} · {failure.channel}: {failure.error}</p>
                  ))}
                </div>
              ) : null}
              {deliveryWarnings.length ? (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  <p className="font-medium">One WhatsApp message failed, but another message for these recipients was accepted.</p>
                  {deliveryWarnings.map((warning) => <p key={`${warning.recipientId}-${warning.channel}`} className="text-muted-foreground">{warning.userName} · {warning.channel}: {warning.warning}</p>)}
                </div>
              ) : null}
              {suppressedDeliveryCount ? (
                <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  {suppressedDeliveryCount} delivery(ies) were skipped because the recipient opted out of bulk campaigns. Transactional messages are unaffected.
                </p>
              ) : null}
              <div className="flex justify-end border-t border-border pt-3">
                <div className="flex flex-wrap justify-end gap-2">
                {draftSavedAt ? <span className="self-center pr-1 text-xs text-muted-foreground">Draft saved at {new Date(draftSavedAt).toLocaleTimeString()}</span> : null}
                {draftId ? <Button type="button" variant="outline" onClick={() => void removeDraft()}>Delete draft</Button> : null}
                <Button type="button" variant="outline" onClick={() => void saveDraft()} disabled={!customerId}>Save draft</Button>
                {selectedChannels.includes('EMAIL') ? <Button
                  type="button"
                  variant="outline"
                  onClick={() => sendTestEmailMutation.mutate()}
                  loading={sendTestEmailMutation.isPending}
                  disabled={!customerId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim()) || !emailSubject.trim() || (!message.trim() && !files.length)}
                >Send test email</Button> : null}
                <Button
                  onClick={handleSend}
                  loading={sendMutation.isPending}
                  disabled={!customerId || !selectedRecipientIds.length || !selectedChannels.length || (!message.trim() && !files.length && !(sendWhatsappTemplate && selectedChannels.includes('WHATSAPP'))) || audienceQuery.isFetching}
                >
                  Send to {selectedChatCount} chat channels + {selectedEmailCount} emails
                </Button>
                </div>
              </div>
            </section>
          </div>
        ) : !customerId ? (
          <section className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Select a customer to load their contacts.</section>
        ) : null}
          </>
        )}
      </main>
        </>
      )}
    </>
  )
}

function CampaignDetailPage({
  campaignId,
  detail,
  isLoading,
  isError,
  onBack,
  onRetry,
  isRetrying,
}: {
  campaignId: string
  detail?: BroadcastHistoryDetail
  isLoading: boolean
  isError: boolean
  onBack: () => void
  onRetry: () => void
  isRetrying: boolean
}) {
  const [historyDelivery, setHistoryDelivery] = useState<BroadcastDelivery | null>(null)
  const locationsQuery = useQuery({
    queryKey: ['customer-broadcast', detail?.customerId, 'campaign-locations'],
    queryFn: () => getAllLocationsForCustomerRequest(detail!.customerId),
    enabled: Boolean(detail?.customerId),
  })
  const locationNames = new Map((locationsQuery.data ?? []).map((location) => [location.id, location.name]))
  const sentCount = (detail?.counts.SENT ?? 0) + (detail?.counts.DELIVERED ?? 0) + (detail?.counts.READ ?? 0)
  const sideSections: DetailPanelSection[] = detail ? [{
    title: 'Campaign',
    fields: [
      { label: 'Name', value: detail.name },
      { label: 'Status', value: <CampaignStatusBadge status={detail.status} /> },
      { label: 'ID', value: detail.id },
      { label: 'Customer', value: detail.customerName ? <Link to={`/customers/${detail.customerId}`} className="underline-offset-2 hover:underline">{detail.customerName}</Link> : detail.customerId },
      { label: 'Created', value: new Date(detail.createdAt).toLocaleString() },
      { label: 'Recipients', value: detail.total },
      { label: 'Accepted by queue', value: detail.counts.ACCEPTED ?? 0 },
      { label: 'Sent', value: sentCount },
      { label: 'Failed', value: detail.counts.FAILED ?? 0 },
      { label: 'Suppressed', value: detail.counts.SUPPRESSED ?? 0 },
      { label: 'Channels', value: (detail.filters?.channels ?? []).map(channelLabel).join(', ') || 'All channels' },
      ...(detail.filters?.whatsappTemplate ? [{ label: 'WhatsApp template', value: `${detail.filters.whatsappTemplate.name} (${detail.filters.whatsappTemplate.language})` }] : []),
    ],
  }, {
    title: 'Audience',
    fields: [
      { label: 'Activity', value: activityLabel(detail.filters?.activity ?? 'ALL') },
      {
        label: 'Locations',
        value: !detail.filters?.locationIds?.length
          ? 'All locations'
          : <span className="grid gap-1">{detail.filters.locationIds.map((id) => <Link key={id} to={`/locations/${id}`} className="underline-offset-2 hover:underline">{locationNames.get(id) ?? id}</Link>)}</span>,
      },
    ],
  }] : []

  if (isLoading) {
    return <DetailPageLayout
      header={{ title: 'Campaign', subtitle: 'Loading campaign details...', leading: <BackIconButton onClick={onBack} /> }}
      aside={<DetailSidePanel sections={sideSections} isLoading />}
    ><Card className="border border-border p-0 ring-0"><CardContent className="p-6 text-sm text-muted-foreground">Loading campaign details...</CardContent></Card></DetailPageLayout>
  }

  if (isError || !detail) {
    return <>
      <PageHeader title="Campaign not found" subtitle={campaignId} leading={<BackIconButton onClick={onBack} />} />
      <section className="p-4 md:p-6"><div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Failed to load this campaign.</div></section>
    </>
  }

  return (
    <DetailPageLayout
      header={{
        title: detail.name,
        subtitle: detail.id,
        leading: <BackIconButton onClick={onBack} />,
      }}
      modules={[{ key: 'message', label: 'Message', count: detail.media.length + (detail.message ? 1 : 0) }, { key: 'deliveries', label: 'Recipients', count: detail.deliveries.length }]}
      aside={<DetailSidePanel sections={sideSections} />}
    >
      <Card id="module-message" className="border border-border p-0 ring-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b p-5">
          <CardTitle>Message</CardTitle>
          {(detail.counts.FAILED ?? 0) > 0 ? <Button variant="outline" onClick={onRetry} disabled={isRetrying}>{isRetrying ? 'Retrying…' : 'Retry failed deliveries'}</Button> : null}
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          {detail.filters?.emailSubject ? <div className="rounded-md border p-3 text-sm"><span className="font-medium">Email subject: </span>{detail.filters.emailSubject}</div> : null}
          {detail.message ? <p className="whitespace-pre-wrap text-sm">{detail.message}</p> : detail.filters?.whatsappTemplate ? <p className="text-sm text-muted-foreground">WhatsApp template campaign.</p> : <p className="text-sm text-muted-foreground">This campaign contains images only.</p>}
          {detail.filters?.whatsappTemplate ? (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">WhatsApp template: {detail.filters.whatsappTemplate.name} · {detail.filters.whatsappTemplate.language}</p>
              {detail.filters.whatsappTemplate.bodyParameters.length ? <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{detail.filters.whatsappTemplate.bodyParameters.map((value, index) => {
                const name = detail.filters?.whatsappTemplate?.bodyParameterNames?.[index]
                return name ? `{{${name}}}: ${value}` : value
              }).join('\n')}</p> : null}
              {detail.filters.whatsappTemplate.headerImage ? <p className="mt-1 text-muted-foreground">First attached image used as header.</p> : null}
            </div>
          ) : null}
          {detail.filters?.buttons?.length ? (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">WhatsApp and Telegram reply buttons</p>
              <div className="flex flex-wrap gap-2">
                {detail.filters.buttons.map((button, index) => <Badge key={`${button.label}-${index}`} variant="secondary">{button.label}</Badge>)}
              </div>
            </div>
          ) : null}
          {detail.media.length ? <div className="flex flex-wrap gap-3">{detail.media.map((media) => <a key={`${media.name}-${media.url}`} href={media.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-md border p-2 text-sm underline-offset-2 hover:underline"><img src={media.url} alt="" className="size-12 rounded object-cover" /><span>{media.name}</span></a>)}</div> : null}
          <StatusCounts counts={detail.counts} />
          <p className="text-xs text-muted-foreground">WhatsApp may report delivered/read. Telegram and email report provider acceptance.</p>
        </CardContent>
      </Card>
      <Card id="module-deliveries" className="border border-border p-0 ring-0">
        <CardHeader className="border-b p-5"><CardTitle>Recipient deliveries</CardTitle></CardHeader>
        <CardContent className="p-5">
          <DataTable
            tableData={detail.deliveries}
            columns={getCampaignDeliveryColumns(setHistoryDelivery)}
            disabledSelection
            searchPlaceholder="Search recipients, channel or destination"
            searchColumns={['recipientName', 'destination', 'channel', 'userId', 'userChannelId', 'messageId']}
            getRowId={(delivery) => delivery.id}
            emptyMessage="No delivery records found."
          />
        </CardContent>
      </Card>
      <Drawer open={Boolean(historyDelivery)} onOpenChange={(open) => { if (!open) setHistoryDelivery(null) }} direction="right">
        <DrawerContent className="data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-xl">
          <DrawerHeader className="border-b px-6 pb-4">
            <DrawerTitle>Delivery history</DrawerTitle>
            <DrawerDescription>
              {historyDelivery ? `${historyDelivery.recipientName} · ${channelLabel(historyDelivery.channel)}` : 'Provider delivery events'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
            {historyDelivery?.error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{historyDelivery.error}</p> : null}
            {historyDelivery?.events.length ? [...historyDelivery.events]
              .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
              .map((event, index) => {
                const details = event.details && typeof event.details === 'object' ? event.details as Record<string, unknown> : null
                const error = typeof details?.error === 'string' ? details.error : null
                return (
                  <div key={`${event.status}-${event.occurredAt}-${index}`} className="flex gap-3 rounded-lg border p-4">
                    <Badge variant={event.status === 'FAILED' ? 'destructive' : 'outline'}>{statusLabel(event.status)}</Badge>
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm text-muted-foreground">{new Date(event.occurredAt).toLocaleString()}</p>
                      {event.providerMessageId ? <p className="break-all text-xs text-muted-foreground">Provider message: {event.providerMessageId}</p> : null}
                      {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    </div>
                  </div>
                )
              })
              : <p className="text-sm text-muted-foreground">No provider events recorded.</p>}
          </div>
        </DrawerContent>
      </Drawer>
    </DetailPageLayout>
  )
}

function BackIconButton({ onClick }: { onClick: () => void }) {
  return <Button variant="outline" size="icon-lg" aria-label="Back to campaigns" onClick={onClick}><HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} /></Button>
}

function CampaignStatusBadge({ status }: { status: BroadcastHistoryItem['status'] }) {
  const variant = status === 'FAILED' ? 'destructive' : status === 'SENDING' || status === 'DRAFT' ? 'outline' : status === 'PARTIAL' ? 'secondary' : 'default'
  return <Badge variant={variant}>{({ DRAFT: 'Draft', SENDING: 'Sending', SENT: 'Sent', PARTIAL: 'Partial', FAILED: 'Failed' } as const)[status]}</Badge>
}

function getCampaignDeliveryColumns(onOpenHistory: (delivery: BroadcastDelivery) => void) {
  return [
  { accessorKey: 'status', header: 'Status', cell: ({ row }: { row: { original: BroadcastHistoryDetail['deliveries'][number] } }) => <Badge variant={row.original.status === 'FAILED' ? 'destructive' : 'outline'}>{statusLabel(row.original.status)}</Badge> },
  { accessorKey: 'recipientName', header: 'Recipient', cell: ({ row }: { row: { original: BroadcastHistoryDetail['deliveries'][number] } }) => <Link to={`/users/${row.original.userId}`} className="font-medium underline-offset-2 hover:underline">{row.original.recipientName}</Link> },
  { accessorKey: 'channel', header: 'Channel' },
  { accessorKey: 'destination', header: 'Destination' },
  {
    id: 'conversation',
    header: 'Conversation message',
    cell: ({ row }: { row: { original: BroadcastHistoryDetail['deliveries'][number] } }) => row.original.message
      ? <span className="grid max-w-64 gap-1">
          <span title={row.original.message.content} className="block truncate text-sm">{row.original.message.content || row.original.message.id}</span>
          <span className="text-xs text-muted-foreground">Message {row.original.messageId ?? row.original.message.id}</span>
          {row.original.userChannelId ? <span className="text-xs text-muted-foreground">Channel {row.original.userChannelId}</span> : null}
        </span>
      : row.original.channel === 'EMAIL' ? 'Email' : 'Not linked',
  },
  {
    id: 'deliveryEvents',
    header: '',
    cell: ({ row }: { row: { original: BroadcastDelivery } }) => (
      <Button type="button" variant="ghost" size="icon-sm" aria-label="View delivery history" title="View delivery history" onClick={() => onOpenHistory(row.original)}>
        <HugeiconsIcon icon={TransactionHistoryIcon} strokeWidth={2} />
      </Button>
    ),
  },
  ]
}

function activityLabel(activity: BroadcastActivity) {
  return ({ ALL: 'Everyone who contacted this customer', CLASS_BOOKING: 'Booked a class', CLASS_PURCHASE: 'Purchased a class pack or membership', CLASS_BOOKING_OR_PURCHASE: 'Booked or purchased a class pack', PRODUCT_PURCHASE: 'Purchased a product', BOTH: 'Booked a class and purchased a product' } as const)[activity]
}

function channelLabel(channel: BroadcastChannel) {
  return ({ WHATSAPP: 'WhatsApp', TELEGRAM: 'Telegram', EMAIL: 'Email' } as const)[channel]
}

function StatusCounts({ counts }: { counts: Record<string, number> }) {
  const labels = ['ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'PENDING', 'SUPPRESSED'].filter((status) => counts[status])
  return <span className="flex flex-wrap gap-1.5">{labels.map((status) => <Badge key={status} variant={status === 'FAILED' ? 'destructive' : 'outline'}>{counts[status]} {statusLabel(status)}</Badge>)}</span>
}

function statusLabel(status: string) {
  return ({ PENDING: 'Pending', ACCEPTED: 'Accepted', SENT: 'Sent', DELIVERED: 'Delivered', READ: 'Read', FAILED: 'Failed', SUPPRESSED: 'Opted out' } as Record<string, string>)[status] ?? status
}

function RecipientRow({ recipient, checked, onToggle }: { recipient: BroadcastRecipient; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/50">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{recipient.userName}</span>
        <span className="block truncate text-xs text-muted-foreground">{recipient.channelLabel}</span>
        {recipient.email ? <span className="block truncate text-xs text-muted-foreground">{recipient.email}</span> : null}
        {recipient.email && recipient.emailInvalid ? <span className="block text-xs text-amber-700">Email invalid after hard bounce · excluded from email</span> : null}
        {recipient.phone ? <span className="block truncate text-xs text-muted-foreground">{recipient.phone}</span> : null}
      </span>
      <span className="flex flex-col items-end gap-1">
        <Badge variant="outline">{recipient.channel === 'WHATSAPP' ? 'WhatsApp' : 'Telegram'}</Badge>
        {recipient.channel === 'WHATSAPP' ? <Badge variant={recipient.whatsappWindowOpen ? 'secondary' : 'destructive'}>{recipient.whatsappWindowOpen ? 'Direct · 24 h' : 'Template required'}</Badge> : null}
        <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:block">{new Date(recipient.lastContactAt).toLocaleDateString()}</span>
      </span>
    </label>
  )
}

function AttachedImage({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [previewUrl, setPreviewUrl] = useState('')
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-2">
      {previewUrl ? <img src={previewUrl} alt="" className="size-12 rounded-md object-cover" /> : null}
      <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
      <Button variant="ghost" size="sm" onClick={onRemove}>Remove</Button>
    </div>
  )
}

type BroadcastAudienceResult = Awaited<ReturnType<typeof sendCustomerBroadcastRequest>>
