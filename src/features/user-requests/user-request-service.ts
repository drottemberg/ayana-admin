import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import {
  acceptUserRequestRequest,
  cancelUserRequestRequest,
  rejectUserRequestRequest,
} from '@/features/user-requests/api'
import { userRequestsQueryKeys } from '@/features/user-requests/query-keys'
import { queryClient } from '@/lib/query-client'
import { Modals } from '@/providers/modal'
import { UserRequestStatus, UserRequestType, type UserRequest } from '@/types/user-request'

export const UserRequestTab = {
  ALL: 'all',
  RECEIVED: 'received',
  SENT: 'sent',
} as const

export type UserRequestTab = (typeof UserRequestTab)[keyof typeof UserRequestTab]

const statusLabel: Record<UserRequestStatus, string> = {
  [UserRequestStatus.PENDING]: 'Pending',
  [UserRequestStatus.ACCEPTED]: 'Accepted',
  [UserRequestStatus.REJECTED]: 'Rejected',
  [UserRequestStatus.CANCELLED]: 'Cancelled',
}

const typeLabel: Record<UserRequestType, string> = {
  [UserRequestType.GENERIC]: 'Generic',
  [UserRequestType.ORG_INVITE]: 'Organization invite',
}

async function runRequestAction(operation: string, action: () => Promise<UserRequest>, destructive = false) {
  const confirmed = await Modals.confirm({
    operation,
    okButtonProps: { variant: destructive ? 'destructive' : 'default' },
  })
  if (!confirmed) return

  await action()
  await queryClient.invalidateQueries({ queryKey: userRequestsQueryKeys.all })
}

export const UserRequestService = {
  filterByTab(requests: UserRequest[], tab: UserRequestTab): UserRequest[] {
    if (tab === UserRequestTab.RECEIVED) return requests.filter((request) => !request.isSent)
    if (tab === UserRequestTab.SENT) return requests.filter((request) => request.isSent)

    return requests
  },

  statusToString(status: UserRequestStatus): string {
    return statusLabel[status] ?? status
  },

  typeToString(type: UserRequestType): string {
    return typeLabel[type] ?? type
  },

  getContactText(request: UserRequest): string {
    if (request.isSent) {
      return request.recipients.map((r) => r.displayName ?? r.value).join(', ') || '-'
    }
    return request.senderName ?? '-'
  },

  getDirectionText(request: UserRequest): string {
    return request.isSent ? 'Sent' : 'Received'
  },

  getMetadataText(request: UserRequest): string {
    const metadata = request.metadata
    if (!metadata || typeof metadata !== 'object') return '-'

    const role = 'role' in metadata ? metadata.role : null
    const position = 'position' in metadata ? metadata.position : null
    const orgName = 'orgName' in metadata ? metadata.orgName : null

    return [orgName,role, position].filter(Boolean).join(' / ') || '-'
  },

  async accept(request: UserRequest) {
    await runRequestAction('accept this request', () => acceptUserRequestRequest(request.id))
  },

  async reject(request: UserRequest) {
    await runRequestAction('reject this request', () => rejectUserRequestRequest(request.id), true)
  },

  async cancel(request: UserRequest) {
    await runRequestAction('cancel this request', () => cancelUserRequestRequest(request.id), true)
  },

  getActions(request: UserRequest): DropdownActionItem[] {
    if (request.status !== UserRequestStatus.PENDING) return []

    if (request.isSent) {
      return [
        {
          label: 'Cancel',
          variant: 'destructive',
          onClick: () => void this.cancel(request),
        },
      ]
    }

    return [
      {
        label: 'Accept',
        onClick: () => void this.accept(request),
      },
      {
        label: 'Reject',
        variant: 'destructive',
        onClick: () => void this.reject(request),
      },
    ]
  },
}
