import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DataReportChart } from '@/types/data-report'
import { DataReportBarChart } from './charts/DataReportBarChart'
import { DataReportDonutChart } from './charts/DataReportDonutChart'
import { DataReportLineChart } from './charts/DataReportLineChart'

function DistanceSummary() {
  const items = [
    { value: '80%', label: 'Label', className: 'text-emerald-500' },
    { value: '~6.85', label: 'Label', className: 'text-emerald-500' },
    { value: '46%', label: 'Label', className: 'text-emerald-500' },
    { value: '10%', label: 'Label', className: 'text-orange-500' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.value} className="rounded-lg border bg-muted/30 px-4 py-2 text-center">
          <div className={`text-sm font-semibold ${item.className}`}>{item.value}</div>
          <div className="text-xs text-muted-foreground">{item.label}</div>
        </div>
      ))}
    </div>
  )
}

export function DataReportChartCard({
  chart,
  className,
  height,
}: {
  chart: DataReportChart
  className?: string
  height?: number
}) {
  return (
    <Card className={className} size="sm">
      <CardHeader className="gap-1">
        <CardTitle className="text-sm font-semibold">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid min-h-0 gap-4">
        {chart.type === 'line' ? <DataReportLineChart chart={chart} /> : null}
        {chart.type === 'bar' || chart.type === 'groupedBar' ? (
          <DataReportBarChart chart={chart} height={height ?? 240} />
        ) : null}
        {chart.type === 'donut' ? <DataReportDonutChart chart={chart} /> : null}
        {chart.id === 'distance' ? <DistanceSummary /> : null}
      </CardContent>
    </Card>
  )
}
