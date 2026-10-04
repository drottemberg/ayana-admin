import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'
import { HugeiconsIcon } from '@hugeicons/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { FieldGroup } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MultiselectInputAsync,
  SelectInputAsync,
  SelectInput,
  type SelectInputItem,
} from '@/components/ui/select-input'
import { FormError } from '@/components/form-error'
import {
  createContractRequest,
  deleteContractDocumentRequest,
  getContractDocumentsRequest,
  updateContractRequest,
} from '@/features/contracts/api'
import { ContractService } from '@/features/contracts/contract-service'
import { contractsQueryKeys } from '@/features/contracts/query-keys'
import { getCustomersListRequest } from '@/features/customers/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { getDevicesListRequest } from '@/features/devices/api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import { cn } from '@/lib/utils'
import {
  ContractSlaType,
  ContractStatus,
  ContractType,
  type Contract,
  type CreateContractPayload,
  type ContractDevice,
} from '@/types/contract'
import type { Customer } from '@/types/customer'
import type { Device } from '@/types/device'
import { FileUtils } from '@/utils'
import { Modals } from '@/providers/modal'
import { ApiError } from '@/lib/api'

type SelectableContractDevice = Device | ContractDevice

const MAX_CONTRACT_SIZE_MB = 250

const createContractFormSchema = z.object({
  customerId: z.string().trim().min(1, 'Customer is required.'),
  type: z.nativeEnum(ContractType),
  deviceIds: z.array(z.string().trim().min(1)),
  status: z.nativeEnum(ContractStatus),
  slaType: z.nativeEnum(ContractSlaType),
  startDate: z.string().trim().min(1, 'Start date is required.'),
  endDate: z.string().trim().min(1, 'End date is required.'),
  documents: z
    .array(z.instanceof(File))
    .max(1, 'Only one document can be attached.')
    .refine(
      (files) => files.every((file) => file.size <= MAX_CONTRACT_SIZE_MB * 1024 * 1024),
      `Maximum file size is ${MAX_CONTRACT_SIZE_MB}MB`,
    ),
})

type CreateContractFormValues = z.infer<typeof createContractFormSchema>

type CreateContractFormProps = {
  onCancel: () => void
  onSuccess?: () => Promise<void> | void
  contract?: Contract
  customerId?: string
  className?: string
  onDirtyChange?: (dirty: boolean) => void
}

function formatContractName(customer?: Customer) {
  return customer ? `${customer.name} contract` : 'New contract'
}

function toContractDevice(device: SelectableContractDevice): ContractDevice {
  return {
    id: device.id,
    name: device.name,
    serialNumber: device.serialNumber,
  }
}

function getDeviceStore(device: SelectableContractDevice) {
  return 'store' in device ? device.store : undefined
}

function isStore(value: ReturnType<typeof getDeviceStore>): value is NonNullable<ReturnType<typeof getDeviceStore>> {
  return Boolean(value)
}

function formatAttachmentSize(size?: NonNullable<Contract['documents']>[number]['size'] | null) {
  return FileUtils.displayFileSize(size)
}

