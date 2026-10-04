import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { DataReportChart } from '@/types/data-report'
import { toChartConfig } from './chart-utils'

export function DataReportBarChart({ chart, height = 240 }: { chart: DataReportChart; height?: number }) {
  const hasDenseLabels = chart.data.length > 10

  return (
    <ChartContainer config={toChartConfig(chart)} className="w-full" style={{ height }}>
      <BarChart data={chart.data} margin={{ top: 12, right: 10, left: 0, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
          angle={hasDenseLabels ? -90 : 0}
          height={hasDenseLabels ? 48 : 32}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        {chart.series.map((series) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            fill={`var(--color-${series.key})`}
            radius={[5, 5, 0, 0]}
            maxBarSize={54}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
