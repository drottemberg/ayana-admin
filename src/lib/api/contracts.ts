import { apiClient } from '@/lib/api-client'
import { SortOrder, type ApiListResult } from '@/lib/api-types'
import type { ContractDto } from '@/lib/entities/contract.entity'

export function getContractsListDtoRequest(): Promise<ApiListResult<ContractDto>> {
  return apiClient.post<ApiListResult<ContractDto>>('/contracts/list', {
    limit: 100,
    orderBy: 'createdAt',
    order: SortOrder.desc,
  })
}

export function getContractDtoRequest(contractId: string): Promise<ContractDto> {
  return apiClient.get<ContractDto>(`/contracts/${contractId}`)
}

export function createContractDtoRequest(payload: ContractDto): Promise<ContractDto> {
  return apiClient.post<ContractDto>('/contracts', payload)
}

export function updateContractDtoRequest(contractId: string, payload: ContractDto): Promise<ContractDto> {
  return apiClient.patch<ContractDto>(`/contracts/${contractId}`, payload)
}
