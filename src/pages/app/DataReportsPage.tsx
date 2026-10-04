import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { PageHeader } from '@/components/ui/page-header'
import {
  generateDataReportRequest,
  getDataReportComparisonOptionsRequest,
  getDataReportFiltersRequest,
  getDataReportProductInteractionsRequest,
  getDataReportRequest,
} from '@/features/data/api'
import { DataReportChartCard } from '@/features/data/components/DataReportCharts'
import { DATA_REPORT_FILTER_KEYS, DataReportFiltersBar } from '@/features/data/components/DataReportFilters'
import { DataReportKpiCards, DeviceAnalyticsCard } from '@/features/data/components/DataReportKpis'
import { DataReportProductInteractions } from '@/features/data/components/DataReportProductInteractions'
import { DataService } from '@/features/data/data-service'
import { dataReportQueryKeys } from '@/features/data/query-keys'
import type { DataReportFilters } from '@/types/data-report'

export default function DataReportsPage() {
  const [filters, setFilters] = useState<DataReportFilters>({})
  const [filterKeys, setFilterKeys] = useState(DATA_REPORT_FILTER_KEYS)

  const reportQuery = useQuery({
    queryKey: dataReportQueryKeys.detail(filters),
    queryFn: () => getDataReportRequest(filters),
  })
  const comparisonOptionsQuery = useQuery({
    queryKey: [...dataReportQueryKeys.all, 'comparison-options'],
    queryFn: getDataReportComparisonOptionsRequest,
  })
  const productInteractionsQuery = useQuery({
    queryKey: dataReportQueryKeys.productInteractions(filters),
    queryFn: () => getDataReportProductInteractionsRequest(filters),
  })
  const filterMetadataQuery = useQuery({
    queryKey: [...dataReportQueryKeys.all, 'filters', filterKeys],
    queryFn: () => getDataReportFiltersRequest(filterKeys),
    staleTime: 5 * 60 * 1000,
  })

  const generateReportMutation = useMutation({
    mutationFn: generateDataReportRequest,
    onSuccess: (report) => {
      DataService.downloadGeneratedReport(report)
      DataService.notifyReportGenerated()
    },
    onError: () => {
      DataService.notifyReportGenerationFailed()
    },
  })

  const charts = reportQuery.data?.charts
  const selectedCharts = useMemo(
    () => ({
      linear: DataService.chartById(charts, 'linear'),
      dailyTests: DataService.chartById(charts, 'daily-tests'),
      deviceVolume: DataService.chartById(charts, 'device-volume'),
      testsShare: DataService.chartById(charts, 'tests-share'),
      ageGroups: DataService.chartById(charts, 'age-groups'),
      productShare: DataService.chartById(charts, 'product-share'),
      distance: DataService.chartById(charts, 'distance'),
      trafficZone: DataService.chartById(charts, 'traffic-zone'),
    }),
    [charts],
  )

  return (
    <>
      <PageHeader
        title="Data reports"
        subtitle={DataService.formatGeneratedAt(reportQuery.data?.generatedAt)}
        primaryAction={{
          children: 'Generate report',
          loading: generateReportMutation.isPending,
          onClick: () => generateReportMutation.mutate(filters),
        }}
        options={[
          {
            label: 'Refresh data',
            onClick: () => {
              void reportQuery.refetch()
            },
          },
          {
            label: 'Clear filters',
            onClick: () => setFilters({}),
          },
        ]}
      />

      <section className="px-6 pb-8 md:px-8">
        <div className="mx-auto flex flex-col gap-5">
          <DataReportFiltersBar
            filters={filters}
            filterMetadata={filterMetadataQuery.data?.filters ?? []}
            filterKeys={filterKeys}
            comparisonOptions={comparisonOptionsQuery.data ?? []}
            onFiltersChange={setFilters}
            onFilterKeysChange={setFilterKeys}
            onReset={() => setFilters({})}
          />

          <DataReportKpiCards kpis={reportQuery.data?.kpis ?? []} />

          <div className="grid gap-5 xl:grid-cols-[1fr_3fr]">
            <DeviceAnalyticsCard kpis={reportQuery.data?.deviceAnalytics ?? []} />
            {selectedCharts.linear ? (
              <DataReportChartCard chart={selectedCharts.linear} className="rounded-lg" />
            ) : null}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {selectedCharts.dailyTests ? (
              <DataReportChartCard chart={selectedCharts.dailyTests} className="rounded-lg" />
            ) : null}
            {selectedCharts.deviceVolume ? (
              <DataReportChartCard chart={selectedCharts.deviceVolume} className="rounded-lg" />
            ) : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {selectedCharts.testsShare ? (
              <DataReportChartCard chart={selectedCharts.testsShare} className="rounded-lg" />
            ) : null}
            {selectedCharts.ageGroups ? (
              <DataReportChartCard chart={selectedCharts.ageGroups} className="rounded-lg" />
            ) : null}
            {selectedCharts.productShare ? (
              <DataReportChartCard chart={selectedCharts.productShare} className="rounded-lg" />
            ) : null}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {selectedCharts.distance ? (
              <DataReportChartCard chart={selectedCharts.distance} className="rounded-lg" height={260} />
            ) : null}
            {selectedCharts.trafficZone ? (
              <DataReportChartCard chart={selectedCharts.trafficZone} className="rounded-lg" height={300} />
            ) : null}
          </div>

          <DataReportProductInteractions
            products={productInteractionsQuery.data ?? []}
            loading={productInteractionsQuery.isFetching}
          />
        </div>
      </section>
    </>
  )
}
