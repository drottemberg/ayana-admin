import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { StatusPill } from '@/components/app/StatusPill'
import { cn } from '@/lib/utils'
import type { ClassTypeProduct } from '@/features/classes/api'

export function ClassTypeProductListCard({
  product,
  actions,
}: {
  product: ClassTypeProduct
  actions: ReactNode
}) {
  const available = product.isActive && product.isSellable

  return <article className="flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-card-foreground shadow-sm sm:gap-4 sm:px-5">
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/products/${encodeURIComponent(product.productId)}`} className={cn('line-clamp-2 break-words text-base font-semibold leading-5 text-foreground hover:underline', !available && 'text-muted-foreground')}>
            {product.productName}
          </Link>
          <div className="mt-1 truncate text-sm text-[#625b56]">{product.productTypeName || 'Product'}</div>
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          <StatusPill status={available ? 'ACTIVE' : 'DISABLED'} label={available ? 'Available' : 'Unavailable'} />
          {actions ? <div className="-mr-2 -mt-2">{actions}</div> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="h-6 rounded-md px-2 text-xs font-medium">
          {product.kind === 'REQUIRED' ? 'Required' : 'Recommended'}
        </Badge>
      </div>
    </div>
  </article>
}
