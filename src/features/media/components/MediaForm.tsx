import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { FormError } from '@/components/form-error'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { MultiselectInput, SelectInputAsync } from '@/components/ui/select-input'
import { TextInput } from '@/components/ui/text-input'
import { createMediaRequest, getMediaTagsRequest, updateMediaRequest } from '@/features/media/api'
import { mediaQueryKeys } from '@/features/media/query-keys'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { getCustomersListRequest } from '@/features/customers/api'
import { useDictionaryQuery } from '@/lib/query-hooks'
import type { Customer } from '@/types/customer'
import type { CreateMediaPayload, Media, UpdateMediaPayload } from '@/types/media'

const mediaFormSchema = z.object({
  name: z.string().trim().min(1, 'Media name is required.'),
  customerId: z.string().optional(),
  tags: z.array(z.string().trim().max(30, 'Tag cannot exceed 30 characters')),
  file: z.instanceof(File).optional(),
})

type MediaFormValues = z.infer<typeof mediaFormSchema>

type MediaFormProps = {
  media?: Media
  customerId?: string
  mode: 'create' | 'edit'
  onCancel: () => void
  onSaved: (media: Media) => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
}

export function MediaForm({ media, customerId, mode, onCancel, onSaved, onDirtyChange }: MediaFormProps) {
  const isEditMode = mode === 'edit'
  const { data: mediaTags = [], isLoading: isLoadingMediaTags } = useDictionaryQuery({
    queryKey: mediaQueryKeys.tags(),
    queryFn: getMediaTagsRequest,
  })
  const tagItems = Array.from(new Set([...mediaTags, ...(media?.tags ?? [])]))
    .filter(Boolean)
    .map((tag) => ({ value: tag, label: tag }))
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<MediaFormValues>({
    resolver: zodResolver(mediaFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: media?.name ?? '',
      customerId: media?.customer?.id ? String(media.customer.id) : (customerId ?? ''),
      tags: media?.tags ?? [],
      file: undefined,
    },
  })

  const createMutation = useMutation({
    mutationFn: createMediaRequest,
    onSuccess: onSaved,
  })
  const updateMutation = useMutation({
    mutationFn: (payload: UpdateMediaPayload) => {
      if (!media?.id) throw new Error('Media is required.')

      return updateMediaRequest(String(media.id), payload)
    },
    onSuccess: onSaved,
  })
  const activeMutation = isEditMode ? updateMutation : createMutation

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const submitForm = handleSubmit(async (values) => {
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          name: values.name.trim(),
          customerId: values.customerId || undefined,
          tags: values.tags,
        })
        return
      }

      if (!values.file) {
        setError('file', {
          type: 'required',
          message: 'File is required.',
        })
        return
      }

      const payload: CreateMediaPayload = {
        name: values.name.trim(),
        customerId: values.customerId || undefined,
        tags: values.tags,
        file: values.file,
      }

      await createMutation.mutateAsync(payload)
    } catch {
      // Keep the drawer open; React Query exposes the error for FormError.
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
          {!isEditMode ? (
            <Controller
              control={control}
              name="file"
              render={({ field, fieldState }) => (
                <FileInput
                  label="Import media file"
                  formats={['mp4', 'mov']}
                  maxSizeMb={100}
                  required
                  value={field.value ? [field.value] : []}
                  error={fieldState.error?.message}
                  onValueChange={(files) => field.onChange(files[0])}
                  onBlur={field.onBlur}
                />
              )}
            />
          ) : media?.thumbnailUrl ? (
            <div className="grid gap-3">
              <img src={media.thumbnailUrl} alt={media.name} className="h-32 w-full rounded-md object-cover" />
            </div>
          ) : null}

          <TextInput label="Media name" required error={errors.name?.message} {...register('name')} />

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
                selectedItems={media?.customer ? [media.customer as Customer] : []}
                value={field.value}
                error={fieldState.error?.message}
                onValueChange={(value) => field.onChange(String(value))}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />

          <Controller
            control={control}
            name="tags"
            render={({ field, fieldState }) => (
              <MultiselectInput
                label="Tag"
                placeholder="Add tag"
                creatable
                searchable
                items={tagItems}
                isLoading={isLoadingMediaTags}
                value={field.value}
                error={fieldState.error?.message}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
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
            {isEditMode ? 'Save' : 'Add media'}
          </Button>
        </div>
        <FormError message={errorMessage} />
      </div>
    </form>
  )
}
