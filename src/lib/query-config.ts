export const DEFAULT_STALE_TIME = 10 * 1000
export const LIST_STALE_TIME = 10 * 1000
export const DETAIL_STALE_TIME = 60 * 1000
export const DICTIONARY_STALE_TIME = 60 * 1000

export const isQueryCacheDisabled = import.meta.env.VITE_DISABLE_QUERY_CACHE === 'true'

export function getQueryStaleTime<TStaleTime>(defaultStaleTime: number, staleTime?: TStaleTime) {
  return isQueryCacheDisabled ? 0 : (staleTime ?? defaultStaleTime)
}
