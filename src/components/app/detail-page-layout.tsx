import { createContext, Fragment, isValidElement, useCallback, useContext, useEffect, useLayoutEffect, useState, type Key, type ReactNode } from 'react'
import type { IconSvgElement } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router-dom'

import { DetailCard } from '@/components/app/DetailCard'
import { DataTableAsync, type DataTableAsyncProps, type DataTableState } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { PageHeader, type PageHeaderProps } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { HugeiconsIcon } from '@hugeicons/react'
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon'
import Add01Icon from '@hugeicons/core-free-icons/Add01Icon'
import { PageHeaderIconAction } from '@/components/ui/page-header'

export type DetailPanelField = {
  label: ReactNode
  value?: ReactNode
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
const DetailLayoutStackedContext = createContext(false)

function getIsStackedDetailLayout() {
  if (typeof window === 'undefined') return false
  const main = document.querySelector<HTMLElement>('main[data-slot="sidebar-inset"]')
  return (main?.clientWidth ?? window.innerWidth) < 1024
}

function hasRenderableContent(node: ReactNode): boolean {
  if (node === null || node === undefined || typeof node === 'boolean') return false
  if (typeof node === 'string') return node.trim().length > 0
  if (Array.isArray(node)) return node.some(hasRenderableContent)
  if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) {
    return hasRenderableContent(node.props.children)
  }
  return true
}

