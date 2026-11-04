import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { appQueryKeys } from '@/features/app/query-keys'
import { apiClient, ApiError } from '@/lib/api-client'
import { connectAppRequest } from '@/lib/api/app'
import { AppConnectEntity } from '@/lib/entities/app-connect.entity'

export function useConnect() {
  const hasToken = Boolean(apiClient.getAuthToken())
  const query = useQuery({
    queryKey: appQueryKeys.connect,
    queryFn: connectAppRequest,
    enabled: hasToken,
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 401) && failureCount < 2,
  })
  const session = useMemo(() => (query.data ? new AppConnectEntity(query.data) : null), [query.data])

  return {
    ...query,
    session,
  }
}
