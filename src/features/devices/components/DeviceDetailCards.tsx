import { useState } from 'react'
import NiceModal from '@ebay/nice-modal-react'
import EyeIcon from '@hugeicons/core-free-icons/EyeIcon'
import Edit03Icon from '@hugeicons/core-free-icons/Edit03Icon'
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon'
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import InformationCircleIcon from '@hugeicons/core-free-icons/InformationCircleIcon'
import Link01Icon from '@hugeicons/core-free-icons/Link01Icon'
import SecurityLockIcon from '@hugeicons/core-free-icons/SecurityLockIcon'
import { Link } from 'react-router-dom'

import type { DeviceTypeConfig, VariableEntry } from '@/features/device-types/api'
import { ActivityFeedCard as BaseActivityFeedCard } from '@/components/app/ActivityFeedCard'
import { BaseCard } from '@/components/app/BaseCard'
import { DetailCard } from '@/components/app/DetailCard'
import { DetailSidePanel, type DetailPanelSection } from '@/components/app/detail-page-layout'
import { EntityIcon } from '@/components/app/entity-icons'
import { AttachedDocumentsCard } from '@/components/app/AttachedDocumentsCard'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { SelectInput } from '@/components/ui/select-input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { KpiBlock, KpiRow, KpiTabs } from '@/components/app/KpiBlock'
import { DeviceStatus } from '@/features/devices/components/DeviceStatus'
import { DeviceService } from '@/features/devices/device-service'
import { getDevicesListRequest, removeDeviceFromSetRequest, updateDeviceVariableRequest } from '@/features/devices/api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { cn } from '@/lib/utils'
import { Modals, ModalId } from '@/providers/modal'
import { Drawer, DrawerId } from '@/providers/drawer'
import type { Device, DeviceData, DeviceDocument } from '@/types/device'
import { NO_VALUE_STR } from '@/constants'
import { InfoCardSkeleton } from '@/components/app/InfoCard'
import { AppDrawer } from '@/components/app/AppDrawer'
import { useDrawerController } from '@/providers/use-overlay-controller'
import { toast } from 'sonner'

type DeviceCardProps = {
  device?: Device
  isLoading?: boolean
  config?: DeviceTypeConfig
  onEditInfos?: () => void
  onSetPassword?: () => void
}

function getNestedValue(obj: Record<string, unknown> | null | undefined, path: string): unknown {
  if (!obj) return undefined

  const keys = path.split('.')
  const resolve = (current: unknown, index: number): unknown => {
    if (index >= keys.length) return current
    if (current === null || current === undefined || typeof current !== 'object') return undefined

    const key = keys[index]
    if (key.endsWith('[]')) {
      const arrayKey = key.slice(0, -2)
      const arrayValue = (current as Record<string, unknown>)[arrayKey]
      if (!Array.isArray(arrayValue)) return undefined
      return arrayValue.map((item) => resolve(item, index + 1)).filter((value) => value !== undefined)
    }

    const currentRecord = current as Record<string, unknown>
    if (key in currentRecord) {
      return resolve(currentRecord[key], index + 1)
    }

    const literalKey = keys.slice(index).join('.')
    if (literalKey in currentRecord) {
      return currentRecord[literalKey]
    }

    return undefined
  }

  return resolve(obj, 0)
}

function getMqttValue(
  rawByCategory: Record<string, Record<string, unknown> | null>,
  category: string,
  path: string,
): unknown {
  const categoryPayload = rawByCategory[category]
  const directValue = getNestedValue(categoryPayload, path)
  if (directValue !== undefined) return directValue

  const categoryPrefix = `${category}.`
  if (path.startsWith(categoryPrefix)) {
    return getNestedValue(categoryPayload, path.slice(categoryPrefix.length))
  }

  return getNestedValue(categoryPayload, `${category}.${path}`)
}

