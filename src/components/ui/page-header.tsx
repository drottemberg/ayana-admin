import type { ReactNode } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon'
import MoreHorizontalIcon from '@hugeicons/core-free-icons/MoreHorizontalIcon'
import { useNavigate, type LinkProps } from 'react-router-dom'

import { PageBreadcrumbs } from '@/components/ui/breadcrumb'
import { DropdownActionsMenu, type DropdownActionItem } from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from './tabs'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { SidebarTrigger, useSidebar } from './sidebar'

type PageHeaderTab = {
  key: string
  label: ReactNode
  count?: number
  active?: boolean
  onClick?: () => void
}

type PageHeaderBreadcrumb = {
  label: ReactNode
  to?: string
}

type ButtonProps = React.ComponentProps<typeof Button>

type PageHeaderProps = {
  title: ReactNode
  subtitle?: ReactNode
  breadcrumbs?: PageHeaderBreadcrumb[]
  backTo?: LinkProps['to']
  leading?: ReactNode
  options?: DropdownActionItem[]
  commands?: ReactNode
  primaryAction?: ButtonProps
  secondaryAction?: ButtonProps
  tabs?: PageHeaderTab[]
  className?: string
  bodyClassName?: string
}

function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  backTo,
  leading,
  options,
  commands,
  primaryAction,
  secondaryAction,
  tabs,
  className,
  bodyClassName,
}: PageHeaderProps) {
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  const hasTabs = Boolean(tabs?.length)
  const hasOptions = Boolean(options?.length)
  const handleBack = () => {
    const historyIndex = window.history.state?.idx

    if (typeof historyIndex === 'number' && historyIndex > 0) {
      navigate(-1)
      return
    }

    if (backTo) {
      navigate(backTo)
    }
  }

  return (
    <header data-slot="page-header" className={cn('w-full max-w-full min-w-0 overflow-x-hidden', className)}>
      <div className={cn('max-w-full min-w-0 bg-background py-6', hasTabs && 'pb-0', bodyClassName)}>
        <div className="flex min-w-0 flex-col gap-4 px-6 md:flex-row md:items-start md:justify-between md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {isMobile ? <SidebarTrigger variant="outline" size="icon-lg" aria-label="Open menu" /> : null}
            {backTo ? (
              <Button variant="outline" size="icon-lg" aria-label="Go back" onClick={handleBack}>
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
              </Button>
            ) : null}
            {leading}

            <div className="min-w-0">
              <div className="grid min-w-0 gap-1">
                <div className="text-h2 mb-0 truncate font-semibold tracking-tight text-foreground">{title}</div>
                {subtitle ? <p className="text-sm font-normal text-muted-foreground">{subtitle}</p> : null}
              </div>

              {breadcrumbs?.length ? <PageBreadcrumbs items={breadcrumbs} className="mt-2" /> : null}
            </div>
          </div>

          {commands || primaryAction || secondaryAction || hasOptions ? (
            <div className="flex min-w-0 shrink-0 items-center gap-3">
              {commands}
              {primaryAction ? <Button size="lg" {...primaryAction} /> : null}
              {secondaryAction ? <Button variant="outline" size="lg" {...secondaryAction} /> : null}

              {hasOptions ? (
                <DropdownActionsMenu
                  items={options ?? []}
                  align="end"
                  contentClassName="min-w-44"
                  triggerRender={<Button variant="outline" size="icon-lg" />}
                >
                  <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
                  <span className="sr-only">More options</span>
                </DropdownActionsMenu>
              ) : null}
            </div>
          ) : null}
        </div>

        {hasTabs ? (
          <Tabs
            defaultValue={tabs?.find((tab) => tab.active)?.key ?? tabs?.[0]?.key}
            value={tabs?.find((tab) => tab.active)?.key ?? tabs?.[0]?.key}
            className="mt-4 w-0 max-w-full min-w-full overflow-hidden border-b"
          >
            <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden px-6 [scrollbar-color:color-mix(in_oklab,var(--muted-foreground)_20%,transparent)_transparent] [scrollbar-width:thin] md:px-8 [&::-webkit-scrollbar]:h-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-track]:bg-transparent">
              <TabsList variant="line" aria-label="Page sections" className="w-max max-w-none">
                {tabs?.map((tab) => (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className="flex-none pb-2"
                    onClick={tab.onClick}
                    aria-current={tab.active ? 'page' : undefined}
                  >
                    <span>{tab.label}</span>
                    {tab.count !== undefined ? <span>({tab.count})</span> : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        ) : null}
      </div>
    </header>
  )
}

export { PageHeader }
export type { PageHeaderProps, PageHeaderTab, PageHeaderBreadcrumb }
