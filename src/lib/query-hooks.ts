import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query'

import { DETAIL_STALE_TIME, LIST_STALE_TIME, DICTIONARY_STALE_TIME, getQueryStaleTime } from '@/lib/query-config'

type AppQueryOptions<TQueryFnData, TError, TData, TQueryKey extends QueryKey> = UseQueryOptions<
  TQueryFnData,
  TError,
  TData,
  TQueryKey
>

export function useListQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(options: AppQueryOptions<TQueryFnData, TError, TData, TQueryKey>) {
  return useQuery({
    ...options,
    staleTime: getQueryStaleTime(LIST_STALE_TIME, options.staleTime),
  })
}

export function useDetailQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(options: AppQueryOptions<TQueryFnData, TError, TData, TQueryKey>) {
  return useQuery({
    ...options,
    staleTime: getQueryStaleTime(DETAIL_STALE_TIME, options.staleTime),
  })
}

export function useDictionaryQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(options: AppQueryOptions<TQueryFnData, TError, TData, TQueryKey>) {
  return useQuery({
    ...options,
    staleTime: getQueryStaleTime(DICTIONARY_STALE_TIME, options.staleTime),
  })
}