function formatVariableValue(value: unknown, entry: VariableEntry): string {
  if (value === null || value === undefined) return NO_VALUE_STR
  if (Array.isArray(value)) {
    const values = value.filter((item) => item !== null && item !== undefined).map((item) => formatVariableValue(item, entry))
    return values.length ? values.join('\n') : NO_VALUE_STR
  }
  if (entry.type === 'boolean') return value ? 'Yes' : 'No'
  const str = String(value)
  return entry.unit ? `${str} ${entry.unit}` : str
}

function formatGroupLabel(group: string): string {
  return group
    .replace(/\[\]$/, '')
    .replace(/[_.]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const CATEGORY_LABELS: Record<string, string> = {
  status: 'Status',
  info: 'Info',
  setup: 'Setup',
}

type MqttCategory = 'status' | 'info' | 'setup'

function getVisibleEntries(entries: VariableEntry[] = []) {
  return entries
    .filter((entry) => entry.display !== false)
    .sort((first, second) => (first.position ?? Infinity) - (second.position ?? Infinity))
}

function getEditableInputValue(value: unknown, entry: VariableEntry): string {
  if (value === null || value === undefined) return entry.type === 'boolean' ? 'false' : ''
  return entry.type === 'boolean' ? String(Boolean(value)) : String(value)
}

function coerceVariableValue(value: string, entry: VariableEntry): unknown {
  if (entry.type === 'boolean') return value === 'true'
  if (entry.type === 'integer') return Number.parseInt(value, 10)
  if (entry.type === 'float') return Number.parseFloat(value)
  return value
}

function getEntryMqttValue(
  rawByCategory: Record<string, Record<string, unknown> | null>,
  category: MqttCategory,
  entry: VariableEntry,
): unknown {
  return getMqttValue(rawByCategory, category, entry.group ? `${entry.group}.${entry.key}` : entry.key)
}

function getPresentationEntry(entry: VariableEntry): VariableEntry {
  if (entry.group) return entry

  const segments = entry.key.split('.')
  const arrayIndex = segments.findIndex((segment) => segment.endsWith('[]'))
  if (arrayIndex === -1) {
    if (segments.length < 2) return entry

    return {
      ...entry,
      group: segments[0],
      key: segments.slice(1).join('.'),
    }
  }

  return {
    ...entry,
    group: segments.slice(0, arrayIndex + 1).join('.'),
    key: segments.slice(arrayIndex + 1).join('.'),
  }
}

function EditableMqttValue({
  deviceId,
  source,
  entry,
  value,
}: {
  deviceId?: string
  source: MqttCategory
  entry: VariableEntry
  value: unknown
}) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [draftValue, setDraftValue] = useState(() => getEditableInputValue(value, entry))
  const displayValue = formatVariableValue(value, entry)

  const mutation = useMutation({
    mutationFn: () => {
      if (!deviceId) throw new Error('Device is missing')
      return updateDeviceVariableRequest(deviceId, {
        key: entry.key,
        group: entry.group,
        source,
        value: coerceVariableValue(draftValue, entry),
      })
    },
    onSuccess: (result) => {
      toast.success(result.confirmed === false ? 'Command sent. Waiting for device refresh.' : 'Variable updated.')
      if (deviceId) void queryClient.invalidateQueries({ queryKey: devicesQueryKeys.detail(deviceId) })
      setIsEditing(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Unable to update variable')
    },
  })

  if (!entry.editable || !entry.write || !deviceId) {
    return <span className="whitespace-pre-line break-words">{displayValue}</span>
  }

  if (!isEditing) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('min-w-0 whitespace-pre-line break-words', Array.isArray(value) && 'border-l pl-2')}>
          {displayValue}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${entry.label}`}
          onClick={() => {
            setDraftValue(getEditableInputValue(value, entry))
            setIsEditing(true)
          }}
        >
          <HugeiconsIcon icon={Edit03Icon} strokeWidth={2} className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {entry.type === 'boolean' ? (
        <SelectInput
          value={draftValue}
          items={[
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
          onValueChange={(nextValue) => setDraftValue(String(nextValue))}
          disabled={mutation.isPending}
          className="w-28"
        />
      ) : (
        <TextInput
          value={draftValue}
          type={entry.type === 'integer' || entry.type === 'float' ? 'number' : 'text'}
          step={entry.type === 'integer' ? 1 : undefined}
          onChange={(event) => setDraftValue(event.target.value)}
          disabled={mutation.isPending}
          className="h-8 w-36"
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Save ${entry.label}`}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? <Spinner className="size-4" /> : <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Cancel edit"
        disabled={mutation.isPending}
        onClick={() => setIsEditing(false)}
      >
        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
      </Button>
    </div>
  )
}

