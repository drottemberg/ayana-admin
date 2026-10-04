import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { SelectInput, SelectInputAsync } from '@/components/ui/select-input'
import { FormError } from '@/components/form-error'
import { TextInput } from '@/components/ui/text-input'
import {
  createDeviceRequest,
  getDeviceBySerialNumberRequest,
  getDevicesListRequest,
  updateDeviceRequest,
} from '@/features/devices/api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { getDeviceTypeConfigsRequest, getDeviceTypeGroupsRequest } from '@/features/device-types/api'
import { deviceTypeConfigsQueryKeys } from '@/features/device-types/query-keys'
import { useDictionaryQuery } from '@/lib/query-hooks'
import { cn } from '@/lib/utils'
import { DeviceEntityStatus, type CreateDevicePayload, type Device } from '@/types/device'

type ComboboxContainer = React.ComponentProps<typeof SelectInput>['container']

const createDeviceFormSchema = z
  .object({
    serialNumber: z.string().trim(),
    name: z.string().trim(),
    status: z.enum(['PROVISIONING', 'ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED']),
    groupId: z.string().trim(),
    type: z.string().trim(),
    isSet: z.boolean(),
    parentId: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.isSet) {
      if (!values.name) {
        ctx.addIssue({
          code: 'custom',
          path: ['name'],
          message: 'Device set name is required.',
        })
      }
      return
    }

    if (!values.groupId) {
      ctx.addIssue({
        code: 'custom',
        path: ['groupId'],
        message: 'Group is required.',
      })
    }

    if (!values.type) {
      ctx.addIssue({
        code: 'custom',
        path: ['type'],
        message: 'Type is required.',
      })
    }
  })

type CreateDeviceFormValues = z.infer<typeof createDeviceFormSchema>

const lifecycleStatusItems = [
  { value: 'PROVISIONING', label: 'Provisioning' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'DECOMMISSIONED', label: 'Disabled' },
]

type CreateDeviceFormProps = {
  onCancel: () => void
  onSaved: () => Promise<void> | void
  isSet?: boolean
  device?: Device
  parentId?: string
  comboboxContainer?: ComboboxContainer
  className?: string
  onDirtyChange?: (dirty: boolean) => void
}

function getDeviceTypeId(device?: Device) {
  if (!device) return ''

  const type = Array.isArray(device.type) ? device.type[0] : device.type
  return typeof type === 'object' ? type.id : (type ?? '')
}

function getDeviceTypeGroupId(device?: Device) {
  if (!device) return ''

  const type = Array.isArray(device.type) ? device.type[0] : device.type
  return typeof type === 'object' ? (type.group?.id ?? '') : (device.typeGroupId ?? '')
}

function getDeviceLifecycleStatus(device?: Device): CreateDeviceFormValues['status'] {
  if (!device) return 'PROVISIONING'
  if (device.entityStatus === DeviceEntityStatus.Active) return 'ACTIVE'
  if (device.entityStatus === DeviceEntityStatus.Maintenance) return 'MAINTENANCE'
  if (device.entityStatus === DeviceEntityStatus.Disabled) return 'DECOMMISSIONED'
  return 'PROVISIONING'
}

