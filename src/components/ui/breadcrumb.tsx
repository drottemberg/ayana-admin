import * as React from 'react'
import { Link } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon'
import MoreHorizontalCircle01Icon from '@hugeicons/core-free-icons/MoreHorizontalCircle01Icon'

function Breadcrumb({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" className={cn(className)} {...props} />
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn('flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground', className)}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="breadcrumb-item" className={cn('inline-flex items-center gap-1', className)} {...props} />
}

function BreadcrumbLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      data-slot="breadcrumb-link"
      className={cn('text-primary underline transition-colors', className)}
      {...props}
    />
  )
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('font-normal', className)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('[&>svg]:size-3.5', className)}
      {...props}
    >
      {children ?? <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />}
    </li>
  )
}

function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn('flex size-5 items-center justify-center [&>svg]:size-4', className)}
      {...props}
    >
      <HugeiconsIcon icon={MoreHorizontalCircle01Icon} strokeWidth={2} />
      <span className="sr-only">More</span>
    </span>
  )
}

type BreadcrumbEntry = {
  key?: React.Key
  label: React.ReactNode
  to?: LinkProps['to']
}

type PageBreadcrumbsProps = {
  items: BreadcrumbEntry[]
  className?: string
  listClassName?: string
  itemClassName?: string
  linkClassName?: string
  pageClassName?: string
  separatorClassName?: string
}

function PageBreadcrumbs({
  items,
  className,
  listClassName,
  itemClassName,
  linkClassName,
  pageClassName,
  separatorClassName,
}: PageBreadcrumbsProps) {
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className={listClassName}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <React.Fragment key={item.key ?? index}>
              <BreadcrumbItem className={itemClassName}>
                {!isLast && item.to ? (
                  <BreadcrumbLink to={item.to} className={linkClassName}>
                    {item.label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className={pageClassName}>{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast ? <BreadcrumbSeparator className={separatorClassName} /> : null}
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  PageBreadcrumbs,
}
export type { BreadcrumbEntry, PageBreadcrumbsProps }
