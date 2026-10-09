export const llmConfigQueryKeys = {
  all: ['llm-configs'] as const,
  list: (state?: unknown) => [...llmConfigQueryKeys.all, 'list', state] as const,
}