function useIsStackedDetailLayout() {
  const [isStacked, setIsStacked] = useState(getIsStackedDetailLayout)

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main[data-slot="sidebar-inset"]')
    const update = () => setIsStacked(getIsStackedDetailLayout())
    update()
    window.addEventListener('resize', update)

    const observer = main ? new ResizeObserver(update) : null
    observer?.observe(main!)

    return () => {
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [])

  return isStacked
}

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
  const isStackedLayout = useIsStackedDetailLayout()
  const hasAside = hasRenderableContent(aside)
  const [activeModule, setActiveModule] = useState(modules?.[0]?.key ?? '')
  const [bottomFillerHeight, setBottomFillerHeight] = useState(0)

  useEffect(() => {
    if (!modules?.length || modules.some((module) => module.key === activeModule)) return
    setActiveModule(modules[0].key)
  }, [activeModule, modules])

  useLayoutEffect(() => {
    if (!modules?.length) return

    const moduleElements = modules
      .map((module) => ({
        key: module.key,
        element: document.getElementById(`${MODULE_ANCHOR_PREFIX}-${module.key}`),
      }))
      .filter((module): module is { key: string; element: HTMLElement } => Boolean(module.element))
    const previousHidden = moduleElements.map(({ element }) => element.hidden)

    moduleElements.forEach(({ key, element }) => {
      element.hidden = isStackedLayout && key !== activeModule
    })

    return () => {
      moduleElements.forEach(({ element }, index) => {
        element.hidden = previousHidden[index]
      })
    }
  }, [activeModule, children, isStackedLayout, modules])

  useLayoutEffect(() => {
    if (!modules?.length) return

    const lastModule = document.getElementById(`${MODULE_ANCHOR_PREFIX}-${modules[modules.length - 1].key}`)
    const pageHeader = document.querySelector<HTMLElement>('[data-slot="page-header"]')
    const updateFillerHeight = () => {
      const headerHeight = pageHeader?.getBoundingClientRect().height ?? 0
      const moduleHeight = lastModule?.getBoundingClientRect().height ?? 0
      const nextHeight = Math.max(0, Math.ceil(window.innerHeight - headerHeight - moduleHeight + 8))
      setBottomFillerHeight((currentHeight) => currentHeight === nextHeight ? currentHeight : nextHeight)
    }

    updateFillerHeight()
    const resizeObserver = new ResizeObserver(updateFillerHeight)
    if (lastModule) resizeObserver.observe(lastModule)
    if (pageHeader) resizeObserver.observe(pageHeader)
    window.addEventListener('resize', updateFillerHeight)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateFillerHeight)
    }
  }, [children, modules])

  useEffect(() => {
    if (!modules?.length || isStackedLayout) return

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

        const headerOffset = (document.querySelector<HTMLElement>('[data-slot="page-header"]')?.getBoundingClientRect().height ?? 160) + 8
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
  }, [isStackedLayout, modules])

  const selectModule = useCallback((key: string) => {
    const id = `${MODULE_ANCHOR_PREFIX}-${key}`
    const target = document.getElementById(id)
    if (!target) {
      setActiveModule(key)
      return
    }

    const headerHeight = document.querySelector<HTMLElement>('[data-slot="page-header"]')?.getBoundingClientRect().height ?? 160
    target.style.scrollMarginTop = `${headerHeight + 8}px`
    window.history.replaceState(null, '', `#${id}`)

    if (isStackedLayout) {
      setActiveModule(key)
      window.requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      return
    }

    window.requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [isStackedLayout])

  return (
    <DetailLayoutStackedContext.Provider value={isStackedLayout}>
    <>
      {header ? (
        <PageHeader
          {...header}
          tabs={modules?.map((module) => ({
            key: module.key,
            label: module.label,
            count: module.count,
            active: activeModule === module.key,
            onClick: () => selectModule(module.key),
          }))}
          className={cn('sticky top-0 z-30 border-b bg-background', header.className)}
        />
      ) : null}
      <section className={cn('grid w-full gap-4 p-4 md:p-6', isStackedLayout || !hasAside ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_400px]', className)}>
        <main className="min-w-0 space-y-4">
          {children}
          {modules?.length ? <div data-detail-tab-spacer aria-hidden="true" style={{ height: bottomFillerHeight }} /> : null}
        </main>
        {hasAside ? <aside className={cn('w-full min-w-0 space-y-4', isStackedLayout ? 'order-first' : 'order-none sticky top-32 self-start')}>{aside}</aside> : null}
      </section>
    </>
    </DetailLayoutStackedContext.Provider>
  )
}

export function DetailSidePanel({
  sections,
  isLoading = false,
}: {
  sections: DetailPanelSection[]
  isLoading?: boolean
}) {
  const isStackedLayout = useContext(DetailLayoutStackedContext)
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (isStackedLayout) setOpenSections({})
  }, [isStackedLayout])

  if (isLoading) {
    if (isStackedLayout) {
      const section = sections[0]
      return (
        <Collapsible className="w-full rounded-lg border border-border bg-muted">
          <CollapsibleTrigger className="group/collapsible-trigger flex w-full items-center gap-2 p-4 text-left text-sm font-semibold">
            {section?.icon ? <HugeiconsIcon icon={section.icon} strokeWidth={2} className="size-5 shrink-0" /> : null}
            <span className="min-w-0 flex-1">{section?.title ?? 'Details'}</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className="size-4 shrink-0 transition-transform group-data-panel-open/collapsible-trigger:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-border px-4 py-3">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-4 w-full" />)}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )
    }
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
      {sections.map((section, sectionIndex) => {
        const fields = (
          <dl className="divide-y">
            {section.fields.map((field, fieldIndex) => renderDetailPanelField(field, fieldIndex))}
          </dl>
        )

        if (isStackedLayout) {
          return (
            <Collapsible
              key={sectionIndex}
              open={Boolean(openSections[sectionIndex])}
              onOpenChange={(open) => setOpenSections((current) => ({ ...current, [sectionIndex]: open }))}
              className="w-full rounded-lg border border-border bg-muted"
            >
              <CollapsibleTrigger className="group/collapsible-trigger flex w-full items-center gap-2 p-4 text-left text-sm font-semibold">
                {section.icon ? <HugeiconsIcon icon={section.icon} strokeWidth={2} className="size-5 shrink-0" /> : null}
                <span className="min-w-0 flex-1">{section.title}</span>
                {section.actions}
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  strokeWidth={2}
                  className="size-4 shrink-0 transition-transform group-data-panel-open/collapsible-trigger:rotate-180"
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-border px-4 py-3">
                {fields}
              </CollapsibleContent>
            </Collapsible>
          )
        }

        return (
          <DetailCard
            key={sectionIndex}
            icon={section.icon}
            title={section.title}
            actions={section.actions}
            className="border border-border ring-0"
          >
            {fields}
          </DetailCard>
        )
      })}
    </>
  )
}

