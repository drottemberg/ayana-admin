import { QueryClient } from '@tanstack/react-query'
import { DEFAULT_STALE_TIME, getQueryStaleTime } from '@/lib/query-config'
import { appQueryKeys } from '@/features/app/query-keys'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: getQueryStaleTime(DEFAULT_STALE_TIME),
    },
    mutations: {
      retry: 0,
    },
  },
})

queryClient.setQueryDefaults(appQueryKeys.connect, {
  gcTime: Infinity,
})
