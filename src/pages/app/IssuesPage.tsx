import { useCallback, useMemo, useState } from 'react'

import { DataTableAsync, type DataTableState } from '@/components/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getDeviceTypesRequest } from '@/features/devices/api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { getIssuesRequest } from '@/features/issues/api'
import { issueColumns } from '@/features/issues/issue-columns'
import { IssueService } from '@/features/issues/issue-service'
import { getIssueTypeLabels } from '@/features/issues/issue-utils'
import { issuesQueryKeys } from '@/features/issues/query-keys'
import { useDictionaryQuery } from '@/lib/query-hooks'
import { NO_VALUE_STR } from '@/constants'
import { IssueSeverity, type Issue } from '@/types/issue'

type IssueTab = 'all' | IssueSeverity

export default function IssuesPage() {
  const [activeTab, setActiveTab] = useState<IssueTab>('all')

  useDictionaryQuery({
    queryKey: devicesQueryKeys.types,
    queryFn: getDeviceTypesRequest,
  })

  const hiddenFilters = useMemo(() => {
    if (activeTab === 'all') return undefined

    return { severity: activeTab }
  }, [activeTab])

  const loadIssues = useCallback(
    (tableState: DataTableState<Issue>) => getIssuesRequest(tableState, hiddenFilters),
    [hiddenFilters],
  )

  return (
    <>
      <PageHeader title="Issues" />

      <section className="space-y-5 p-4 md:p-6">
        <IssueSeverityTabs value={activeTab} onValueChange={setActiveTab} />

        <DataTableAsync
          key={activeTab}
          queryKey={[...issuesQueryKeys.all, 'table', activeTab]}
          loadData={loadIssues}
          tableKey={`issues.root.${activeTab}`}
          columns={issueColumns}
          searchPlaceholder="Search by ID, name..."
          searchColumns={['id', 'title', 'serialNumber']}
          filters={[
            {
              id: 'customerId',
              label: 'Customer',
              column: 'customer',
              getValue: (issue) => issue.customer?.name || issue.device?.customer?.name || NO_VALUE_STR,
            },
            {
              id: 'deviceType',
              label: 'Device type',
              column: 'deviceType',
              getValue: (issue) => getIssueTypeLabels(issue),
            },
            {
              id: 'severity',
              label: 'Issue type',
              column: 'severity',
              options: IssueService.severityKeys().map((severity) => IssueService.severityToString(severity)),
              getValue: (issue) => IssueService.severityToString(issue.severity),
            },
            {
              id: 'slaClass',
              label: 'SLA',
              column: 'slaClass',
              options: IssueService.slaClassKeys().map((slaClass) => IssueService.slaClassToString(slaClass)),
              getValue: (issue) => (issue.slaClass ? IssueService.slaClassToString(issue.slaClass) : NO_VALUE_STR),
            },
          ]}
          getCommands={(issues) => IssueService.getTableActions(issues)}
          getRowCommands={(issue) => IssueService.getActions(issue)}
          loadingMessage="Loading issues..."
          emptyMessage="No issues found."
          errorMessage="Failed to load issues."
        />
      </section>
    </>
  )
}

function IssueSeverityTabs({ value, onValueChange }: { value: IssueTab; onValueChange: (value: IssueTab) => void }) {
  const tabs: Array<{ value: IssueTab; label: string }> = [
    { value: 'all', label: 'All' },
    { value: IssueSeverity.Alert, label: IssueService.severityToString(IssueSeverity.Alert) },
    { value: IssueSeverity.Warning, label: IssueService.severityToString(IssueSeverity.Warning) },
  ]

  return (
    <Tabs value={value} onValueChange={(nextValue) => onValueChange(nextValue as IssueTab)}>
      <TabsList
        aria-label="Issue severity"
        className="h-8 overflow-hidden rounded-lg border border-border bg-background p-0 text-foreground"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="h-full rounded-none border-0 border-r border-border px-4 text-sm font-semibold data-active:bg-foreground data-active:text-background data-active:after:hidden"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
