import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { DataReportChart } from '@/types/data-report'
import { toChartConfig } from './chart-utils'

export function DataReportLineChart({ chart }: { chart: DataReportChart }) {
  return (
    <ChartContainer config={toChartConfig(chart)} className="aspect-auto h-[280px] w-full">
      <LineChart data={chart.data} margin={{ top: 18, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} />
        <ChartTooltip cursor={{ strokeDasharray: '4 4' }} content={<ChartTooltipContent indicator="line" />} />
        {chart.series.map((series) => (
          <Line
            key={series.key}
            type="natural"
            dataKey={series.key}
            stroke={`var(--color-${series.key})`}
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}
