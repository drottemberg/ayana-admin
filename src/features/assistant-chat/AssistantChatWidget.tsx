import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import { io, type Socket } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useConnect } from '@/features/app/use-connect'
import { readSelectedOrgId } from '@/features/organizations/storage'
import { useAuth } from '@/providers/use-auth'
import { apiClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'

type ChatButton = { id: string; label: string }
type ChatAttachment = { id: string; name: string; mimeType: string; size: number }
type ChatMessage = {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt: number | null
  format?: 'plain' | 'markdown'
  buttons?: ChatButton[]
  selectOptions?: ChatButton[]
  attachments?: ChatAttachment[]
}
type ChatAck = {
  ok: boolean
  error?: string
  messages?: ChatMessage[]
  isTyping?: boolean
  appContext?: string
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

function socketUrl(): string {
  const configuredUrl = import.meta.env.VITE_SOCKET_URL
  if (configuredUrl) return configuredUrl
  return new URL(API_URL, window.location.origin).origin
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp))
}

export function AssistantChatWidget() {
  const { token, logout } = useAuth()
  const { session } = useConnect()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState('')
  const [draftAttachments, setDraftAttachments] = useState<ChatAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [typing, setTyping] = useState(false)
  const [appContext, setAppContext] = useState('')
  const [error, setError] = useState('')
  const [openDrawer, setOpenDrawer] = useState<HTMLElement | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const selectedOrganizationId = session?.orgId ?? readSelectedOrgId()
  const handleUnauthorized = useCallback(async () => {
    const refreshed = await apiClient.refreshSession()
    if (!refreshed && !apiClient.getAuthToken()) await logout()
  }, [logout])

  useEffect(() => {
    const syncDrawer = () => {
      const drawers = document.querySelectorAll<HTMLElement>('[data-slot="drawer-content"][data-state="open"]')
      const topDrawer = drawers.item(drawers.length - 1) ?? null
      setOpenDrawer((current) => current === topDrawer ? current : topDrawer)
    }

    syncDrawer()
    const observer = new MutationObserver(syncDrawer)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-state'],
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!open || !token) return

    const socket = io(`${socketUrl()}/messaging`, {
      path: '/api/socket.io',
      auth: { token, organizationId: selectedOrganizationId, languageCode: navigator.language },
      reconnection: true,
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket
    setConnecting(true)
    setConnected(false)
    setError('')

    socket.on('connect', () => {
      setConnected(true)
      setConnecting(false)
      socket.emit('chat:history', (response: ChatAck) => {
        if (!response?.ok) {
          setError(response?.error ?? 'Could not load your conversation.')
          return
        }
        setMessages(response.messages ?? [])
        setTyping(Boolean(response.isTyping))
      })
    })
    socket.on('chat:ready', (response: { appContext?: string }) => {
      if (response.appContext) setAppContext(response.appContext)
    })
    socket.on('chat:message', (message: ChatMessage) => {
      setMessages((current) => {
        const existingIndex = current.findIndex((item) => item.id === message.id)
        if (existingIndex < 0) return [...current, message]
        return current.map((item, index) => (index === existingIndex ? message : item))
      })
      setError('')
    })
    socket.on('chat:typing', (response: { isTyping?: boolean }) => setTyping(Boolean(response?.isTyping)))
    socket.on('chat:error', (response: { error?: string; unauthorized?: boolean }) => {
      setError(response?.error ?? 'Something went wrong. Please try again.')
      setTyping(false)
      if (response?.unauthorized) void handleUnauthorized()
    })
    socket.on('disconnect', () => {
      setConnected(false)
      setConnecting(false)
      setTyping(false)
    })
    socket.on('connect_error', (connectionError: Error) => {
      setConnected(false)
      setConnecting(false)
      if (connectionError.message === 'Unauthorized') {
        setError('Refreshing your session…')
        void handleUnauthorized()
      } else {
        setError('Could not connect to chat.')
      }
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [handleUnauthorized, open, selectedOrganizationId, token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, typing, open])

  const sendMessage = useCallback(
    (content: string) => {
      const normalized = content.trim()
      const socket = socketRef.current
      if ((!normalized && !draftAttachments.length) || !socket?.connected || typing || uploading) return

      setError('')
      socket.emit(
        'chat:send',
        {
          content: normalized,
          attachmentIds: draftAttachments.map((attachment) => attachment.id),
        },
        (response: ChatAck) => {
          if (!response?.ok) {
            setError(response?.error ?? 'Message could not be sent.')
            return
          }
          setDraft('')
          setDraftAttachments([])
        },
      )
    },
    [draftAttachments, typing, uploading],
  )

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length || !token) return
    const selected = Array.from(files)
    if (draftAttachments.length + selected.length > 5) {
      setError('You can attach up to 5 files to a message.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      selected.forEach((file) => form.append('files', file))
      const response = await fetch(`${API_URL}/messaging/web-chat/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'x-app-context': 'ADMIN' },
        body: form,
      })
      if (response.status === 401) {
        const refreshed = await apiClient.refreshSession()
        if (!refreshed && !apiClient.getAuthToken()) await logout()
        throw new Error(
          refreshed ? 'Your session was refreshed. Please retry the upload.' : 'Your session expired. Sign in again.',
        )
      }
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(typeof payload?.message === 'string' ? payload.message : 'Files could not be uploaded.')
      }
      setDraftAttachments((current) => [...current, ...(Array.isArray(payload) ? payload : [])])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Files could not be uploaded.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendMessage(draft)
  }

  if (!token) return null

  const widget = (
    <div className="fixed right-5 bottom-5 z-[80] flex flex-col items-end gap-3">
      {open ? (
        <section
          aria-label="Ayana assistant chat"
          className="flex h-[min(640px,calc(100dvh-7rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
          role="dialog"
          aria-modal="false"
        >
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div className="min-w-0">
              <h2 className="font-semibold">Ayana assistant</h2>
              <p className="text-xs text-muted-foreground">
                {appContext
                  ? `${appContext} context`
                  : connecting
                    ? 'Connecting…'
                    : connected
                      ? 'Connected'
                      : 'Offline'}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Close chat" onClick={() => setOpen(false)}>
              <CloseIcon />
            </Button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {!messages.length && !connecting ? (
              <div className="mx-auto mt-10 max-w-[260px] text-center text-sm text-muted-foreground">
                Ask Ayana a question or tell it what you would like to manage.
              </div>
            ) : null}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn('flex flex-col gap-1', message.role === 'USER' ? 'items-end' : 'items-start')}
              >
                <div
                  className={cn(
                    'max-w-[88%] rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap',
                    message.role === 'USER'
                      ? 'rounded-br-md bg-primary text-primary-foreground'
                      : 'rounded-bl-md bg-muted text-foreground',
                  )}
                >
                  {message.format === 'markdown' && message.role === 'ASSISTANT' ? (
                    <div className="[&_a]:underline [&_a]:underline-offset-2 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:font-semibold [&_li]:ml-4 [&_ol]:my-2 [&_ol]:list-decimal [&_p+p]:mt-2 [&_ul]:my-2 [&_ul]:list-disc">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
                {message.attachments?.length ? (
                  <div className="flex max-w-[95%] flex-col gap-2">
                    {message.attachments.map((attachment) => (
                      <ChatAttachmentPreview
                        key={attachment.id}
                        attachment={attachment}
                        token={token}
                        onUnauthorized={handleUnauthorized}
                      />
                    ))}
                  </div>
                ) : null}
                {message.selectOptions?.length ? (
                  <select
                    aria-label="Choose an option"
                    className="h-9 max-w-[95%] rounded-lg border bg-background px-3 text-sm text-foreground shadow-sm"
                    value={selectedOptions[message.id] ?? ''}
                    disabled={!connected || typing || Boolean(selectedOptions[message.id])}
                    onChange={(event) => {
                      const option = message.selectOptions?.find((item) => item.id === event.target.value)
                      if (!option) return
                      setSelectedOptions((current) => ({ ...current, [message.id]: option.id }))
                      sendMessage(option.label)
                    }}
                  >
                    <option value="" disabled>
                      Select an option…
                    </option>
                    {message.selectOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {message.buttons?.length ? (
                  <div className="flex max-w-[95%] flex-wrap gap-1.5 pt-1">
                    {message.buttons.map((button) => (
                      <Button
                        key={button.id}
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-7 rounded-full px-3 py-1 text-left whitespace-normal"
                        onClick={() => {
                          if (button.id.startsWith('link:')) {
                            window.open(button.id.slice(5), '_blank', 'noopener,noreferrer')
                          } else {
                            sendMessage(button.label)
                          }
                        }}
                        disabled={!connected || typing}
                      >
                        {button.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
                {message.createdAt ? (
                  <span className="px-1 text-[10px] text-muted-foreground">{formatTime(message.createdAt)}</span>
                ) : null}
              </div>
            ))}
            {typing ? (
              <div className="w-fit rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="flex gap-1">
                    <i className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
                    <i className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
                    <i className="size-1.5 animate-bounce rounded-full bg-current" />
                  </span>{' '}
                  Thinking
                </span>
              </div>
            ) : null}
            {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
            <div ref={bottomRef} />
          </div>

          <form className="border-t p-3" onSubmit={onSubmit}>
            {draftAttachments.length ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {draftAttachments.map((attachment) => (
                  <span
                    key={attachment.id}
                    className="flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                  >
                    <span className="max-w-56 truncate">{attachment.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${attachment.name}`}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={async () => {
                        try {
                          const response = await fetch(
                            `${API_URL}/messaging/web-chat/attachments/${encodeURIComponent(attachment.id)}`,
                            {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${token}`, 'x-app-context': 'ADMIN' },
                            },
                          )
                          if (response.status === 401) {
                            handleUnauthorized()
                            return
                          }
                          if (!response.ok) throw new Error('Attachment could not be removed.')
                          setDraftAttachments((current) => current.filter((item) => item.id !== attachment.id))
                        } catch (removeError) {
                          setError(
                            removeError instanceof Error ? removeError.message : 'Attachment could not be removed.',
                          )
                        }
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                className="hidden"
                onChange={(event) => void uploadFiles(event.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Attach photos or PDF files"
                disabled={!connected || typing || uploading || draftAttachments.length >= 5}
                onClick={() => fileInputRef.current?.click()}
              >
                <AttachIcon />
              </Button>
              <Textarea
                aria-label="Write a message"
                className="max-h-32 min-h-10 resize-none text-sm"
                placeholder={connected ? 'Write a message…' : 'Connecting to chat…'}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    sendMessage(draft)
                  }
                }}
                disabled={!connected || typing || uploading}
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                disabled={!connected || typing || uploading || (!draft.trim() && !draftAttachments.length)}
              >
                {uploading ? '…' : <SendIcon />}
              </Button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Photos (JPEG, PNG, WebP) or PDF · max 10 MB each, 5 per message
            </p>
            <p className="text-[10px] text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
          </form>
        </section>
      ) : null}

      <Button
        size="icon-lg"
        className="size-14 rounded-full shadow-lg"
        aria-label={open ? 'Close assistant chat' : 'Open assistant chat'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </Button>
    </div>
  )

  // Vaul makes the rest of the page inert while a drawer is open. Keeping the
  // widget inside the top drawer lets the chat remain clickable and focusable.
  return openDrawer ? createPortal(widget, openDrawer) : widget
}

function ChatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.7-3.3A7.4 7.4 0 0 1 4.5 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />
      <path d="M8.5 11.5h7M8.5 14.5h4" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8">
      <path d="m21 3-7.2 18-3.9-7.9L2 9.2 21 3Z" />
      <path d="M9.9 13.1 21 3" />
    </svg>
  )
}

function AttachIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8">
      <path d="m20.5 11.5-8.9 8.9a5 5 0 0 1-7.1-7.1l9.2-9.2a3.3 3.3 0 0 1 4.7 4.7l-9.2 9.2a1.7 1.7 0 0 1-2.4-2.4l8.5-8.5" />
    </svg>
  )
}

function ChatAttachmentPreview({
  attachment,
  token,
  onUnauthorized,
}: {
  attachment: ChatAttachment
  token: string
  onUnauthorized: () => void
}) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl = ''
    let cancelled = false
    fetch(`${API_URL}/messaging/web-chat/attachments/${encodeURIComponent(attachment.id)}/content`, {
      headers: { Authorization: `Bearer ${token}`, 'x-app-context': 'ADMIN' },
    })
      .then(async (response) => {
        if (response.status === 401) {
          onUnauthorized()
          throw new Error('Unauthorized')
        }
        if (!response.ok) throw new Error('Unable to load attachment')
        return response.blob()
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        if (!cancelled) setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment.id, onUnauthorized, token])

  if (failed) return <span className="rounded-lg bg-muted px-3 py-2 text-xs">{attachment.name}</span>
  if (!url)
    return (
      <span className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Loading {attachment.name}…</span>
    )
  if (attachment.mimeType.startsWith('image/')) {
    return <img src={url} alt={attachment.name} className="max-h-56 max-w-full rounded-lg object-contain" />
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="max-w-full truncate rounded-lg bg-muted px-3 py-2 text-xs underline underline-offset-2"
    >
      {attachment.name} · Open PDF
    </a>
  )
}
