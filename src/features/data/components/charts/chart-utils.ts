import type { ChartConfig } from '@/components/ui/chart'
import type { DataReportChart } from '@/types/data-report'

export function toChartConfig(chart: DataReportChart): ChartConfig {
  return chart.series.reduce<ChartConfig>((config, series) => {
    config[series.key] = {
      label: series.label,
      color: series.color,
    }
    return config
  }, {})
}
