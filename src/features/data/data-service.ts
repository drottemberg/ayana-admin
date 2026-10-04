import { toast } from 'sonner'

import type { DataReportChart, GeneratedReport } from '@/types/data-report'

export const DataService = {
  chartById(charts: DataReportChart[] | undefined, id: string) {
    return charts?.find((chart) => chart.id === id)
  },

  formatGeneratedAt(value?: string) {
    if (!value) return 'Preparing report data'

    return `Updated ${new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))}`
  },

  downloadGeneratedReport(report: GeneratedReport) {
    const blob = report.content instanceof Blob ? report.content : new Blob([report.content], { type: report.mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = report.fileName
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },

  notifyReportGenerated() {
    toast.success('Report generated.')
  },

  notifyReportGenerationFailed() {
    toast.error('Could not generate report.')
  },
}
