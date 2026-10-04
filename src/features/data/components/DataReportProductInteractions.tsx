import { useState } from 'react'
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon'
import { HugeiconsIcon } from '@hugeicons/react'

import { DeltaBadge } from '@/components/app/DeltaBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownActionsMenu } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { DataReportProductInteraction } from '@/types/data-report'

const formatter = new Intl.NumberFormat('en-US')

const LIMIT_OPTIONS = [
  { label: 'Top 5', value: 5 },
  { label: 'Top 10', value: 10 },
  { label: 'Top 20', value: 20 },
  { label: 'All', value: null },
] as const

type LimitValue = (typeof LIMIT_OPTIONS)[number]['value']

export function DataReportProductInteractions({
  products,
  loading,
}: {
  products: DataReportProductInteraction[]
  loading?: boolean
}) {
  const [limit, setLimit] = useState<LimitValue>(10)

  const displayed = limit === null ? products : products.slice(0, limit)
  const currentLabel = LIMIT_OPTIONS.find((o) => o.value === limit)?.label ?? 'Top 10'

  return (
    <Card size="sm" className="rounded-lg">
      <CardHeader className="grid grid-cols-[1fr_auto] items-center gap-3">
        <div>
          <CardTitle className="text-sm font-semibold">Product interactions</CardTitle>
          {loading ? <div className="mt-1 text-xs text-muted-foreground">Refreshing products...</div> : null}
        </div>
        <DropdownActionsMenu
          items={LIMIT_OPTIONS.map((option) => ({
            type: 'checkbox' as const,
            label: option.label,
            checked: limit === option.value,
            onCheckedChange: (checked) => {
              if (checked) setLimit(option.value)
            },
          }))}
          align="end"
          triggerRender={<Button variant="outline" size="sm" />}
        >
          {currentLabel}
          <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
        </DropdownActionsMenu>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-transparent hover:bg-transparent">
              <TableHead className="px-0 text-xs">Product</TableHead>
              <TableHead className="text-right text-xs">Interactions / Tests</TableHead>
              <TableHead className="px-0 text-right text-xs">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((product) => (
              <TableRow key={product.id} className="bg-transparent hover:bg-muted/50">
                <TableCell className="px-0 py-4">
                  <div className="flex min-w-44 items-center gap-3">
                    <span className="font-medium">{product.name}</span>
                    <Badge variant="outline" className="bg-muted text-xs text-muted-foreground">
                      {product.type}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="py-4 text-right">
                  <div className="inline-flex items-center gap-3">
                    <span className={cn('font-semibold tabular-nums', product.interactions > 0 && 'text-[var(--color-success-600)]')}>
                      {formatter.format(product.interactions)}
                    </span>
                    <DeltaBadge value={product.deltaPercent} className="h-6 text-xs" />
                  </div>
                </TableCell>
                <TableCell className="px-0 py-4 text-right font-semibold tabular-nums">
                  {product.ratePercent}%
                </TableCell>
              </TableRow>
            ))}
            {displayed.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="px-0 py-6 text-center text-sm text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
