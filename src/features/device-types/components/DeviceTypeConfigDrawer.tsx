import NiceModal from '@ebay/nice-modal-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { HugeiconsIcon } from '@hugeicons/react'
import AddCircleIcon from '@hugeicons/core-free-icons/AddCircleIcon'
import Delete01Icon from '@hugeicons/core-free-icons/Delete01Icon'
import DragDropHorizontalIcon from '@hugeicons/core-free-icons/DragDropHorizontalIcon'
import Edit03Icon from '@hugeicons/core-free-icons/Edit03Icon'
import EditOff03Icon from '@hugeicons/core-free-icons/EditOff03Icon'
import EyeIcon from '@hugeicons/core-free-icons/EyeIcon'
import ViewOffIcon from '@hugeicons/core-free-icons/ViewOffIcon'

import { AppDrawer } from '@/components/app/AppDrawer'
import { Modals } from '@/providers/modal'
import { useDrawerController } from '@/providers/use-overlay-controller'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/form-error'
import { TextInput } from '@/components/ui/text-input'
import { SelectInput } from '@/components/ui/select-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  createDeviceTypeConfigRequest,
  updateDeviceTypeConfigRequest,
  type DeviceTypeCommandDefinition,
  type DeviceTypeConfig,
  type DeviceTypeGroup,
  type VariableEntry,
  type VariableMapping,
} from '@/features/device-types/api'
import { deviceTypeConfigsQueryKeys } from '@/features/device-types/query-keys'
import { getDeviceTypeLabel } from '@/features/device-types/utils'

type MappingBlock = 'status' | 'info' | 'setup'
type VariableType = VariableEntry['type']
type JsonEditMode = 'form' | 'expert'

type EditableVariableEntry = Omit<VariableEntry, 'position' | 'unit'> & {
  id: string
  unit: string
  group: string
  display: boolean
  keyEdited: boolean
  writePayloadJson: string
  writePayloadError: string | null
}

type MappingFormState = Record<MappingBlock, EditableVariableEntry[]>
type EntryValidationErrors = Partial<Record<'key' | 'group' | 'label' | 'unit', string>>
type MappingValidation = {
  message: string | null
  errors: Record<string, EntryValidationErrors>
}

const BLOCKS: { key: MappingBlock; title: string }[] = [
  { key: 'status', title: 'Status' },
  { key: 'info', title: 'Info' },
  { key: 'setup', title: 'Setup' },
]

const VARIABLE_TYPES = ['float', 'integer', 'string', 'boolean'] as const
const VARIABLE_TYPE_OPTIONS = VARIABLE_TYPES.map((type) => ({ value: type, label: type }))
const MAPPING_KEY_REGEX = /^[A-Za-z0-9_.]+$/
const FIELD_LIMITS = {
  key: 64,
  label: 120,
  unit: 16,
} as const

const editableVariableEntrySchema = z.object({
  id: z.string(),
  key: z
    .string()
    .trim()
    .min(1, 'Key is required')
    .max(FIELD_LIMITS.key, `Key must be ${FIELD_LIMITS.key} characters or less`)
    .refine((value) => !value || MAPPING_KEY_REGEX.test(value), 'Use letters, numbers, _ and .'),
  group: z.string().max(FIELD_LIMITS.key, `Group must be ${FIELD_LIMITS.key} characters or less`),
  label: z
    .string()
    .trim()
    .min(1, 'Label is required')
    .max(FIELD_LIMITS.label, `Label must be ${FIELD_LIMITS.label} characters or less`),
  unit: z.string().max(FIELD_LIMITS.unit, `Unit must be ${FIELD_LIMITS.unit} characters or less`),
  type: z.enum(VARIABLE_TYPES),
  display: z.boolean(),
  editable: z.boolean(),
}).passthrough()

function createEntriesSchema() {
  return z.array(editableVariableEntrySchema).superRefine((entries, ctx) => {
    const keyCounts = entries.reduce<Record<string, number>>((counts, entry) => {
      const key = [entry.group.trim(), entry.key.trim()].filter(Boolean).join('.')
      if (key) counts[key] = (counts[key] ?? 0) + 1
      return counts
    }, {})

    entries.forEach((entry, index) => {
      const key = [entry.group.trim(), entry.key.trim()].filter(Boolean).join('.')
      if (!key || keyCounts[key] <= 1) return

      ctx.addIssue({
        code: 'custom',
        path: [index, 'key'],
        message: 'Key is duplicated in this block',
      })
    })
  })
}

const mappingFormSchema = z.object({
  status: createEntriesSchema(),
  info: createEntriesSchema(),
  setup: createEntriesSchema(),
})

