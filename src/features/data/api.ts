import { apiClient } from '@/lib/api-client'
import type { FilterMetadataResponse } from '@/lib/api-types'
import type {
  DataReportComparison,
  DataReportFilters,
  DataReportProductInteraction,
  DataReportResponse,
  GeneratedReport,
} from '@/types/data-report'

export async function getDataReportComparisonOptionsRequest(): Promise<DataReportComparison[]> {
  return apiClient.get<DataReportComparison[]>('/data-reports/comparison-options')
}

export async function getDataReportFiltersRequest(
  keys: Record<string, boolean>,
): Promise<FilterMetadataResponse> {
  return apiClient.post<FilterMetadataResponse>('/data-reports/filters', { keys })
}

export async function getDataReportRequest(filters: DataReportFilters = {}): Promise<DataReportResponse> {
  return apiClient.post<DataReportResponse>('/data-reports/report', {
    deviceIds: filters.deviceIds,
    contractIds: filters.contractIds,
    customerIds: filters.customerIds,
    deviceTypeIds: filters.deviceTypeIds,
    period: filters.period,
  })
}

export async function getDataReportProductInteractionsRequest(
  filters: DataReportFilters = {},
): Promise<DataReportProductInteraction[]> {
  return apiClient.post<DataReportProductInteraction[]>('/data-reports/product-interactions', {
    deviceIds: filters.deviceIds,
    contractIds: filters.contractIds,
    customerIds: filters.customerIds,
    deviceTypeIds: filters.deviceTypeIds,
    period: filters.period,
  })
}

export async function generateDataReportRequest(filters: DataReportFilters = {}): Promise<GeneratedReport> {
  const report = await getDataReportRequest(filters)
  const rows = [
    ['Metric', 'Value', 'Delta'],
    ...report.kpis.map((kpi) => [kpi.label, String(kpi.value), String(kpi.deltaPercent ?? '')]),
  ]
  const content = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')

  return {
    fileName: `data-report-${new Date().toISOString().slice(0, 10)}.csv`,
    mimeType: 'text/csv;charset=utf-8',
    content,
  }
}
