import { useCallback, useEffect, useState, type Key, type ReactNode } from 'react'
import type { IconSvgElement } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { DetailCard } from '@/components/app/DetailCard'
import { DataTableAsync, type DataTableAsyncProps, type DataTableState } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { PageHeader, type PageHeaderProps } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type DetailPanelField = {
  label: ReactNode
  value?: ReactNode
  layout?: 'column' | 'row'
  children?: DetailPanelField[]
}

export type DetailPanelSection = {
  title: ReactNode
  icon?: IconSvgElement
  actions?: ReactNode
  fields: DetailPanelField[]
}

export type DetailPageModule = {
  key: string
  label: ReactNode
  count?: number
}

const MODULE_ANCHOR_PREFIX = 'module'
export const RELATED_ENTITY_MODULE_PAGE_SIZE = 5

export function DetailPageLayout({
  children,
  aside,
  header,
  modules,
  className,
}: {
  children: ReactNode
  aside: ReactNode
  header?: Omit<PageHeaderProps, 'tabs'>
  modules?: DetailPageModule[]
  className?: string
}) {
  const [activeModule, setActiveModule] = useState(modules?.[0]?.key ?? '')

  useEffect(() => {
    if (!modules?.length) return

    const getModuleElements = () =>
      modules
        .map((module) => ({
          key: module.key,
          element: document.getElementById(`${MODULE_ANCHOR_PREFIX}-${module.key}`),
        }))
        .filter((module): module is { key: string; element: HTMLElement } => Boolean(module.element))

    let animationFrame = 0

    const updateActiveModule = () => {
      window.cancelAnimationFrame(animationFrame)

      animationFrame = window.requestAnimationFrame(() => {
        const moduleElements = getModuleElements()

        if (!moduleElements.length) {
          return
        }

        const headerOffset = 160
        const active =
          moduleElements.findLast(({ element }) => element.getBoundingClientRect().top <= headerOffset) ??
          moduleElements[0]
        const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2

        setActiveModule(isAtBottom ? moduleElements[moduleElements.length - 1].key : active.key)
      })
    }

    updateActiveModule()
    window.addEventListener('scroll', updateActiveModule, { passive: true })
    window.addEventListener('resize', updateActiveModule)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('scroll', updateActiveModule)
      window.removeEventListener('resize', updateActiveModule)
    }
  }, [modules])

  const scrollToModule = useCallback((key: string) => {
    setActiveModule(key)
    const id = `${MODULE_ANCHOR_PREFIX}-${key}`
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${id}`)
  }, [])

  return (
    <>
      {header ? (
        <PageHeader
          {...header}
          tabs={modules?.map((module) => ({
            key: module.key,
            label: module.label,
            count: module.count,
            active: activeModule === module.key,
            onClick: () => scrollToModule(module.key),
          }))}
          className={cn('sticky top-0 z-30 border-b bg-background', header.className)}
        />
      ) : null}
      <section className={cn('grid gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_400px]', className)}>
        <main className="min-w-0 space-y-4">{children}</main>
        <aside className="order-first min-w-0 space-y-4 lg:sticky lg:top-32 lg:order-none lg:self-start">{aside}</aside>
      </section>
    </>
  )
}

export function DetailSidePanel({
  sections,
  isLoading = false,
  fieldLayout = 'column',
}: {
  sections: DetailPanelSection[]
  isLoading?: boolean
  fieldLayout?: 'column' | 'row'
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-muted p-4">
        <Skeleton className="mb-4 h-4 w-24" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {sections.map((section, sectionIndex) => (
        <DetailCard
          key={sectionIndex}
          icon={section.icon}
          title={section.title}
          actions={section.actions}
          className="border border-border ring-0"
        >
          <dl className="divide-y">
            {section.fields.map((field, fieldIndex) => renderDetailPanelField(field, fieldLayout, fieldIndex))}
          </dl>
        </DetailCard>
      ))}
    </>
  )
}

function renderDetailPanelField(field: DetailPanelField, fieldLayout: 'column' | 'row', key: Key) {
  const layout = field.layout ?? fieldLayout

  return (
    <div key={key} className={getDetailPanelFieldClassName(layout)}>
      <dt className="text-muted-foreground">{field.label}</dt>
      <dd className={getDetailPanelValueClassName(layout)}>
        {field.children?.length ? (
          <dl className="grid gap-2">
            {field.children.map((child, childIndex) => {
              const childLayout = child.layout ?? fieldLayout

              return (
                <div key={childIndex} className={getDetailPanelNestedFieldClassName(childLayout)}>
                  <dt className="min-w-0 text-muted-foreground">{child.label}</dt>
                  <dd className={getDetailPanelNestedValueClassName(childLayout)}>{child.value}</dd>
                </div>
              )
            })}
          </dl>
        ) : (
          field.value
        )}
      </dd>
    </div>
  )
}

function getDetailPanelFieldClassName(layout: 'column' | 'row') {
  return cn(
    'grid gap-1 py-3 text-sm first:pt-0 last:pb-0',
    layout === 'row' && 'grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] gap-3',
  )
}

function getDetailPanelValueClassName(layout: 'column' | 'row') {
  return cn('min-w-0 font-medium break-words text-foreground', layout === 'row' && 'text-right')
}

function getDetailPanelNestedFieldClassName(layout: 'column' | 'row') {
  return cn('grid gap-1', layout === 'row' && 'grid-cols-[minmax(0,1fr)_auto] items-start gap-3')
}

function getDetailPanelNestedValueClassName(layout: 'column' | 'row') {
  return cn('min-w-0 text-foreground', layout === 'row' && 'text-right')
}

export type RelatedEntityModuleProps<TData extends Record<string, unknown>> = {
  id?: string
  title: ReactNode
  icon?: IconSvgElement
  initialTotal?: number
  viewAllTo?: string
  action?: {
    label: string
    onClick?: () => void
  }
  columns: ColumnDef<TData>[]
  getCommands?: DataTableAsyncProps<TData>['getCommands']
  getRowCommands?: DataTableAsyncProps<TData>['getRowCommands']
  queryKey: readonly unknown[]
  loadData: DataTableAsyncProps<TData>['loadData']
  tableKey: string
  emptyMessage: string
  loadingMessage?: string
  errorMessage?: string
  pageSize?: number
  refetchOnMount?: DataTableAsyncProps<TData>['refetchOnMount']
}

export function RelatedEntityModule<TData extends Record<string, unknown>>({
  id,
  title,
  icon,
  initialTotal,
  viewAllTo,
  action,
  columns,
  getCommands,
  getRowCommands,
  queryKey,
  loadData,
  tableKey,
  emptyMessage,
  loadingMessage,
  errorMessage,
  pageSize = RELATED_ENTITY_MODULE_PAGE_SIZE,
  refetchOnMount,
}: RelatedEntityModuleProps<TData>) {
  const [loadedTotal, setLoadedTotal] = useState<number | null>(null)
  const resolvedTotal = loadedTotal ?? initialTotal
  const resolvedTotalLabel =
    resolvedTotal === undefined ? undefined : `${Math.min(resolvedTotal, pageSize)} / ${resolvedTotal}`

  return (
    <DetailCard
      id={id}
      icon={icon}
      title={title}
      className="scroll-mt-36"
      subtitle={
        resolvedTotalLabel && viewAllTo ? (
          <Link to={viewAllTo} title="View all" className="underline-offset-2 hover:text-foreground hover:underline">
            {resolvedTotalLabel}
          </Link>
        ) : (
          resolvedTotalLabel
        )
      }
      actions={
        action ? (
          <Button size="sm" variant="outline" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null
      }
    >
      <div className="max-w-full min-w-0">
        <DataTableAsync
          queryKey={queryKey}
          loadData={async (state: DataTableState<TData>) => {
            const result = await loadData({ ...state, pagination: { pageIndex: 0, pageSize } })
            setLoadedTotal(result.count)

            return result
          }}
          tableKey={tableKey}
          columns={columns}
          getCommands={getCommands}
          getRowCommands={getRowCommands}
          pageSize={pageSize}
          showToolbar={false}
          showPagination={false}
          disabledSelection
          customizeColumns={false}
          perPageOptions={false}
          loadingMessage={loadingMessage}
          emptyMessage={emptyMessage}
          errorMessage={errorMessage}
          refetchOnMount={refetchOnMount}
        />
      </div>
    </DetailCard>
  )
}

export function EmptyRelatedEntityModule({
  id,
  title,
  description,
  icon,
  action,
}: {
  id?: string
  title: ReactNode
  description: ReactNode
  icon?: IconSvgElement
  action?: {
    label: string
    onClick?: () => void
  }
}) {
  return (
    <DetailCard
      id={id}
      icon={icon}
      title={title}
      className="scroll-mt-36"
      actions={
        action ? (
          <Button size="sm" variant="outline" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null
      }
    >
      <div className="py-6 text-center text-sm text-muted-foreground">{description}</div>
    </DetailCard>
  )
}
