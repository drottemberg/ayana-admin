import { KpiBlock, KpiRow } from '@/components/app/KpiBlock'
import { DeltaBadge } from '@/components/app/DeltaBadge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import type { DataReportKpi } from '@/types/data-report'

const formatter = new Intl.NumberFormat('en-US')

function formatKpiValue(kpi: DataReportKpi) {
  const value = formatter.format(kpi.value)
  return kpi.unit ? `${value}${kpi.unit}` : value
}

export function DataReportKpiCards({ kpis }: { kpis: DataReportKpi[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.id} size="sm" className="gap-2 rounded-lg p-4 bg-muted">
          <CardHeader className="grid-cols-[1fr_auto] gap-2 items-center">
            <div>
              <CardTitle className="text-xl font-semibold tabular-nums">{formatKpiValue(kpi)}</CardTitle>
              <div className="mt-0.5 text-xs ">{kpi.label}</div>
            </div>
            <DeltaBadge value={kpi.deltaPercent} />
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

export function DeviceAnalyticsCard({ kpis }: { kpis: DataReportKpi[] }) {
  const groups = [
    { title: 'Device tests', rows: kpis.slice(0, 3) },
    { title: 'Device interactions', rows: kpis.slice(3, 6) },
  ]

  return (
    <Card className="h-full gap-4 rounded-lg p-4 bg-muted">
      <div className="text-sm font-semibold">Device analytics</div>
      <div className="grid gap-3">
        {groups.map((group) => (
          <KpiBlock key={group.title} title={group.title}>
            {group.rows.map((kpi) => (
              <KpiRow key={kpi.id} label={kpi.label} value={kpi.value} direction={kpi.direction} />
            ))}
          </KpiBlock>
        ))}
      </div>
    </Card>
  )
}
