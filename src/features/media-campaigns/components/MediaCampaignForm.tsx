import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { FormError } from '@/components/form-error'
import { Button } from '@/components/ui/button'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { FieldGroup } from '@/components/ui/field'
import { SelectInputAsync } from '@/components/ui/select-input'
import { TextInput } from '@/components/ui/text-input'
import { getCustomersListRequest } from '@/features/customers/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { createMediaCampaignRequest, updateMediaCampaignRequest } from '@/features/media-campaigns/api'
import type { Customer } from '@/types/customer'
import type { CreateMediaCampaignPayload, MediaCampaign, UpdateMediaCampaignPayload } from '@/types/media'

const campaignFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Campaign name is required.'),
    customerId: z.string().trim().min(1, 'Customer is required.'),
    priority: z.string().trim().regex(/^\d*$/, 'Priority must be a whole number.').optional(),
    startAt: z.string().trim().min(1, 'Start date and time are required.'),
    endAt: z.string().optional(),
  })
  .refine(
    (values) => {
      const startAt = values.startAt ? new Date(values.startAt) : undefined
      const endAt = values.endAt ? new Date(values.endAt) : undefined

      return (
        !startAt ||
        !endAt ||
        Number.isNaN(startAt.getTime()) ||
        Number.isNaN(endAt.getTime()) ||
        endAt.getTime() >= startAt.getTime()
      )
    },
    {
      path: ['endAt'],
      message: 'End must be after start.',
    },
  )

type CampaignFormValues = z.infer<typeof campaignFormSchema>

type MediaCampaignFormProps = {
  campaign?: MediaCampaign
  customerId?: string
  mediaId?: string
  mode: 'create' | 'edit'
  onCancel: () => void
  onSaved: (campaign: MediaCampaign) => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
}

function normalizePriority(value: CampaignFormValues['priority']) {
  return value ? Number(value) : undefined
}

export function MediaCampaignForm({
  campaign,
  customerId,
  mediaId,
  mode,
  onCancel,
  onSaved,
  onDirtyChange,
}: MediaCampaignFormProps) {
  const isEditMode = mode === 'edit'
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: campaign?.name ?? '',
      customerId: campaign?.customer?.id ? String(campaign.customer.id) : (campaign?.customerId ?? customerId ?? ''),
      priority: campaign?.priority == null ? '' : String(campaign.priority),
      startAt: campaign?.startAt ?? '',
      endAt: campaign?.endAt ?? '',
    },
  })

  const createMutation = useMutation({
    mutationFn: createMediaCampaignRequest,
    onSuccess: onSaved,
  })
  const updateMutation = useMutation({
    mutationFn: (payload: UpdateMediaCampaignPayload) => {
      if (!campaign?.id) throw new Error('Campaign is required.')

      return updateMediaCampaignRequest(campaign.id, payload)
    },
    onSuccess: onSaved,
  })
  const activeMutation = isEditMode ? updateMutation : createMutation

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const submitForm = handleSubmit(async (values) => {
    try {
      const payload = {
        name: values.name.trim(),
        priority: normalizePriority(values.priority),
        startAt: values.startAt,
        endAt: values.endAt || undefined,
      }

      if (isEditMode) {
        await updateMutation.mutateAsync(payload)
        return
      }

      await createMutation.mutateAsync({
        ...payload,
        customerId: values.customerId,
        mediaIds: mediaId ? [mediaId] : undefined,
      } satisfies CreateMediaCampaignPayload)
    } catch {
      // Keep drawer open; React Query exposes the error for FormError.
    }
  })

  const isSaving = isSubmitting || activeMutation.isPending
  const errorMessage = activeMutation.error instanceof Error ? activeMutation.error.message : undefined

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submitForm()
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-2">
        <FieldGroup className="gap-4">
          <TextInput label="Campaign name" required error={errors.name?.message} {...register('name')} />

          <Controller
            control={control}
            name="customerId"
            render={({ field, fieldState }) => (
              <SelectInputAsync<Customer>
                label="Customer"
                placeholder="Select customer"
                queryKey={customersQueryKeys.all}
                queryFn={(search) => getCustomersListRequest(undefined, search)}
                getOption={(customer) => ({ value: String(customer.id), label: customer.name })}
                selectedItems={campaign?.customer ? [campaign.customer as Customer] : []}
                value={field.value}
                error={fieldState.error?.message}
                disabled={isEditMode}
                onValueChange={(value) => field.onChange(String(value))}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />

          <TextInput
            label="Priority"
            type="number"
            min={0}
            error={errors.priority?.message}
            {...register('priority')}
          />
          <Controller
            control={control}
            name="startAt"
            render={({ field, fieldState }) => (
              <DateTimePicker
                label="Start at"
                required
                value={field.value}
                error={fieldState.error?.message}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <Controller
            control={control}
            name="endAt"
            render={({ field, fieldState }) => (
              <DateTimePicker
                label="End at"
                value={field.value}
                error={fieldState.error?.message}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
        </FieldGroup>
      </div>

      <div className="mt-auto flex flex-col gap-3 px-7 py-6">
        <div className="mt-auto flex justify-center gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" size="lg" loading={isSaving} onClick={() => void submitForm()}>
            {isEditMode ? 'Save' : 'Add campaign'}
          </Button>
        </div>
        <FormError message={errorMessage} />
      </div>
    </form>
  )
}
