import type { DataReportFilters } from '@/types/data-report'

export const dataReportQueryKeys = {
  all: ['data-reports'] as const,
  detail: (filters: DataReportFilters) => [...dataReportQueryKeys.all, filters] as const,
  productInteractions: (filters: DataReportFilters) =>
    [...dataReportQueryKeys.all, 'product-interactions', filters] as const,
}