export function CreateContractForm({
  onCancel,
  onSuccess,
  contract,
  customerId,
  className,
  onDirtyChange,
}: CreateContractFormProps) {
  const isEditMode = !!contract?.id
  const queryClient = useQueryClient()
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(contract?.customer)
  const [selectedDevices, setSelectedDevices] = useState<SelectableContractDevice[]>(contract?.devices ?? [])
  const typeItems = ContractService.typeKeys().map((type) => ({
    value: type,
    label: ContractService.typeToString(type),
  }))
  const statusItems = ContractService.statusKeys().map((status) => ({
    value: status,
    label: ContractService.statusToString(status),
  }))
  const slaItems = ContractService.slaTypeKeys().map((slaType) => ({
    value: slaType,
    label: ContractService.slaTypeToString(slaType),
  }))
  const {
    control,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = useForm<CreateContractFormValues>({
    resolver: zodResolver(createContractFormSchema),
    mode: 'onChange',
    defaultValues: {
      customerId: contract?.customer.id ?? customerId ?? '',
      type: contract?.type ?? ContractType.Rental,
      deviceIds: contract?.devices?.map((device) => device.id) ?? [],
      status: contract?.status ?? ContractStatus.Created,
      slaType: contract?.slaType ?? ContractSlaType.None,
      startDate: contract?.startDate.slice(0, 10) ?? '',
      endDate: contract?.endDate.slice(0, 10) ?? '',
      documents: [],
    },
  })
  const createContractMutation = useMutation({
    mutationFn: createContractRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contractsQueryKeys.all })
      await onSuccess?.()
    },
  })
  const updateContractMutation = useMutation({
    mutationFn: (payload: CreateContractPayload) => {
      if (!contract) throw new Error('Contract is required.')

      return updateContractRequest(contract.id, payload)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: contractsQueryKeys.all }),
        contract
          ? queryClient.invalidateQueries({ queryKey: contractsQueryKeys.detail(contract.id) })
          : Promise.resolve(),
      ])
      await onSuccess?.()
    },
  })
  const activeMutation = isEditMode ? updateContractMutation : createContractMutation
  const documentsQuery = useQuery({
    queryKey: contract?.id
      ? [...contractsQueryKeys.detail(contract.id), 'files']
      : [...contractsQueryKeys.all, 'files'],
    queryFn: () => getContractDocumentsRequest(contract!.id),
    enabled: isEditMode && !!contract?.id,
  })
  const deleteDocumentMutation = useMutation({
    mutationFn: (attachmentId: string) => {
      if (!contract) throw new Error('Contract is required.')
      return deleteContractDocumentRequest(contract.id, attachmentId)
    },
    onSuccess: async () => {
      if (!contract) return
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...contractsQueryKeys.detail(contract.id), 'files'] }),
        queryClient.invalidateQueries({ queryKey: contractsQueryKeys.detail(contract.id) }),
        queryClient.invalidateQueries({ queryKey: contractsQueryKeys.all }),
      ])
    },
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const getCustomerOption = useCallback((customer: Customer): SelectInputItem => {
    return { value: customer.id, label: customer.name }
  }, [])

  const getDeviceOption = useCallback((device: SelectableContractDevice): SelectInputItem => {
    return { value: device.id, label: `${device.name} (${device.serialNumber})` }
  }, [])

  const submitForm = handleSubmit(async (values) => {
    const customer = selectedCustomer?.id === values.customerId ? selectedCustomer : undefined
    const payloadDevices = selectedDevices.filter((device) => values.deviceIds.includes(device.id))
    const stores = Array.from(
      new Map(
        payloadDevices
          .map(getDeviceStore)
          .filter(isStore)
          .map((store) => [store.id, store]),
      ).values(),
    )

    if (!customer) return

    const payload: CreateContractPayload = {
      name: contract?.name ?? formatContractName(customer),
      type: values.type,
      customer,
      devices: payloadDevices.map(toContractDevice),
      stores,
      status: values.status,
      slaType: values.slaType,
      startDate: values.startDate,
      endDate: values.endDate,
      documents: [
        ...(contract?.documents ?? []),
        ...values.documents.map((file) => ({
          id: `${file.name}-${file.lastModified}`,
          name: file.name,
          size: Math.round(file.size / 1024),
        })),
      ],
      documentFiles: values.documents,
    }

    try {
      if (isEditMode) {
        await updateContractMutation.mutateAsync(payload)
        return
      }

      await createContractMutation.mutateAsync(payload)
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409 || !error.message.includes('already assigned')) {
        throw error
      }

      const confirmed = await Modals.confirm({
        title: 'Reassign selected devices?',
        content:
          'Some selected devices are already assigned to another contract. They will be unassigned from the existing contract and assigned to this one.',
        okText: 'Reassign',
        cancelText: 'Cancel',
        okButtonProps: { variant: 'destructive' },
      })
      if (!confirmed) return

      const confirmedPayload = { ...payload, reassignConflictingDevices: true }
      if (isEditMode) {
        await updateContractMutation.mutateAsync(confirmedPayload)
        return
      }

      await createContractMutation.mutateAsync(confirmedPayload)
    }
  })

  return (
    <form className={cn('flex min-h-0 flex-1 flex-col', className)} noValidate onSubmit={submitForm}>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-2">
        <FieldGroup className="gap-4">
          <Controller
            control={control}
            name="customerId"
            render={({ field, fieldState }) => (
              <SelectInputAsync
                label="Customer"
                placeholder="Select customer"
                required
                queryKey={[...customersQueryKeys.all, 'new-contract']}
                queryFn={(search) => getCustomersListRequest({ contractId: null }, search)}
                getOption={getCustomerOption}
                selectedItems={selectedCustomer ? [selectedCustomer] : []}
                loadingMessage="Loading customers..."
                errorMessage="Failed to load customers."
                emptyMessage="No customers found."
                error={fieldState.error?.message}
                value={field.value}
                onValueChange={field.onChange}
                onSelectedItemsChange={(items) => setSelectedCustomer(items[0])}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />

          <Controller
            control={control}
            name="type"
            render={({ field, fieldState }) => (
              <SelectInput
                label="Type"
                required
                items={typeItems}
                error={fieldState.error?.message}
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
            name="deviceIds"
            render={({ field, fieldState }) => (
              <MultiselectInputAsync
                label="Devices"
                placeholder="Select devices"
                queryKey={devicesQueryKeys.newContract}
                queryFn={(search) => getDevicesListRequest(undefined, search)}
                getOption={getDeviceOption}
                selectedItems={selectedDevices}
                loadingMessage="Loading devices..."
                errorMessage="Failed to load devices."
                emptyMessage="No devices found."
                value={field.value}
                onValueChange={field.onChange}
                onSelectedItemsChange={setSelectedDevices}
                onBlur={field.onBlur}
                name={field.name}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="status"
            render={({ field, fieldState }) => (
              <SelectInput
                label="Status"
                required
                items={statusItems}
                error={fieldState.error?.message}
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
            name="slaType"
            render={({ field, fieldState }) => (
              <SelectInput
                label="SLA"
                required
                items={slaItems}
                error={fieldState.error?.message}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="startDate"
              render={({ field, fieldState }) => (
                <DatePicker
                  label="Start date"
                  required
                  error={fieldState.error?.message}
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
              name="endDate"
              render={({ field, fieldState }) => (
                <DatePicker
                  label="End date"
                  required
                  error={fieldState.error?.message}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
          </div>

          <Controller
            control={control}
            name="documents"
            render={({ field, fieldState }) => (
              <FileInput
                label="Add document"
                value={field.value}
                onValueChange={field.onChange}
                inputName={field.name}
                onBlur={field.onBlur}
                formats={['pdf', 'doc', 'docx']}
                maxSizeMb={MAX_CONTRACT_SIZE_MB}
                error={fieldState.error?.message}
              />
            )}
          />
          {isEditMode ? (
            <ExistingContractDocuments
              documents={documentsQuery.data ?? contract?.documents ?? []}
              isLoading={documentsQuery.isLoading}
              isDeleting={deleteDocumentMutation.isPending}
              onDelete={async (document) => {
                const confirmed = await Modals.confirm({
                  title: `Delete ${document.name || 'document'}?`,
                  content: 'This will remove the attachment and delete the file from the cloud.',
                  okText: 'Delete',
                  cancelText: 'Cancel',
                  okButtonProps: { variant: 'destructive' },
                })
                if (!confirmed) return

                await deleteDocumentMutation.mutateAsync(document.id)
              }}
            />
          ) : null}
        </FieldGroup>
      </div>

      <div className="mt-auto flex flex-col gap-3 px-7 py-6">
        <div className="mt-auto flex justify-center gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="lg" loading={isSubmitting}>
            {isEditMode ? 'Save' : 'Create'}
          </Button>
        </div>
        <FormError
          message={
            activeMutation.error instanceof Error
              ? activeMutation.error.message
              : deleteDocumentMutation.error instanceof Error
                ? deleteDocumentMutation.error.message
                : undefined
          }
        />
      </div>
    </form>
  )
}

function ExistingContractDocuments({
  documents,
  isLoading,
  isDeleting,
  onDelete,
}: {
  documents: NonNullable<Contract['documents']>
  isLoading?: boolean
  isDeleting?: boolean
  onDelete: (document: NonNullable<Contract['documents']>[number]) => void | Promise<void>
}) {
  if (isLoading) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (!documents.length) return null

  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium text-foreground">Current documents</div>
      <div className="grid gap-2">
        {documents.map((document) => (
          <div key={document.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <div className="min-w-0">
              {document.url ? (
                <a
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-md block font-medium break-words text-foreground underline-offset-2 hover:underline"
                >
                  {document.name}
                </a>
              ) : (
                <span className="text-md block font-medium break-words text-foreground">{document.name}</span>
              )}
              <span className="mt-0.5 block text-sm text-muted-foreground">{formatAttachmentSize(document.size)}</span>
            </div>
            <div className="flex shrink-0 items-center">
              <Button
                type="button"
                variant="outline"
                size="icon-md"
                aria-label={`Delete ${document.name || 'document'}`}
                onClick={() => void onDelete(document)}
                disabled={isDeleting}
              >
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
