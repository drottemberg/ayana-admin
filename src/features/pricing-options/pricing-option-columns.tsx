import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { NO_VALUE_STR } from '@/constants'
import { PricingOptionScopeCell } from '@/features/pricing-options/PricingOptionScopeCell'
import type { PricingOption } from '@/types/pricing-option'

const typeLabels: Record<PricingOption['type'], string> = {
  DROP_IN: 'Drop-in',
  CLASS_PACK: 'Class pack',
  CAPPED_MEMBERSHIP: 'Capped membership',
  UNLIMITED_MEMBERSHIP: 'Unlimited membership',
  INTRO_OFFER: 'Intro offer',
}

export function formatPricingOptionPrice(price: number | string, currency: string) {
  const numericPrice = Number(price)
  if (!Number.isFinite(numericPrice)) return NO_VALUE_STR
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(numericPrice)
}

export function getPricingOptionColumns(options: { showCustomer?: boolean; showScope?: boolean; locationScoped?: boolean } = {}): ColumnDef<PricingOption>[] {
  return [
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status ?? (row.original.isDeleted ? 'DELETED' : row.original.isActive ? 'ACTIVE' : 'DISABLED')
        return (
          <Badge
            variant={status === 'DELETED' ? 'destructive' : 'outline'}
            className={status === 'ACTIVE' ? 'border-green-200 text-green-800' : ''}
          >
            {status === 'ACTIVE' ? 'Active' : status === 'DELETED' ? 'Deleted' : 'Disabled'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => typeLabels[row.original.type] ?? row.original.type,
    },
    {
      id: 'price',
      header: 'Price incl. VAT',
      accessorFn: (row) => Number(row.price),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          {formatPricingOptionPrice(row.original.price, row.original.currency)}
          {options.locationScoped && (row.original.isPriceOverridden || row.original.isCurrencyOverridden) ? (
            <Badge variant="outline">Override</Badge>
          ) : null}
        </span>
      ),
    },
    {
      accessorKey: 'vatRate',
      header: 'VAT',
      cell: ({ row }) => `${(Number(row.original.vatRate) * 100).toLocaleString()}%`,
    },
    {
      accessorKey: 'billingInterval',
      header: 'Billing interval',
      cell: ({ row }) => row.original.billingInterval,
    },
    ...(options.showScope === false ? [] : [{
      accessorKey: 'scope',
      header: 'Scope',
      cell: ({ row }) => <PricingOptionScopeCell option={row.original} customerId={row.original.organizationId} />,
    } as ColumnDef<PricingOption>]),
    ...(options.showCustomer ? [{
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => {
        const customerId = row.original.customerId ?? row.original.organizationId
        const customerName = row.original.customerName ?? row.original.customer?.name
        return customerName && customerId
          ? <Link to={`/customers/${customerId}`} className="underline-offset-2 hover:underline">{customerName}</Link>
          : customerName ?? NO_VALUE_STR
      },
    } as ColumnDef<PricingOption>] : []),
  ]
}
