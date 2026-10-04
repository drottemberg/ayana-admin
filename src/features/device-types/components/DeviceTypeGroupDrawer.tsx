import NiceModal from '@ebay/nice-modal-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { AppDrawer } from '@/components/app/AppDrawer'
import { FormError } from '@/components/form-error'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TextInput } from '@/components/ui/text-input'
import { VariableMappingEditor } from '@/features/device-types/components/DeviceTypeConfigDrawer'
import {
  createDeviceTypeGroupRequest,
  updateDeviceTypeGroupRequest,
  type DeviceTypeCommandDefinition,
  type DeviceTypeGroup,
  type VariableMapping,
} from '@/features/device-types/api'
import { deviceTypeConfigsQueryKeys } from '@/features/device-types/query-keys'
import { Modals } from '@/providers/modal'
import { useDrawerController } from '@/providers/use-overlay-controller'

export type DeviceTypeGroupDrawerProps = {
  group?: DeviceTypeGroup
}

function stringifyMapping(mapping?: VariableMapping | null): string {
  return JSON.stringify(mapping ?? {}, null, 2)
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

const DeviceTypeGroupDrawer = NiceModal.create(({ group }: DeviceTypeGroupDrawerProps) => {
  const isEditMode = !!group
  const initialName = group?.name ?? ''
  const initialDefaultMqttTopicPrefix = group?.defaultMqttTopicPrefix ?? ''
  const initialVariableMapping = useMemo(() => group?.defaultVariableMapping ?? {}, [group?.defaultVariableMapping])
  const initialVariableMappingJson = useMemo(() => stringifyMapping(initialVariableMapping), [initialVariableMapping])
  const initialPayloadTemplateJson = useMemo(
    () => stringifyJsonObject(group?.defaultPayloadTemplate),
    [group?.defaultPayloadTemplate],
  )
  const initialCommandsJson = useMemo(() => stringifyJsonObject(group?.defaultCommands), [group?.defaultCommands])
  const [name, setName] = useState(initialName)
  const [defaultMqttTopicPrefix, setDefaultMqttTopicPrefix] = useState(initialDefaultMqttTopicPrefix)
  const [defaultVariableMapping, setDefaultVariableMapping] = useState<VariableMapping>(initialVariableMapping)
  const [payloadTemplateJson, setPayloadTemplateJson] = useState(initialPayloadTemplateJson)
  const [commandsJson, setCommandsJson] = useState(initialCommandsJson)
  const [nameError, setNameError] = useState<string | null>(null)
  const [variableMappingError, setVariableMappingError] = useState<string | null>(null)
  const [payloadTemplateError, setPayloadTemplateError] = useState<string | null>(null)
  const [commandsError, setCommandsError] = useState<string | null>(null)
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
    isFormDirtyRef.current =
      name !== initialName ||
      defaultMqttTopicPrefix !== initialDefaultMqttTopicPrefix ||
      stringifyMapping(defaultVariableMapping) !== initialVariableMappingJson ||
      payloadTemplateJson !== initialPayloadTemplateJson ||
      commandsJson !== initialCommandsJson
  }, [
    name,
    defaultMqttTopicPrefix,
    defaultVariableMapping,
    payloadTemplateJson,
    commandsJson,
    initialName,
    initialDefaultMqttTopicPrefix,
    initialVariableMappingJson,
    initialPayloadTemplateJson,
    initialCommandsJson,
  ])

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim()
      if (!trimmedName) throw new Error('Name is required.')
      if (variableMappingError) throw new Error(variableMappingError)
      if (commandsError) throw new Error(commandsError)
      const defaultPayloadTemplate = parseJsonObject(payloadTemplateJson, 'Default payload template')
      const defaultCommands = parseJsonObject<Record<string, DeviceTypeCommandDefinition>>(
        commandsJson,
        'Default commands',
      )
      const trimmedDefaultMqttTopicPrefix = defaultMqttTopicPrefix.trim()

      if (isEditMode) {
        return updateDeviceTypeGroupRequest(group.id, {
          name: trimmedName,
          defaultVariableMapping,
          defaultPayloadTemplate,
          defaultCommands,
          defaultMqttTopicPrefix: trimmedDefaultMqttTopicPrefix,
        })
      }
      return createDeviceTypeGroupRequest({
        name: trimmedName,
        defaultVariableMapping,
        defaultPayloadTemplate,
        defaultCommands,
        defaultMqttTopicPrefix: trimmedDefaultMqttTopicPrefix,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: deviceTypeConfigsQueryKeys.groups })
      await queryClient.invalidateQueries({ queryKey: deviceTypeConfigsQueryKeys.all })
      if (group?.id) {
        await queryClient.invalidateQueries({ queryKey: deviceTypeConfigsQueryKeys.groupDetail(group.id) })
      }
      await drawer.forceClose()
    },
  })

  const handlePayloadTemplateChange = (value: string) => {
    setPayloadTemplateJson(value)
    try {
      parseJsonObject(value, 'Default payload template')
      setPayloadTemplateError(null)
    } catch (error) {
      setPayloadTemplateError(error instanceof Error ? error.message : 'Default payload template must be valid JSON.')
    }
  }

  const handleCommandsChange = (value: string) => {
    setCommandsJson(value)
    try {
      parseJsonObject(value, 'Default commands')
      setCommandsError(null)
    } catch (error) {
      setCommandsError(error instanceof Error ? error.message : 'Default commands must be valid JSON.')
    }
  }

  const errorMessage = mutation.error instanceof Error ? mutation.error.message : undefined
  const canSave =
    !!name.trim() &&
    !nameError &&
    !variableMappingError &&
    !payloadTemplateError &&
    !commandsError &&
    !mutation.isPending

  return (
    <AppDrawer
      title={isEditMode ? 'Edit device type group' : 'Add device type group'}
      open={drawer.open}
      onOpenChange={drawer.onOpenChange}
      dismissible={!isFormDirtyRef.current}
    >
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
        <TextInput
          id="deviceTypeGroupName"
          label="Name"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setNameError(event.target.value.trim() ? null : 'Name is required')
          }}
          placeholder="e.g. Default"
          error={nameError}
          required
        />
        <TextInput
          id="deviceTypeGroupDefaultMqttTopicPrefix"
          label="Default MQTT topic prefix"
          value={defaultMqttTopicPrefix}
          onChange={(event) => setDefaultMqttTopicPrefix(event.target.value)}
          placeholder="e.g. Paperscent"
        />
        <VariableMappingEditor
          title="Default variable mapping"
          value={initialVariableMapping}
          onChange={setDefaultVariableMapping}
          onValidationChange={setVariableMappingError}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="defaultCommands">Default commands (JSON)</Label>
          <Textarea
            id="defaultCommands"
            value={commandsJson}
            onChange={(event) => handleCommandsChange(event.target.value)}
            className="min-h-[220px] resize-y font-mono text-sm"
            spellCheck={false}
          />
          {commandsError ? <p className="text-sm text-destructive">{commandsError}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="defaultPayloadTemplate">Default payload template (JSON)</Label>
          <Textarea
            id="defaultPayloadTemplate"
            value={payloadTemplateJson}
            onChange={(event) => handlePayloadTemplateChange(event.target.value)}
            className="min-h-[360px] resize-y font-mono text-sm"
            spellCheck={false}
          />
          {payloadTemplateError ? <p className="text-sm text-destructive">{payloadTemplateError}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t px-6 py-4">
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => drawer.requestClose(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSave}>
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
        <FormError message={errorMessage} />
      </div>
    </AppDrawer>
  )
})

export { DeviceTypeGroupDrawer }
