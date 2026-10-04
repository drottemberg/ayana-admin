import { useQuery } from '@tanstack/react-query'

import { ActivityFeedCard as BaseActivityFeedCard } from '@/components/app/ActivityFeedCard'
import { AttachedDocumentsCard as BaseAttachedDocumentsCard } from '@/components/app/AttachedDocumentsCard'
import { BaseCard } from '@/components/app/BaseCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getContractEventsRequest } from '@/features/contracts/api'
import { ContractService } from '@/features/contracts/contract-service'
import { ContractSlaBadge } from '@/features/contracts/components/ContractSlaBadge'
import { contractsQueryKeys } from '@/features/contracts/query-keys'
import { cn } from '@/lib/utils'
import { Modals, ModalId } from '@/providers/modal'
import type { Contract, ContractDocument } from '@/types/contract'
import { NO_VALUE_STR } from '@/constants'

type ContractCardProps = {
  contract?: Contract
  isLoading?: boolean
  onEditInfos?: () => void
}

function ContractSummaryCard({ contract, isLoading = false, onEditInfos }: ContractCardProps) {
  if (isLoading || !contract) return <ContractSummaryCardSkeleton />

  return (
    <BaseCard className="flex-row items-center gap-5">
      <div className="h-16 w-28 shrink-0 overflow-hidden rounded-md bg-zinc-900">
        <div className="grid h-full grid-cols-6 gap-1 bg-[linear-gradient(135deg,#4b5563_0%,#111827_52%,#6b7280_100%)] p-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className="mt-auto h-8 rounded-sm bg-zinc-100 shadow-inner" />
          ))}
        </div>
      </div>

      <div className="grid min-w-0 flex-1 gap-2 text-sm md:grid-cols-[auto_auto_auto_1fr] md:items-center md:gap-x-8">
        <ContractMeta label="Status" value={ContractService.statusToString(contract.status)} />
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-semibold">SLA:</span>
          <ContractSlaBadge slaType={contract.slaType} />
        </div>
        <ContractMeta label="Customer" value={contract.customer?.name || NO_VALUE_STR} link />
      </div>

      <Button variant="outline" size="sm" className="ml-auto hidden md:inline-flex" onClick={onEditInfos}>
        Edit infos
      </Button>
    </BaseCard>
  )
}

function ContractSummaryCardSkeleton() {
  return (
    <BaseCard className="flex-row items-center gap-5" skeleton>
      <Skeleton className="h-16 w-28 shrink-0" />
      <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-4">
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
      </div>
      <Skeleton className="ml-auto hidden h-8 w-20 md:block" />
    </BaseCard>
  )
}

function AttachedDocumentsCard({
  documents = [],
  isLoading = false,
}: {
  documents?: ContractDocument[]
  isLoading?: boolean
}) {
  return (
    <BaseAttachedDocumentsCard
      title="Attached documents"
      documents={documents}
      isLoading={isLoading}
      secondaryAction="copy"
      onOpen={(document) => {
        if (document.url) window.open(document.url, '_blank', 'noopener,noreferrer')
      }}
      onCopy={(document) => {
        if (document.url) void navigator.clipboard?.writeText(document.url)
      }}
    />
  )
}

function ContractActivityFeedCard({ contractId, isLoading = false }: { contractId?: string; isLoading?: boolean }) {
  const eventsQuery = useQuery({
    queryKey: contractId ? [...contractsQueryKeys.detail(contractId), 'events'] : [...contractsQueryKeys.all, 'events'],
    queryFn: () => getContractEventsRequest(contractId!),
    enabled: !!contractId && !isLoading,
  })

  return (
    <BaseActivityFeedCard
      items={eventsQuery.data ?? []}
      isLoading={isLoading || eventsQuery.isLoading}
      onAddComment={() => Modals.show(ModalId.AddComment, { deviceId: contractId })}
      onSettings={() => {}}
    />
  )
}

function ContractMeta({ label, value, link = false }: { label: string; value: string; link?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="font-semibold">{label} :</span>{' '}
      <span className={cn('truncate', link && 'underline underline-offset-2')}>{value}</span>
    </div>
  )
}

export { AttachedDocumentsCard, ContractActivityFeedCard, ContractSummaryCard }
