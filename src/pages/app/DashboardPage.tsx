import { lazy, Suspense } from 'react'
import { DataTable } from '@/components/data-table'
import { SectionCards } from '@/components/section-cards'
import data from '@/app/dashboard/data.json'
import { PageHeader } from '@/components/ui/page-header'

const ChartAreaInteractive = lazy(() => import('@/components/chart-area-interactive'))

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />

      <section className="p-4 md:p-6">
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <Suspense fallback={null}>
                  <ChartAreaInteractive />
                </Suspense>
              </div>
              <DataTable data={data} />
            </div>
          </div>
        </div>
      </section>
    </>
  )

  return <main className="flex min-h-svh items-center justify-center p-6 md:p-10"></main>
}