function renderDetailPanelField(field: DetailPanelField, key: Key) {
  return (
    <div key={key} className="flex items-start justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
      <dt className="shrink-0 whitespace-nowrap text-muted-foreground">{field.label}</dt>
      <dd className="min-w-0 flex-1 break-words text-right font-medium text-foreground">
        {field.children?.length ? (
          <dl className="grid gap-2">
            {field.children.map((child, childIndex) => {
              return (
                <div key={childIndex} className="flex items-start justify-between gap-3">
                  <dt className="shrink-0 whitespace-nowrap text-muted-foreground">{child.label}</dt>
                  <dd className="min-w-0 flex-1 break-words text-right text-foreground">{child.value}</dd>
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

export type RelatedEntityModuleProps<TData extends Record<string, unknown>> = {
  id?: string
  title: ReactNode
  icon?: IconSvgElement
  initialTotal?: number
  resetKey?: Key
  viewAllTo?: string
  viewAllMinCount?: number
  action?: {
    label: string
    onClick?: () => void
    iconOnly?: boolean
    icon?: IconSvgElement
  }
  headerExtra?: ReactNode
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
  toolbarExtra?: ReactNode
  refetchOnMount?: DataTableAsyncProps<TData>['refetchOnMount']
  showPagination?: boolean
  renderCard?: DataTableAsyncProps<TData>['renderCard']
  getCardGroupKey?: DataTableAsyncProps<TData>['getCardGroupKey']
  sortCardGroups?: DataTableAsyncProps<TData>['sortCardGroups']
  sortCardGroupItems?: DataTableAsyncProps<TData>['sortCardGroupItems']
  renderCardGroup?: DataTableAsyncProps<TData>['renderCardGroup']
}

export function RelatedEntityModule<TData extends Record<string, unknown>>({
  id,
  title,
  icon,
  initialTotal,
  resetKey,
  viewAllTo,
  viewAllMinCount,
  action,
  headerExtra,
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
  toolbarExtra,
  refetchOnMount,
  showPagination = false,
  renderCard,
  getCardGroupKey,
  sortCardGroups,
  sortCardGroupItems,
  renderCardGroup,
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
        resolvedTotalLabel && viewAllTo && (viewAllMinCount == null || (resolvedTotal ?? 0) > viewAllMinCount) ? (
          <Link to={viewAllTo} title="View all" className="underline-offset-2 hover:text-foreground hover:underline">
            {resolvedTotalLabel}
          </Link>
        ) : (
          resolvedTotalLabel
        )
      }
      actions={action || headerExtra ? <>
        {headerExtra}
        {action ? action.iconOnly ? (
          <PageHeaderIconAction icon={action.icon ?? Add01Icon} label={action.label} onClick={action.onClick} variant="outline" size="icon" />
        ) : (
          <Button size="sm" variant="outline" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null}
      </> : null}
    >
      <div className="max-w-full min-w-0">
        {toolbarExtra ? <div className="flex justify-end pb-3">{toolbarExtra}</div> : null}
        <DataTableAsync
          key={resetKey}
          queryKey={queryKey}
          loadData={async (state: DataTableState<TData>) => {
            const result = await loadData(showPagination ? state : { ...state, pagination: { pageIndex: 0, pageSize } })
            setLoadedTotal(result.count)

            return result
          }}
          tableKey={tableKey}
          columns={columns}
          getCommands={getCommands}
          getRowCommands={getRowCommands}
          renderCard={renderCard}
          getCardGroupKey={getCardGroupKey}
          sortCardGroups={sortCardGroups}
          sortCardGroupItems={sortCardGroupItems}
          renderCardGroup={renderCardGroup}
          pageSize={pageSize}
          surface="plain"
          showToolbar={false}
          showPagination={showPagination}
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
    iconOnly?: boolean
    icon?: IconSvgElement
  }
}) {
  return (
    <DetailCard
      id={id}
      icon={icon}
      title={title}
      className="scroll-mt-36"
      actions={
        action ? action.iconOnly ? (
          <PageHeaderIconAction icon={action.icon ?? Add01Icon} label={action.label} onClick={action.onClick} variant="outline" size="icon" />
        ) : (
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