const rawVariableEntrySchema = z.object({
  key: z.string().trim().min(1, 'Key is required'),
  group: z.string().optional(),
  label: z.string().trim().min(1, 'Label is required'),
  unit: z.string().optional(),
  type: z.enum(VARIABLE_TYPES),
  position: z.number().int().positive().optional(),
  display: z.boolean().optional(),
  editable: z.boolean().optional(),
  write: z.record(z.string(), z.unknown()).optional(),
}).passthrough()

const rawVariableMappingSchema = z.object({
  status: z.array(rawVariableEntrySchema).optional(),
  info: z.array(rawVariableEntrySchema).optional(),
  setup: z.array(rawVariableEntrySchema).optional(),
}).passthrough()

export type DeviceTypeConfigDrawerProps = {
  config?: DeviceTypeConfig
  group?: DeviceTypeGroup
  groups?: DeviceTypeGroup[]
  existingTypes?: string[]
  invalidateQueryKey?: readonly unknown[]
}

function toSnakeCase(value: string) {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_.]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
    .slice(0, FIELD_LIMITS.key)
}

function toGeneratedKey(value: string) {
  return toSnakeCase(value).toLowerCase()
}

function createEntryId(block: MappingBlock, index: number, key?: string) {
  return `${block}-${key || 'field'}-${index}`
}

function createEmptyEntry(block: MappingBlock, index: number): EditableVariableEntry {
  return {
    id: createEntryId(block, index, `new-${Date.now()}`),
    key: '',
    group: '',
    label: '',
    unit: '',
    type: 'string',
    display: true,
    editable: false,
    writePayloadJson: '',
    writePayloadError: null,
    keyEdited: false,
  }
}

function normalizeEntries(block: MappingBlock, entries: VariableEntry[] = []): EditableVariableEntry[] {
  return [...entries]
    .sort((first, second) => (first.position ?? Number.MAX_SAFE_INTEGER) - (second.position ?? Number.MAX_SAFE_INTEGER))
    .map((entry, index) => ({
      id: createEntryId(block, index, entry.key),
      key: entry.key ?? '',
      group: entry.group ?? '',
      label: entry.label ?? '',
      unit: entry.unit ?? '',
      type: entry.type ?? 'string',
      display: entry.display ?? true,
      editable: entry.editable ?? false,
      ...(entry.write ? { write: entry.write } : {}),
      writePayloadJson: entry.write?.payload === undefined ? '' : JSON.stringify(entry.write.payload, null, 2),
      writePayloadError: null,
      keyEdited: true,
    }))
}

