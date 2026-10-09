export const LlmProvider = {
  OPENAI: 'openai',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
} as const

export type LlmProvider = (typeof LlmProvider)[keyof typeof LlmProvider]

export const ReasoningEffort = {
  NONE: 'none',
  MINIMAL: 'minimal',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  XHIGH: 'xhigh',
  MAX: 'max',
} as const

export type ReasoningEffort = (typeof ReasoningEffort)[keyof typeof ReasoningEffort]

export type LlmConfig = Record<string, unknown> & {
  id: string
  provider: LlmProvider
  model: string | null
  hasApiKey: boolean
  historyLength: number | null
  maxTokens: number | null
  reasoningEffort: ReasoningEffort
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type LlmConfigInput = {
  provider: LlmProvider
  model: string
  apiKey?: string | null
  historyLength?: number | null
  maxTokens?: number | null
  reasoningEffort: ReasoningEffort
}