export function CreateDeviceForm({
  onCancel,
  onSaved,
  isSet = false,
  device,
  parentId,
  comboboxContainer,
  className,
  onDirtyChange,
}: CreateDeviceFormProps) {
  const isEditMode = !!device?.id
  const isDeviceSet = device?.isSet ?? isSet
  const { data: deviceTypeConfigs = [] } = useDictionaryQuery({
    queryKey: deviceTypeConfigsQueryKeys.all,
    queryFn: getDeviceTypeConfigsRequest,
  })
  const { data: deviceTypeGroups = [] } = useDictionaryQuery({
    queryKey: deviceTypeConfigsQueryKeys.groups,
    queryFn: getDeviceTypeGroupsRequest,
  })
  const deviceTypeGroupItems = useMemo(
    () =>
      deviceTypeGroups
        .filter((group) => group.status === 'ACTIVE' && !group.isArchived && !group.isDeleted)
        .map((group) => ({ value: group.id, label: group.name })),
    [deviceTypeGroups],
  )
  const queryClient = useQueryClient()
  const [duplicateDevice, setDuplicateDevice] = useState<Device | null>(null)
  const [isSerialNumberValidationPending, setIsSerialNumberValidationPending] = useState(false)
  const createDeviceMutation = useMutation({
    mutationFn: createDeviceRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: devicesQueryKeys.all })
      await onSaved()
    },
  })
  const updateDeviceMutation = useMutation({
    mutationFn: (payload: CreateDevicePayload) => {
      if (!device) throw new Error('Device is required.')

      return updateDeviceRequest(device.id, payload)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: devicesQueryKeys.all }),
        device ? queryClient.invalidateQueries({ queryKey: devicesQueryKeys.detail(device.id) }) : Promise.resolve(),
      ])
      await onSaved()
    },
  })
  const activeMutation = isEditMode ? updateDeviceMutation : createDeviceMutation
  const {
    control,
    register,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors, isDirty, isSubmitting },
    setValue,
  } = useForm<CreateDeviceFormValues>({
    resolver: zodResolver(createDeviceFormSchema),
    mode: 'onChange',
    defaultValues: {
      serialNumber: device?.serialNumber ?? '',
      name: device?.name ?? '',
      status: getDeviceLifecycleStatus(device),
      groupId: getDeviceTypeGroupId(device),
      type: getDeviceTypeId(device),
      isSet: isDeviceSet,
      parentId: parentId ?? device?.parentId ?? '',
    },
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const serialNumberValue = useWatch({ control, name: 'serialNumber' })
  const selectedGroupId = useWatch({ control, name: 'groupId' })
  const selectedType = useWatch({ control, name: 'type' })
  const deviceTypeItems = useMemo(
    () =>
      deviceTypeConfigs
        .filter(
          (config) =>
            config.status === 'ACTIVE' &&
            !config.isArchived &&
            !config.isDeleted &&
            (!selectedGroupId || config.groupId === selectedGroupId),
        )
        .map((config) => ({ value: config.code, label: config.name || config.code })),
    [deviceTypeConfigs, selectedGroupId],
  )

  useEffect(() => {
    if (isDeviceSet || selectedGroupId || !selectedType) return

    const config = deviceTypeConfigs.find((item) => item.code === selectedType)
    if (!config?.groupId) return

    setValue('groupId', config.groupId, { shouldDirty: false, shouldValidate: true })
  }, [deviceTypeConfigs, isDeviceSet, selectedGroupId, selectedType, setValue])

  useEffect(() => {
    if (isDeviceSet || !selectedGroupId || !selectedType || !deviceTypeConfigs.length) return
    if (deviceTypeItems.some((item) => item.value === selectedType)) return

    setValue('type', '', { shouldDirty: true, shouldValidate: true })
  }, [deviceTypeConfigs.length, deviceTypeItems, isDeviceSet, selectedGroupId, selectedType, setValue])

  useEffect(() => {
    const serialNumber = serialNumberValue.trim()
    let isCurrent = true

    if (!serialNumber || (isEditMode && serialNumber === device?.serialNumber)) {
      return () => {
        isCurrent = false
      }
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const existingDevice = await getDeviceBySerialNumberRequest(serialNumber)
        if (!isCurrent) return

        if (existingDevice) {
          setDuplicateDevice(existingDevice)
          setError('serialNumber', {
            type: 'serialNumberExists',
            message: 'This serial number already exist',
          })
          return
        }

        clearErrors('serialNumber')
      } catch (error) {
        if (!isCurrent) return

        setError('serialNumber', {
          type: 'serialNumberValidationFailed',
          message: error instanceof Error ? error.message : 'Unable to validate serial number.',
        })
      } finally {
        if (isCurrent) {
          setIsSerialNumberValidationPending(false)
        }
      }
    }, 500)

    return () => {
      isCurrent = false
      window.clearTimeout(timeoutId)
    }
  }, [clearErrors, device?.serialNumber, isEditMode, serialNumberValue, setError])

  const submitForm = handleSubmit(async (values) => {
    try {
      const serialNumber = values.serialNumber.trim()

      if (isSerialNumberValidationPending) {
        return
      }

      if (duplicateDevice) {
        setError('serialNumber', {
          type: 'serialNumberExists',
          message: 'This serial number already exist',
        })
        return
      }

      setDuplicateDevice(null)

      const payload: CreateDevicePayload = {
        name: values.name.trim() || undefined,
        serialNumber: isEditMode ? serialNumber : serialNumber || undefined,
        type: values.type ? { id: values.type, name: values.type } : '',
        status: values.status,
        isSet: isDeviceSet,
        parentId: isEditMode ? values.parentId || null : values.parentId || undefined,
        deviceItems: device?.deviceItems ?? [],
      }

      if (isEditMode) {
        await updateDeviceMutation.mutateAsync(payload)
        return
      }

      await createDeviceMutation.mutateAsync(payload)
    } catch {
      // Keep the drawer open; React Query exposes the error for FormError.
    }
  })
  const isSaving = isSubmitting || activeMutation.isPending
  const errorMessage = activeMutation.error instanceof Error ? activeMutation.error.message : undefined

  return (
    <form
      className={cn('flex min-h-0 flex-1 flex-col', className)}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submitForm()
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-2">
        <FieldGroup className="gap-4">
          <TextInput
            label="Serial number"
            placeholder="Auto-generated"
            isLoading={isSerialNumberValidationPending}
            error={
              errors.serialNumber?.type === 'serialNumberExists' && duplicateDevice ? (
                <>
                  This serial number already exist:{' '}
                  <Link to={`/devices/${duplicateDevice.id}`} className="underline underline-offset-2">
                    See device page
                  </Link>
                </>
              ) : (
                errors.serialNumber?.message
              )
            }
            {...register('serialNumber', {
              onChange: (event) => {
                const serialNumber = event.target.value.trim()

                if (duplicateDevice) {
                  setDuplicateDevice(null)
                }
                clearErrors('serialNumber')

                setIsSerialNumberValidationPending(
                  Boolean(serialNumber) && !(isEditMode && serialNumber === device?.serialNumber),
                )
              },
            })}
          />
          <TextInput
            label={isDeviceSet ? 'Device set name' : 'Device name'}
            placeholder={isDeviceSet ? 'New device set' : 'Defaults to selected type'}
            required={isDeviceSet}
            error={errors.name?.message}
            {...register('name')}
          />

          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SelectInput
                label="Status"
                placeholder="Select status"
                items={lifecycleStatusItems}
                container={comboboxContainer}
                error={errors.status?.message}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />

          {!isDeviceSet ? (
            <>
              <Controller
                control={control}
                name="groupId"
                render={({ field }) => (
                  <SelectInput
                    label="Group"
                    placeholder="Select group"
                    required
                    searchable
                    items={deviceTypeGroupItems}
                    container={comboboxContainer}
                    error={errors.groupId?.message}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      setValue('type', '', { shouldDirty: true, shouldValidate: true })
                    }}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />

              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <SelectInput
                    label="Type"
                    placeholder="Select type"
                    required
                    searchable
                    items={deviceTypeItems}
                    disabled={!selectedGroupId}
                    emptyMessage={selectedGroupId ? 'No types found.' : 'Select a group first.'}
                    container={comboboxContainer}
                    error={errors.type?.message}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />

              <Controller
                control={control}
                name="parentId"
                render={({ field }) => (
                  <SelectInputAsync
                    label="Device Set"
                    placeholder="None"
                    queryKey={[...devicesQueryKeys.all, 'sets']}
                    queryFn={(search) => getDevicesListRequest({ isSet: true }, search)}
                    getOption={(d) => ({ value: d.id, label: `${d.name} (${d.serialNumber})` })}
                    container={comboboxContainer}
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />
            </>
          ) : null}
        </FieldGroup>
      </div>

      <div className="mt-auto flex flex-col gap-3 px-7 py-6">
        <div className="mt-auto flex justify-center gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={isSerialNumberValidationPending}
            loading={isSaving}
            onClick={() => void submitForm()}
          >
            {isEditMode ? 'Save' : isDeviceSet ? 'Add set' : 'Add device'}
          </Button>
        </div>
        <FormError message={errorMessage} />
      </div>
    </form>
  )
}
