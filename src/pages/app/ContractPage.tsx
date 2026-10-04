import { Link, useNavigate, useParams } from 'react-router-dom'

import type { DataTableState } from '@/components/data-table'
import {
  type DetailPanelSection,
  DetailPageLayout,
  DetailSidePanel,
  EmptyRelatedEntityModule,
  RelatedEntityModule,
  type DetailPageModule,
} from '@/components/app/detail-page-layout'
import { EntityIcon } from '@/components/app/entity-icons'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { NO_VALUE_STR } from '@/constants'
import { getContractRequest } from '@/features/contracts/api'
import { getContractDeviceColumns, renderStatusBadge } from '@/features/contracts/contract-columns'
import { AttachedDocumentsCard, ContractActivityFeedCard } from '@/features/contracts/components/ContractDetailCards'
import { ContractService } from '@/features/contracts/contract-service'
import { contractsQueryKeys } from '@/features/contracts/query-keys'
import { getDevicesRequest, getDeviceTypesRequest } from '@/features/devices/api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { useDetailQuery, useDictionaryQuery } from '@/lib/query-hooks'
import { Drawer, DrawerId } from '@/providers/drawer'
import type { Contract } from '@/types/contract'
import type { Device } from '@/types/device'
import { DateUtils } from '@/utils'
import { formatDateTime } from '@/utils/date-utils'
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon'
import { HugeiconsIcon } from '@hugeicons/react'

const MODULE_ANCHOR_PREFIX = 'module'

const modules: DetailPageModule[] = [{ key: 'devices', label: 'Devices' }]

function CustomerLink({ contract }: { contract?: Contract }) {
  if (!contract?.customer?.name) return null

  return (
    <Link to={`/customers/${contract.customer.id}`} className="font-medium underline-offset-2 hover:underline">
      {contract.customer.name}
    </Link>
  )
}

function ContractModulesLoading() {
  return <EmptyRelatedEntityModule id={`${MODULE_ANCHOR_PREFIX}-devices`} title="Devices" description="Loading..." />
}

function renderContractSlaValue(contract?: Contract) {
  return contract ? ContractService.slaTypeToString(contract.slaType) : NO_VALUE_STR
}

function renderCustomerLink(contract?: Contract) {
  return contract?.customer?.name ? <CustomerLink contract={contract} /> : NO_VALUE_STR
}

function getContractDetailSections(contract?: Contract): DetailPanelSection[] {
  return [
    {
      title: 'Details',
      icon: EntityIcon.contracts,
      actions: contract ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit contract details"
          onClick={() => Drawer.show(DrawerId.CreateContract, { contract })}
        >
          <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
        </Button>
      ) : null,
      fields: [
        { label: 'Status', value: contract ? renderStatusBadge(contract) : NO_VALUE_STR },
        { label: 'ID', value: contract?.id ?? NO_VALUE_STR },
        { label: 'Name', value: contract?.name ?? NO_VALUE_STR },
        { label: 'Customer', value: renderCustomerLink(contract) },
        { label: 'Type', value: contract ? ContractService.typeToString(contract.type) : NO_VALUE_STR },
        { label: 'SLA type', value: renderContractSlaValue(contract) },
        { label: 'Start date', value: DateUtils.formatDisplayDate(contract?.startDate) },
        { label: 'End date', value: DateUtils.formatDisplayDate(contract?.endDate) },
        { label: 'Devices', value: String(contract?.devices?.length ?? 0) },
        {
          label: 'Created at',
          value: contract?.createdAt ? formatDateTime(contract.createdAt, NO_VALUE_STR) : NO_VALUE_STR,
        },
        {
          label: 'Updated at',
          value: contract?.updatedAt ? formatDateTime(contract.updatedAt, NO_VALUE_STR) : NO_VALUE_STR,
        },
      ],
    },
  ]
}

function ContractAside({ contract, isLoading = false }: { contract?: Contract; isLoading?: boolean }) {
  return (
    <>
      <DetailSidePanel sections={getContractDetailSections(contract)} isLoading={isLoading} />
      <AttachedDocumentsCard documents={contract?.documents} isLoading={isLoading || !contract} />
      <ContractActivityFeedCard contractId={contract?.id} isLoading={isLoading || !contract} />
    </>
  )
}

export default function ContractPage() {
  const { contractId = '' } = useParams()
  const navigate = useNavigate()

  useDictionaryQuery({
    queryKey: devicesQueryKeys.types,
    queryFn: getDeviceTypesRequest,
  })

  const {
    data: contract,
    isError,
    isLoading,
  } = useDetailQuery({
    queryKey: contractsQueryKeys.detail(contractId),
    queryFn: () => getContractRequest(contractId),
    enabled: Boolean(contractId),
  })

  if (isLoading) {
    return (
      <DetailPageLayout
        header={{ title: 'Contract name', subtitle: 'Loading...', backTo: '/contracts' }}
        modules={modules}
        aside={<ContractAside isLoading />}
      >
        <ContractModulesLoading />
      </DetailPageLayout>
    )
  }

  if (isError || !contract) {
    return (
      <>
        <PageHeader title="Contract not found" subtitle={contractId} backTo="/contracts" />
        <section className="p-4 md:p-6">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Failed to load this contract.
          </div>
        </section>
      </>
    )
  }

  const headerActions = ContractService.getDetailHeaderActions(contract, navigate)

  return (
    <DetailPageLayout
      header={{
        title: contract.name,
        subtitle: <CustomerLink contract={contract} />,
        backTo: '/contracts',
        options: headerActions.options,
      }}
      modules={modules}
      aside={<ContractAside contract={contract} />}
    >
      <RelatedEntityModule
        id={`${MODULE_ANCHOR_PREFIX}-devices`}
        title="Devices"
        icon={EntityIcon.devices}
        viewAllTo={`/devices?${new URLSearchParams({ 'f.contractId': contract.id }).toString()}`}
        queryKey={[...devicesQueryKeys.all, 'contract-module', contract.id]}
        loadData={(state: DataTableState<Device>) => getDevicesRequest(state, { contractId: contract.id })}
        tableKey="contracts.detail.modules.devices"
        columns={getContractDeviceColumns(contract)}
        getCommands={(devices) => ContractService.getDeviceCommands(devices, contract)}
        getRowCommands={(device) => ContractService.getDeviceRowActions(device, contract, navigate)}
        action={ContractService.getModuleAction(contract, 'devices', navigate)}
        loadingMessage="Loading devices..."
        emptyMessage="No devices found."
        refetchOnMount={false}
      />
    </DetailPageLayout>
  )
}
