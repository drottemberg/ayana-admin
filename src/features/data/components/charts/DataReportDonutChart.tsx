import { Cell, Pie, PieChart } from 'recharts'

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { DataReportChart } from '@/types/data-report'
import { toChartConfig } from './chart-utils'

export function DataReportDonutChart({ chart }: { chart: DataReportChart }) {
  return (
    <ChartContainer config={toChartConfig(chart)} className="aspect-auto h-[240px] w-full">
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Pie
          data={chart.data}
          dataKey="value"
          nameKey="label"
          innerRadius={58}
          outerRadius={86}
          paddingAngle={6}
          cornerRadius={12}
        >
          {chart.data.map((entry) => (
            <Cell key={String(entry.label)} fill={String(entry.fill)} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="label" />} />
      </PieChart>
    </ChartContainer>
  )
}
