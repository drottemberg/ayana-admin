export type AiSupportIssueType = 'UNANSWERED' | 'TOOL_FAILURE' | 'INTERNAL_ERROR' | 'ITERATION_LIMIT'
export type AiSupportIssueStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED'

export type AiSupportIssue = {
  id: string
  type: AiSupportIssueType
  status: AiSupportIssueStatus
  summary: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  conversationId: string | null
  appContext: 'ADMIN' | 'CUSTOMER' | 'MEMBER'
  channel: 'WHATSAPP' | 'TELEGRAM' | 'WEB' | null
  customerId: string | null
  customerName: string | null
  locationId: string | null
  locationName: string | null
  assignedToUserId: string | null
  llmProvider: string | null
  llmModel: string | null
  createdAt: string
  updatedAt: string
}

export type AiSupportIssueActivity = {
  id: string
  type: 'NOTE' | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'RESOLUTION'
  content: string | null
  fromValue: string | null
  toValue: string | null
  createdAt: string
  author: { id: string; firstName: string; lastName: string } | null
}

export type AiSupportIssueDetails = AiSupportIssue & {
  userPhone: string | null
  channelId: string | null
  activeCustomerId: string | null
  activeCustomerName: string | null
  userInput: string | null
  assistantResponse: string | null
  failureName: string | null
  failureMessage: string | null
  failureStack: string | null
  diagnosticContext: Record<string, unknown> | null
  conversation: Array<Record<string, unknown>> | null
  toolTrace: Array<Record<string, unknown>> | null
  availableTools: Array<Record<string, unknown>> | null
  resolution: string | null
  resolvedAt: string | null
  assignee: { id: string; firstName: string; lastName: string; email: string | null } | null
  activities: AiSupportIssueActivity[]
}