function normalizeMapping(mapping?: VariableMapping): MappingFormState {
  return {
    status: normalizeEntries('status', mapping?.status),
    info: normalizeEntries('info', mapping?.info),
    setup: normalizeEntries('setup', mapping?.setup),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toLooseVariableEntry(value: unknown): VariableEntry {
  const entry = isRecord(value) ? value : {}
  const type: VariableType =
    typeof entry.type === 'string' && VARIABLE_TYPES.includes(entry.type as VariableType)
      ? (entry.type as VariableType)
      : 'string'

  return {
    key: typeof entry.key === 'string' ? entry.key : '',
    ...(typeof entry.group === 'string' ? { group: entry.group } : {}),
    label: typeof entry.label === 'string' ? entry.label : '',
    type,
    ...(typeof entry.unit === 'string' ? { unit: entry.unit } : {}),
    ...(typeof entry.position === 'number' ? { position: entry.position } : {}),
    ...(typeof entry.display === 'boolean' ? { display: entry.display } : {}),
    ...(typeof entry.editable === 'boolean' ? { editable: entry.editable } : {}),
    ...(isRecord(entry.write) ? { write: entry.write as VariableEntry['write'] } : {}),
  }
}

function toLooseVariableMapping(value: unknown): VariableMapping | null {
  if (!isRecord(value)) return null

  return BLOCKS.reduce<VariableMapping>((mapping, block) => {
    const entries = value[block.key]
    mapping[block.key] = Array.isArray(entries) ? entries.map(toLooseVariableEntry) : []
    return mapping
  }, {})
}

function toVariableMapping(blocks: MappingFormState): VariableMapping {
  return BLOCKS.reduce<VariableMapping>((mapping, block) => {
    mapping[block.key] = blocks[block.key].map((entry, index) => {
      const write = normalizeWriteConfig(entry)
      return {
        key: entry.key.trim(),
        ...(entry.group.trim() ? { group: entry.group.trim() } : {}),
        label: entry.label.trim(),
        type: entry.type,
        ...(entry.unit.trim() ? { unit: entry.unit.trim() } : {}),
        position: index + 1,
        ...(entry.display ? {} : { display: false }),
        ...(entry.editable ? { editable: true } : {}),
        ...(write ? { write } : {}),
      }
    })
    return mapping
  }, {})
}

function normalizeWriteConfig(entry: EditableVariableEntry): VariableEntry['write'] | undefined {
  if (!entry.editable) return undefined

  const write = entry.write ?? {}
  const topic = write.topic?.trim()
  const payloadGroup = write.payloadGroup?.trim()
  const payloadKey = write.payloadKey?.trim()
  const refreshCommand = write.refreshCommand?.trim()
  const confirmSource = write.confirm?.source
  const confirmGroup = write.confirm?.group?.trim()
  const confirmKey = write.confirm?.key?.trim()
  const timeoutMs = typeof write.timeoutMs === 'number' && Number.isFinite(write.timeoutMs) ? write.timeoutMs : undefined

  let payload = write.payload
  if (entry.writePayloadJson.trim()) {
    try {
      payload = JSON.parse(entry.writePayloadJson)
    } catch {
      payload = write.payload
    }
  } else {
    payload = undefined
  }

  const confirm = {
    ...(confirmSource ? { source: confirmSource } : {}),
    ...(confirmGroup ? { group: confirmGroup } : {}),
    ...(confirmKey ? { key: confirmKey } : {}),
  }
  const normalized = {
    ...(topic ? { topic } : {}),
    ...(payloadGroup ? { payloadGroup } : {}),
    ...(payloadKey ? { payloadKey } : {}),
    ...(payload !== undefined ? { payload } : {}),
    ...(refreshCommand ? { refreshCommand } : {}),
    ...(Object.keys(confirm).length ? { confirm } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  }
  return Object.keys(normalized).length ? normalized : undefined
}

function mergeInheritedMapping(inherited?: VariableMapping, mapping?: VariableMapping): VariableMapping {
  if (!inherited) return mapping ?? {}
  if (!mapping) return inherited
  return mapping
}

function stringifyVariableMapping(mapping: VariableMapping): string {
  return JSON.stringify(mapping, null, 2)
}

function parseVariableMappingJson(value: string): { mapping: VariableMapping | null; error: string | null } {
  try {
    const parsed = JSON.parse(value)
    const result = rawVariableMappingSchema.safeParse(parsed)

    if (!result.success) {
      return { mapping: null, error: result.error.issues[0]?.message ?? 'Variable mapping JSON is invalid' }
    }

    return { mapping: result.data, error: null }
  } catch {
    return { mapping: null, error: 'Variable mapping must be valid JSON' }
  }
}

function stringifyJsonObject(value?: Record<string, unknown> | null): string {
  return JSON.stringify(value ?? {}, null, 2)
}

function parseJsonObject<T extends Record<string, unknown> = Record<string, unknown>>(
  value: string,
  field: string,
): T {
  const parsed = JSON.parse(value || '{}')
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${field} must be a JSON object.`)
  }
  return parsed as T
}

function validateBlocks(blocks: MappingFormState): MappingValidation {
  const errors: Record<string, EntryValidationErrors> = {}
  const payloadError = BLOCKS.flatMap((block) => blocks[block.key]).find((entry) => entry.writePayloadError)
  if (payloadError?.writePayloadError) {
    return { message: payloadError.writePayloadError, errors }
  }

  const result = mappingFormSchema.safeParse(blocks)

  if (result.success) {
    return { message: null, errors }
  }

  result.error.issues.forEach((issue) => {
    const [blockKey, entryIndex, field] = issue.path
    if (
      typeof blockKey !== 'string' ||
      !BLOCKS.some((block) => block.key === blockKey) ||
      typeof entryIndex !== 'number' ||
      (field !== 'key' && field !== 'group' && field !== 'label' && field !== 'unit')
    ) {
      return
    }

    const entry = blocks[blockKey as MappingBlock]?.[entryIndex]
    if (!entry) return

    errors[entry.id] = {
      ...errors[entry.id],
      [field]: errors[entry.id]?.[field] ?? issue.message,
    }
  })

  return { message: result.error.issues[0]?.message ?? 'Variable mapping is invalid', errors }
}

type SortableEntryRowProps = {
  block: MappingBlock
  entry: EditableVariableEntry
  index: number
  errors?: EntryValidationErrors
  onChange: (entryId: string, updates: Partial<EditableVariableEntry>) => void
  onRemove: (entryId: string) => void | Promise<void>
}

export type VariableMappingEditorProps = {
  value: VariableMapping
  onChange: (value: VariableMapping) => void
  onValidationChange?: (message: string | null) => void
  title?: string
}

function ActionTooltip({ label, children }: { label: ReactNode; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="top" align="center">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function SortableEntryRow({ block, entry, index, errors, onChange, onRemove }: SortableEntryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative flex rounded-lg border bg-background px-2.5 pt-9 pb-2.5 shadow-xs',
        isDragging && 'relative z-10 shadow-md',
      )}
    >
      <div className="absolute top-2 left-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ActionTooltip label="Drag to reorder">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-6 cursor-grab text-muted-foreground active:cursor-grabbing"
            aria-label={`Drag ${entry.label || entry.key || 'field'}`}
            {...attributes}
            {...listeners}
          >
            <HugeiconsIcon icon={DragDropHorizontalIcon} strokeWidth={2} />
          </Button>
        </ActionTooltip>
        <span>#{index + 1}</span>
      </div>

      <div className="absolute top-2 right-2 flex items-center gap-1">
        <ActionTooltip label={entry.display ? 'Hide field' : 'Show field'}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(!entry.display && 'text-muted-foreground')}
            onClick={() => onChange(entry.id, { display: !entry.display })}
            aria-pressed={entry.display}
            aria-label={entry.display ? 'Hide field' : 'Show field'}
          >
            <HugeiconsIcon icon={entry.display ? EyeIcon : ViewOffIcon} strokeWidth={2} />
          </Button>
        </ActionTooltip>

        <ActionTooltip label={entry.editable ? 'Make value read-only' : 'Allow value editing'}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(!entry.editable && 'text-muted-foreground')}
            onClick={() => onChange(entry.id, { editable: !entry.editable })}
            aria-pressed={entry.editable}
            aria-label={entry.editable ? 'Make value read-only' : 'Allow value editing'}
          >
            <HugeiconsIcon icon={entry.editable ? Edit03Icon : EditOff03Icon} strokeWidth={2} />
          </Button>
        </ActionTooltip>

        <ActionTooltip label="Remove field">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onRemove(entry.id)}
            aria-label={`Remove ${entry.label || entry.key || 'field'}`}
          >
            <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
          </Button>
        </ActionTooltip>
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-2 gap-y-2">
        <TextInput
          id={`${block}-${entry.id}-key`}
          label="Key"
          required
          labelClassName="text-xs"
          containerClassName="min-w-0 gap-1"
          value={entry.key}
          onChange={(event) => {
            const key = toSnakeCase(event.target.value)
            onChange(entry.id, { key, keyEdited: !!key })
          }}
          placeholder="battery_level"
          error={errors?.key}
          maxLength={FIELD_LIMITS.key}
          className="h-8 px-2.5"
        />

        <TextInput
          id={`${block}-${entry.id}-label`}
          label="Label"
          required
          labelClassName="text-xs"
          containerClassName="min-w-0 gap-1"
          value={entry.label}
          onChange={(event) => {
            const label = event.target.value
            onChange(entry.id, {
              label,
              ...(entry.keyEdited ? {} : { key: toGeneratedKey(label) }),
            })
          }}
          placeholder="Battery level"
          error={errors?.label}
          maxLength={FIELD_LIMITS.label}
          className="h-8 px-2.5"
        />

        <SelectInput
          id={`${block}-${entry.id}-type`}
          label="Type"
          labelClassName="text-xs"
          containerClassName="min-w-0 gap-1"
          className="h-8 text-sm"
          items={VARIABLE_TYPE_OPTIONS}
          value={entry.type}
          searchable={false}
          onValueChange={(value) => onChange(entry.id, { type: value as VariableType })}
        />

        <TextInput
          id={`${block}-${entry.id}-group`}
          label="Group"
          labelClassName="text-xs"
          containerClassName="min-w-0 gap-1"
          value={entry.group}
          onChange={(event) => onChange(entry.id, { group: toSnakeCase(event.target.value) })}
          placeholder="machine"
          error={errors?.group}
          maxLength={FIELD_LIMITS.key}
          className="h-8 px-2.5"
        />

        <TextInput
          id={`${block}-${entry.id}-unit`}
          label="Unit"
          labelClassName="text-xs"
          containerClassName="min-w-0 gap-1"
          value={entry.unit ?? ''}
          onChange={(event) => onChange(entry.id, { unit: event.target.value })}
          placeholder="%"
          error={errors?.unit}
          maxLength={FIELD_LIMITS.unit}
          className="h-8 px-2.5"
        />
        {entry.editable ? (
          <div className="col-span-2 mt-1 grid min-w-0 grid-cols-2 gap-x-2 gap-y-2 rounded-md border bg-muted/30 p-2.5">
            <TextInput
              id={`${block}-${entry.id}-write-topic`}
              label="Write topic"
              labelClassName="text-xs"
              containerClassName="min-w-0 gap-1"
              value={entry.write?.topic ?? ''}
              onChange={(event) => onChange(entry.id, { write: { ...(entry.write ?? {}), topic: event.target.value } })}
              placeholder="setup"
              className="h-8 px-2.5"
            />
            <TextInput
              id={`${block}-${entry.id}-write-group`}
              label="Payload group"
              labelClassName="text-xs"
              containerClassName="min-w-0 gap-1"
              value={entry.write?.payloadGroup ?? ''}
              onChange={(event) =>
                onChange(entry.id, { write: { ...(entry.write ?? {}), payloadGroup: event.target.value } })
              }
              placeholder={entry.group || 'defaults to group'}
              className="h-8 px-2.5"
            />
            <TextInput
              id={`${block}-${entry.id}-write-key`}
              label="Payload key"
              labelClassName="text-xs"
              containerClassName="min-w-0 gap-1"
              value={entry.write?.payloadKey ?? ''}
              onChange={(event) =>
                onChange(entry.id, { write: { ...(entry.write ?? {}), payloadKey: event.target.value } })
              }
              placeholder={entry.key || 'defaults to key'}
              className="h-8 px-2.5"
            />
            <TextInput
              id={`${block}-${entry.id}-write-refresh`}
              label="Refresh command"
              labelClassName="text-xs"
              containerClassName="min-w-0 gap-1"
              value={entry.write?.refreshCommand ?? ''}
              onChange={(event) =>
                onChange(entry.id, { write: { ...(entry.write ?? {}), refreshCommand: event.target.value } })
              }
              placeholder="requestSetup"
              className="h-8 px-2.5"
            />
            <SelectInput
              id={`${block}-${entry.id}-write-confirm-source`}
              label="Confirm source"
              labelClassName="text-xs"
              containerClassName="min-w-0 gap-1"
              className="h-8 text-sm"
              items={[
                { value: '', label: 'Default' },
                { value: 'status', label: 'Status' },
                { value: 'info', label: 'Info' },
                { value: 'setup', label: 'Setup' },
              ]}
              value={entry.write?.confirm?.source ?? ''}
              searchable={false}
              onValueChange={(value) =>
                onChange(entry.id, {
                  write: {
                    ...(entry.write ?? {}),
                    confirm: {
                      ...(entry.write?.confirm ?? {}),
                      source: value ? (value as 'status' | 'info' | 'setup') : undefined,
                    },
                  },
                })
              }
            />
            <TextInput
              id={`${block}-${entry.id}-write-timeout`}
              label="Timeout ms"
              type="number"
              labelClassName="text-xs"
              containerClassName="min-w-0 gap-1"
              value={entry.write?.timeoutMs ?? ''}
              onChange={(event) =>
                onChange(entry.id, {
                  write: {
                    ...(entry.write ?? {}),
                    timeoutMs: event.target.value ? Number.parseInt(event.target.value, 10) : undefined,
                  },
                })
              }
              placeholder="10000"
              className="h-8 px-2.5"
            />
            <TextInput
              id={`${block}-${entry.id}-write-confirm-group`}
              label="Confirm group"
              labelClassName="text-xs"
              containerClassName="min-w-0 gap-1"
              value={entry.write?.confirm?.group ?? ''}
              onChange={(event) =>
                onChange(entry.id, {
                  write: {
                    ...(entry.write ?? {}),
                    confirm: { ...(entry.write?.confirm ?? {}), group: event.target.value },
                  },
                })
              }
              placeholder="machine"
              className="h-8 px-2.5"
            />
            <TextInput
              id={`${block}-${entry.id}-write-confirm-key`}
              label="Confirm key"
              labelClassName="text-xs"
              containerClassName="min-w-0 gap-1"
              value={entry.write?.confirm?.key ?? ''}
              onChange={(event) =>
                onChange(entry.id, {
                  write: {
                    ...(entry.write ?? {}),
                    confirm: { ...(entry.write?.confirm ?? {}), key: event.target.value },
                  },
                })
              }
              placeholder={entry.write?.payloadKey || entry.key || 'defaults to payload key'}
              className="h-8 px-2.5"
            />
            <div className="col-span-2 flex flex-col gap-1">
              <Label htmlFor={`${block}-${entry.id}-write-payload`} className="text-xs">
                Payload override JSON
              </Label>
              <Textarea
                id={`${block}-${entry.id}-write-payload`}
                value={entry.writePayloadJson}
                onChange={(event) => {
                  const value = event.target.value
                  let writePayloadError: string | null = null
                  if (value.trim()) {
                    try {
                      JSON.parse(value)
                    } catch {
                      writePayloadError = 'Payload override must be valid JSON'
                    }
                  }
                  onChange(entry.id, { writePayloadJson: value, writePayloadError })
                }}
                placeholder='{ "request": 21, "angle": "{{value}}" }'
                className="min-h-20 resize-y font-mono text-xs"
                spellCheck={false}
              />
              {entry.writePayloadError ? <p className="text-xs text-destructive">{entry.writePayloadError}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function VariableMappingEditor({
  value,
  onChange,
  onValidationChange,
  title = 'Variable mapping',
}: VariableMappingEditorProps) {
  const [blocks, setBlocks] = useState<MappingFormState>(() => normalizeMapping(value))
  const [editMode, setEditMode] = useState<JsonEditMode>('form')
  const [json, setJson] = useState(() => stringifyVariableMapping(value))
  const [parseError, setParseError] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const mappingValidation = useMemo(() => validateBlocks(blocks), [blocks])
  const validationMessage = editMode === 'expert' ? parseError : mappingValidation.message

  useEffect(() => {
    onValidationChange?.(validationMessage)
  }, [onValidationChange, validationMessage])

  const emitBlocks = (nextBlocks: MappingFormState) => {
    const validation = validateBlocks(nextBlocks)
    if (!validation.message) {
      onChange(toVariableMapping(nextBlocks))
    }
  }

  const handleEditModeChange = (value: string[]) => {
    const nextMode = value[0] as JsonEditMode | undefined
    if (!nextMode || nextMode === editMode) return

    if (nextMode === 'expert') {
      const nextJson = stringifyVariableMapping(toVariableMapping(blocks))
      setJson(nextJson)
      setParseError(parseVariableMappingJson(nextJson).error)
      setEditMode(nextMode)
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      setParseError('Variable mapping must be valid JSON')
      return
    }

    const mapping = toLooseVariableMapping(parsed)
    if (!mapping) {
      setParseError('Variable mapping must be an object')
      return
    }

    const nextBlocks = normalizeMapping(mapping)
    setBlocks(nextBlocks)
    setJson(stringifyVariableMapping(mapping))
    setParseError(null)
    setEditMode(nextMode)
    onChange(toVariableMapping(nextBlocks))
  }

  const handleJsonChange = (value: string) => {
    setJson(value)
    const result = parseVariableMappingJson(value)
    setParseError(result.error)
    if (result.mapping) onChange(result.mapping)
  }

  const handleEntryChange = (block: MappingBlock, entryId: string, updates: Partial<EditableVariableEntry>) => {
    setBlocks((current) => {
      const next = {
        ...current,
        [block]: current[block].map((entry) => (entry.id === entryId ? { ...entry, ...updates } : entry)),
      }
      emitBlocks(next)
      return next
    })
  }

  const handleAddEntry = (block: MappingBlock) => {
    setBlocks((current) => {
      const next = {
        ...current,
        [block]: [...current[block], createEmptyEntry(block, current[block].length)],
      }
      emitBlocks(next)
      return next
    })
  }

  const handleRemoveEntry = async (block: MappingBlock, entryId: string) => {
    const entry = blocks[block].find((item) => item.id === entryId)
    const entryName = entry?.label.trim() || entry?.key.trim()
    const removeEntry = () => {
      setBlocks((current) => {
        const next = {
          ...current,
          [block]: current[block].filter((entry) => entry.id !== entryId),
        }
        emitBlocks(next)
        return next
      })
    }

    if (!entryName) {
      removeEntry()
      return
    }

    const confirmed = await Modals.confirm({
      title: 'Remove field?',
      content: `This will remove "${entryName}" from ${getDeviceTypeLabel(block)}.`,
      okText: 'Remove',
      cancelText: 'Keep field',
      okButtonProps: { variant: 'destructive' },
    })

    if (confirmed) removeEntry()
  }

  const handleDragEnd = (block: MappingBlock, activeId: string | number, overId: string | number | undefined) => {
    if (!overId || activeId === overId) return

    setBlocks((current) => {
      const oldIndex = current[block].findIndex((entry) => entry.id === activeId)
      const newIndex = current[block].findIndex((entry) => entry.id === overId)

      if (oldIndex === -1 || newIndex === -1) return current

      const next = {
        ...current,
        [block]: arrayMove(current[block], oldIndex, newIndex),
      }
      emitBlocks(next)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">
            Use the form for regular edits, or Expert mode to edit the raw JSON.
          </p>
        </div>
        <ToggleGroup multiple={false} value={[editMode]} onValueChange={handleEditModeChange} size="sm" spacing={2}>
          <ToggleGroupItem
            value="form"
            className="h-7 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground data-pressed:border-foreground data-pressed:shadow-sm"
          >
            Form
          </ToggleGroupItem>
          <ToggleGroupItem
            value="expert"
            className="h-7 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground data-pressed:border-foreground data-pressed:shadow-sm"
          >
            Expert
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {editMode === 'form' ? (
        BLOCKS.map((block) => (
          <section key={block.key} className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">{block.title}</h4>
                <p className="text-xs text-muted-foreground">{blocks[block.key].length} field(s)</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => handleAddEntry(block.key)}>
                <HugeiconsIcon icon={AddCircleIcon} strokeWidth={2} />
                Add field
              </Button>
            </div>

            {blocks[block.key].length ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
                onDragEnd={({ active, over }) => handleDragEnd(block.key, active.id, over?.id)}
              >
                <SortableContext
                  items={blocks[block.key].map((entry) => entry.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2">
                    {blocks[block.key].map((entry, index) => (
                      <SortableEntryRow
                        key={entry.id}
                        block={block.key}
                        entry={entry}
                        index={index}
                        errors={mappingValidation.errors[entry.id]}
                        onChange={(entryId, updates) => handleEntryChange(block.key, entryId, updates)}
                        onRemove={(entryId) => handleRemoveEntry(block.key, entryId)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="rounded-lg border border-dashed bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                No fields yet.
              </div>
            )}
          </section>
        ))
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="variableMapping">Variable mapping (JSON)</Label>
          <p className="text-sm text-muted-foreground">
            Structure: <code>{'{ "status": [...], "info": [...], "setup": [...] }'}</code>. Each entry needs{' '}
            <code>key</code>, <code>label</code>, <code>type</code> (float | integer | string | boolean) and optionally{' '}
            <code>unit</code>, <code>position</code>, <code>display</code>, and <code>editable</code>.
          </p>
          <Textarea
            id="variableMapping"
            value={json}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="min-h-[400px] resize-y font-mono text-sm"
            spellCheck={false}
          />
          {parseError && <p className="text-sm text-destructive">{parseError}</p>}
        </div>
      )}
    </div>
  )
}

const DeviceTypeConfigDrawer = NiceModal.create(
  ({ config, group, groups = [], existingTypes = [], invalidateQueryKey }: DeviceTypeConfigDrawerProps) => {
    const isEditMode = !!config
    const initialType = config?.code ?? ''
    const initialName = config?.name ?? config?.code ?? ''
    const initialGroupId = config?.groupId ?? group?.id ?? ''
    const initialHardwareVersion = config?.hardwareVersion ?? ''
    const initialMqttTopicPrefix = config?.mqttTopicPrefix || group?.defaultMqttTopicPrefix || ''
    const inheritedMapping = group?.defaultVariableMapping ?? undefined
    const inheritedCommands = group?.defaultCommands ?? undefined
    const initialMapping = useMemo(
      () => mergeInheritedMapping(inheritedMapping, config?.variableMapping),
      [config?.variableMapping, inheritedMapping],
    )
    const initialMappingJson = useMemo(() => stringifyVariableMapping(initialMapping), [initialMapping])
    const initialCommands = useMemo(
      () => ({ ...(inheritedCommands ?? {}), ...(config?.commands ?? {}) }),
      [config?.commands, inheritedCommands],
    )
    const initialCommandsJson = useMemo(() => stringifyJsonObject(initialCommands), [initialCommands])

    const [type, setType] = useState(initialType)
    const [name, setName] = useState(initialName)
    const [groupId, setGroupId] = useState(initialGroupId)
    const [hardwareVersion, setHardwareVersion] = useState(initialHardwareVersion)
    const [mqttTopicPrefix, setMqttTopicPrefix] = useState(initialMqttTopicPrefix)
    const [variableMapping, setVariableMapping] = useState<VariableMapping>(initialMapping)
    const [commandsJson, setCommandsJson] = useState(initialCommandsJson)
    const [mappingError, setMappingError] = useState<string | null>(null)
    const [commandsError, setCommandsError] = useState<string | null>(null)
    const [typeError, setTypeError] = useState<string | null>(null)
    const [nameError, setNameError] = useState<string | null>(null)
    const [groupError, setGroupError] = useState<string | null>(null)
    const isFormDirtyRef = useRef(false)

    const queryClient = useQueryClient()

    const canClose = useCallback(async () => {
      if (!isFormDirtyRef.current) return true
      return Modals.confirm({
        title: 'Discard changes?',
        content: 'You have unsaved changes. If you close this drawer, they will be lost.',
        okText: 'Discard',
        cancelText: 'Keep editing',
        okButtonProps: { variant: 'destructive' },
      })
    }, [])
    const drawer = useDrawerController({ canClose })

    useEffect(() => {
      const currentMappingJson = stringifyVariableMapping(variableMapping)
      isFormDirtyRef.current =
        type !== initialType ||
        name !== initialName ||
        groupId !== initialGroupId ||
        hardwareVersion !== initialHardwareVersion ||
        mqttTopicPrefix !== initialMqttTopicPrefix ||
        currentMappingJson !== initialMappingJson ||
        commandsJson !== initialCommandsJson
    }, [
      type,
      name,
      groupId,
      hardwareVersion,
      mqttTopicPrefix,
      variableMapping,
      initialType,
      initialName,
      initialGroupId,
      initialHardwareVersion,
      initialMqttTopicPrefix,
      initialMappingJson,
      commandsJson,
      initialCommandsJson,
    ])

    const mutation = useMutation({
      mutationFn: async () => {
        if (mappingError) throw new Error(mappingError)
        if (commandsError) throw new Error(commandsError)
        if (!name.trim()) throw new Error('Name is required')
        if (!groupId) throw new Error('Group is required')
        const trimmedHardwareVersion = hardwareVersion.trim()
        const trimmedMqttTopicPrefix = mqttTopicPrefix.trim()
        const commands = parseJsonObject<Record<string, DeviceTypeCommandDefinition>>(commandsJson, 'Commands')

        if (isEditMode) {
          return updateDeviceTypeConfigRequest(config.id, {
            name: name.trim(),
            groupId,
            hardwareVersion: trimmedHardwareVersion || null,
            mqttTopicPrefix: trimmedMqttTopicPrefix,
            variableMapping,
            commands,
          })
        }
        return createDeviceTypeConfigRequest({
          code: type,
          name: name.trim(),
          groupId,
          hardwareVersion: trimmedHardwareVersion || undefined,
          mqttTopicPrefix: trimmedMqttTopicPrefix,
          variableMapping,
          commands,
        })
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: deviceTypeConfigsQueryKeys.all })
        await queryClient.invalidateQueries({ queryKey: deviceTypeConfigsQueryKeys.groups })
        if (invalidateQueryKey) {
          await queryClient.invalidateQueries({ queryKey: invalidateQueryKey })
        }
        await drawer.forceClose()
      },
    })

    const handleTypeChange = (value: string) => {
      const upper = value.toUpperCase().replace(/[^A-Z0-9_]/g, '')
      setType(upper)
      if (!upper) {
        setTypeError('ID is required')
      } else if (!isEditMode && existingTypes.includes(upper)) {
        setTypeError('This device type is already configured')
      } else {
        setTypeError(null)
      }
    }

    const handleNameChange = (value: string) => {
      setName(value)
      setNameError(value.trim() ? null : 'Name is required')
    }

    const handleGroupChange = (value: string | number) => {
      setGroupId(String(value))
      setGroupError(value ? null : 'Group is required')
    }

    const handleCommandsChange = (value: string) => {
      setCommandsJson(value)
      try {
        parseJsonObject(value, 'Commands')
        setCommandsError(null)
      } catch (error) {
        setCommandsError(error instanceof Error ? error.message : 'Commands must be valid JSON.')
      }
    }

    const errorMessage = mutation.error instanceof Error ? mutation.error.message : undefined
    const canSave =
      !!type &&
      !!name.trim() &&
      !!groupId &&
      !typeError &&
      !nameError &&
      !groupError &&
      !mappingError &&
      !commandsError &&
      !mutation.isPending
    const groupItems = (group && !groups.some((item) => item.id === group.id) ? [group, ...groups] : groups).map(
      (item) => ({ value: item.id, label: item.name }),
    )

    return (
      <AppDrawer
        title={isEditMode ? `Edit ${getDeviceTypeLabel(config.code)}` : 'Add device type'}
        open={drawer.open}
        onOpenChange={drawer.onOpenChange}
        dismissible={!isFormDirtyRef.current}
      >
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <div className="flex flex-col gap-2">
            <TextInput
              id="deviceType"
              label={
                <>
                  ID{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    (uppercase, e.g. DROPPER, MAESTRO_NANO)
                  </span>
                </>
              }
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              placeholder="e.g. MAESTRO_V2"
              error={typeError}
              className="font-mono uppercase"
              disabled={isEditMode}
            />
            <TextInput
              id="deviceTypeName"
              label="Name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Maestro V2"
              error={nameError}
            />
            <SelectInput
              id="deviceTypeGroup"
              label="Group"
              items={groupItems}
              value={groupId}
              onValueChange={handleGroupChange}
              placeholder="Select group"
              error={groupError}
              disabled={!groupItems.length}
            />
            <TextInput
              id="deviceTypeHardwareVersion"
              label="Hardware version"
              value={hardwareVersion}
              onChange={(event) => setHardwareVersion(event.target.value)}
              placeholder="e.g. HW-2.1"
            />
            <TextInput
              id="deviceTypeMqttTopicPrefix"
              label="MQTT topic prefix"
              value={mqttTopicPrefix}
              onChange={(event) => setMqttTopicPrefix(event.target.value)}
              placeholder="e.g. Paperscent"
            />
          </div>

          <VariableMappingEditor
            value={initialMapping}
            onChange={setVariableMapping}
            onValidationChange={setMappingError}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="deviceTypeCommands">Commands (JSON)</Label>
            <Textarea
              id="deviceTypeCommands"
              value={commandsJson}
              onChange={(event) => handleCommandsChange(event.target.value)}
              className="min-h-[220px] resize-y font-mono text-sm"
              spellCheck={false}
            />
            {commandsError ? <p className="text-sm text-destructive">{commandsError}</p> : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t px-6 py-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => drawer.requestClose(false)}>
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={!canSave}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <FormError message={errorMessage} />
        </div>
      </AppDrawer>
    )
  },
)

export { DeviceTypeConfigDrawer }