function DeviceMqttGroupValue({
  deviceId,
  source,
  entries,
  value,
}: {
  deviceId?: string
  source: MqttCategory
  entries: VariableEntry[]
  value: unknown
}) {
  if (Array.isArray(value)) {
    if (!value.length) return <span>{NO_VALUE_STR}</span>

    return (
      <div className="grid gap-2">
        {value.map((item, index) => (
          <div key={index} className="rounded-md border bg-muted/30 p-2.5">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">{`Element ${index + 1}`}</div>
            <dl className="grid gap-2">
              {entries.map((entry) => (
                <div key={`${entry.key}-${index}`} className="grid grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] gap-2">
                  <dt className="min-w-0 text-muted-foreground">{entry.label}</dt>
                  <dd className="min-w-0 whitespace-pre-line break-words text-foreground">
                    {formatVariableValue(getNestedValue(item as Record<string, unknown>, entry.key), entry)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    )
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>

    return (
      <div className="rounded-md border bg-muted/30 p-2.5">
        <dl className="grid gap-2">
          {entries.map((entry) => (
            <div key={entry.key} className="grid grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] gap-2">
              <dt className="min-w-0 text-muted-foreground">{entry.label}</dt>
              <dd className="min-w-0 text-foreground">
                <EditableMqttValue
                  deviceId={deviceId}
                  source={source}
                  entry={entry}
                  value={getNestedValue(record, entry.key)}
                />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  return <span>{NO_VALUE_STR}</span>
}

function DeviceInfoCard({ device, config, isLoading = false, onSetPassword }: DeviceCardProps) {
  if (isLoading) return <DetailSidePanel sections={[{ title: 'Infos', fields: [] }]} isLoading />

  const mapping = config?.variableMapping
  const rawByCategory = {
    status: device?.rawStatus ?? null,
    info: device?.rawInfo ?? null,
    setup: device?.rawSetup ?? null,
  }
  const hasRawData = rawByCategory.status || rawByCategory.info || rawByCategory.setup
  const categories = (['status', 'info', 'setup'] as const).filter(
    (cat) => getVisibleEntries(mapping?.[cat]).length > 0,
  )
  const categoryFields = categories.map((cat) => {
    const entries = getVisibleEntries(mapping?.[cat])
    const groupedEntries = new Map<string, VariableEntry[]>()
    const ungroupedEntries: VariableEntry[] = []

    entries.forEach((entry) => {
      const presentationEntry = getPresentationEntry(entry)
      if (!presentationEntry.group) {
        ungroupedEntries.push(presentationEntry)
        return
      }

      groupedEntries.set(presentationEntry.group, [
        ...(groupedEntries.get(presentationEntry.group) ?? []),
        presentationEntry,
      ])
    })

    return {
      label: <span className="font-semibold text-foreground">{CATEGORY_LABELS[cat]}</span>,
      layout: 'column' as const,
      children: [
        ...ungroupedEntries.map((entry) => ({
          label: entry.label,
          value: (
            <EditableMqttValue
              deviceId={device?.id}
              source={cat}
              entry={entry}
              value={getEntryMqttValue(rawByCategory, cat, entry)}
            />
          ),
        })),
        ...Array.from(groupedEntries.entries()).map(([group, groupEntries]) => ({
          label: formatGroupLabel(group),
          layout: 'column' as const,
          value: (
            <DeviceMqttGroupValue
              deviceId={device?.id}
              source={cat}
              entries={groupEntries}
              value={getMqttValue(rawByCategory, cat, group)}
            />
          ),
        })),
      ],
    }
  })
  const sections: DetailPanelSection[] = [
    {
      title: 'Infos',
      icon: InformationCircleIcon,
      actions: hasRawData ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Show raw MQTT data"
          onClick={() => NiceModal.show(DeviceRawMqttDataDrawer, { rawByCategory })}
        >
          <HugeiconsIcon icon={EyeIcon} strokeWidth={2} className="size-4" />
        </Button>
      ) : null,
      fields: [
        ...(categoryFields.length ? categoryFields : [{ label: 'Infos', value: NO_VALUE_STR }]),
        {
          label: <span className="font-semibold text-foreground">Connection</span>,
          layout: 'column',
          children: [
            {
              label: 'Connected device',
              value: device?.connectedDevice ?? 'No device assigned',
              // value: (
              //   <div className="flex flex-wrap items-center gap-2">
              //     <span>{device?.connectedDevice ?? 'No device assigned'}</span>
              //     <Button variant="outline" size="sm" onClick={onEditInfos}>
              //       Edit
              //     </Button>
              //   </div>
              // ),
            },
            {
              label: 'Broker',
              value: (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon icon={SecurityLockIcon} strokeWidth={2} className="size-4 text-orange-500" />
                    {device?.broker ?? 'Public'}
                  </span>
                  <Button variant="outline" size="sm" onClick={onSetPassword}>
                    <HugeiconsIcon icon={Link01Icon} strokeWidth={2} data-icon="inline-start" />
                    Set password
                  </Button>
                </div>
              ),
            },
          ],
        },
      ],
    },
  ]

  return <DetailSidePanel sections={sections} fieldLayout="row" />
}

type RawMqttData = {
  status: Record<string, unknown> | null
  info: Record<string, unknown> | null
  setup: Record<string, unknown> | null
}

const DeviceRawMqttDataDrawer = NiceModal.create<{ rawByCategory: RawMqttData }>(({ rawByCategory }) => {
  const drawer = useDrawerController()
  const rawData = Object.fromEntries(Object.entries(rawByCategory).filter(([, value]) => value != null))

  return (
    <AppDrawer
      title="Raw MQTT data"
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      // direction="left"
      contentClassName="sm:max-w-2xl"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7">
        <pre className="overflow-x-auto rounded-lg border bg-muted p-4 font-mono text-xs leading-relaxed text-foreground">
          {JSON.stringify(rawData, null, 2)}
        </pre>
      </div>
    </AppDrawer>
  )
})

function DeviceItemsCard({ device, isLoading = false }: DeviceCardProps) {
  const queryClient = useQueryClient()

  const setItemsQueryKey = [...devicesQueryKeys.all, 'set-items', device?.id]

  const { data: devices = [], isLoading: isLoadingItems } = useQuery({
    queryKey: setItemsQueryKey,
    queryFn: () => getDevicesListRequest({ parentId: device!.id }),
    enabled: !!device?.id,
  })

  const removeMutation = useMutation({
    mutationFn: (deviceId: string) => removeDeviceFromSetRequest(deviceId),
    onSuccess: async () => {
      if (!device) return

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: setItemsQueryKey }),
        queryClient.invalidateQueries({ queryKey: devicesQueryKeys.detail(device.id) }),
      ])
    },
  })

  if (isLoading || !device) return <InfoCardSkeleton length={10} />

  return (
    <BaseCard>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-4" />
          Devices
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              Drawer.show(DrawerId.AddDevicesToSet, {
                deviceSetId: device.id,
                existingDeviceIds: devices.map((d) => d.id),
              }).then(() =>
                Promise.all([
                  queryClient.invalidateQueries({ queryKey: setItemsQueryKey }),
                  queryClient.invalidateQueries({ queryKey: devicesQueryKeys.detail(device.id) }),
                ]),
              )
            }
          >
            Add device
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              Drawer.show(DrawerId.CreateDevice, { parentId: device.id }).then(() =>
                Promise.all([
                  queryClient.invalidateQueries({ queryKey: setItemsQueryKey }),
                  queryClient.invalidateQueries({ queryKey: devicesQueryKeys.detail(device.id) }),
                ]),
              )
            }
          >
            Create new device
          </Button>
        </div>
      </div>

      {isLoadingItems ? (
        <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">Loading…</div>
      ) : devices.length ? (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Device name</th>
                <th className="px-4 py-3 font-semibold">Serial number</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Store</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {devices.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link to={`/devices/${item.id}`} className="font-medium underline-offset-2 hover:underline">
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{item.serialNumber || NO_VALUE_STR}</td>
                  <td className="px-4 py-3">{DeviceService.getTypeLabelsFromQuery(item).join(', ') || NO_VALUE_STR}</td>
                  <td className="px-4 py-3">
                    <DeviceStatus status={item.status} />
                  </td>
                  <td className="px-4 py-3">{item.store?.name || NO_VALUE_STR}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-sm text-destructive underline-offset-2 hover:underline disabled:opacity-50"
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(item.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">No devices yet</div>
      )}
    </BaseCard>
  )
}

function DeviceDataCard({ data, isLoading = false }: { data?: DeviceData; isLoading?: boolean }) {
  const [period, setPeriod] = useState<'week' | 'month'>('week')

  if (isLoading) return <DeviceDataCardSkeleton />
  const kpiData = period === 'week' ? data?.weekData : data?.monthData

  return (
    <DetailCard icon={EntityIcon.data} title="Device data" className="gap-6 rounded-xl p-4 shadow-none">
      <KpiBlock
        title="KPIs title"
        action={
          <KpiTabs
            value={period}
            tabs={[
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
            onValueChange={(value) => {
              if (value === 'week' || value === 'month') setPeriod(value)
            }}
          />
        }
      >
        <KpiRow label="Total tests" value={kpiData?.totalTests.value} direction={kpiData?.totalTests.dir} />
        <KpiRow
          label="Average tests per device"
          value={kpiData?.averageTestsPerDevice.value}
          direction={kpiData?.averageTestsPerDevice.dir}
        />
        <KpiRow
          label="Average tests per day"
          value={kpiData?.averageTestsPerDay.value}
          direction={kpiData?.averageTestsPerDay.dir}
        />
      </KpiBlock>
    </DetailCard>
  )
}

function DeviceDataCardSkeleton() {
  return <DeviceSideCardSkeleton titleWidth="w-36" lines={5} />
}

function SupportMaintenanceCard({
  documents = [],
  isLoading = false,
  onAdd,
}: {
  documents?: DeviceDocument[]
  isLoading?: boolean
  onAdd?: () => void
}) {
  return (
    <AttachedDocumentsCard
      title="Support & maintenance"
      documents={documents}
      isLoading={isLoading}
      secondaryAction="copy"
      onAdd={onAdd}
      onOpen={(document) => {
        if (document.url) window.open(document.url, '_blank', 'noopener,noreferrer')
      }}
      onCopy={(document) => {
        if (document.url) void navigator.clipboard?.writeText(document.url)
      }}
    />
  )
}

function ActivityFeedCard({
  deviceId,
  items,
  isLoading = false,
}: {
  deviceId?: string
  items?: Device['activityFeed']
  isLoading?: boolean
}) {
  return (
    <BaseActivityFeedCard
      items={items}
      isLoading={isLoading}
      onAddIntervention={() => Modals.show(ModalId.AddIntervention, { deviceId })}
      onAddComment={() => Modals.show(ModalId.AddComment, { deviceId })}
      onSettings={() => {}}
    />
  )
}

function DeviceSideCardSkeleton({ titleWidth, lines }: { titleWidth: string; lines: number }) {
  return (
    <BaseCard skeleton>
      <Skeleton className={cn('h-5', titleWidth)} />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className="h-4" />
      ))}
    </BaseCard>
  )
}

export { ActivityFeedCard, DeviceDataCard, DeviceInfoCard, DeviceItemsCard, SupportMaintenanceCard }
