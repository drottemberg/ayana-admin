export type DataReportComparisonType = 'device' | 'contract' | 'customer' | 'deviceType' | 'store' | 'product'

export type DataReportComparison = {
  id: string
  type: DataReportComparisonType
  label: string
}

export type DataReportPeriod = {
  from?: string
  to?: string
  preset?: string
}

export type DataReportFilters = {
  deviceIds?: string[]
  contractIds?: string[]
  customerIds?: string[]
  deviceTypeIds?: string[]
  period?: DataReportPeriod
  comparison?: DataReportComparison[]
}

export type DataReportDirection = 'up' | 'down' | 'equal'

export type DataReportKpi = {
  id: string
  label: string
  value: number
  unit?: string
  deltaPercent?: number
  direction: DataReportDirection
}

export type DataReportSeries = {
  key: string
  label: string
  color: string
}

export type DataReportChartType = 'line' | 'bar' | 'groupedBar' | 'donut'

export type DataReportChart = {
  id: string
  title: string
  type: DataReportChartType
  series: DataReportSeries[]
  data: Array<Record<string, string | number>>
}

export type DataReportProductInteraction = {
  id: string
  name: string
  type: string
  interactions: number
  deltaPercent: number
  ratePercent: number
}

export type DataReportResponse = {
  filters: DataReportFilters
  kpis: DataReportKpi[]
  deviceAnalytics: DataReportKpi[]
  charts: DataReportChart[]
  generatedAt: string
}

export type GeneratedReport = {
  fileName: string
  mimeType: string
  content: Blob | string
}
