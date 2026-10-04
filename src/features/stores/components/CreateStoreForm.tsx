import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { FormError } from '@/components/form-error'
import { CountrySelectInput } from '@/components/ui/country-select-input'
import { FieldGroup } from '@/components/ui/field'
import { SelectInput, SelectInputAsync, type SelectInputItem } from '@/components/ui/select-input'
import { TextInput } from '@/components/ui/text-input'
import { getCustomersListRequest } from '@/features/customers/api'
import { createStoreRequest, updateStoreRequest } from '@/features/stores/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { storesQueryKeys } from '@/features/stores/query-keys'
import type { Customer } from '@/types/customer'
import type { CreateStorePayload, Store } from '@/types/store'
import { TimezoneUtils } from '@/utils'
import { OrganizationType } from '@/types/organization'

const storeFormSchema = z.object({
  name: z.string().trim().min(1, 'Store name is required.'),
  number: z.string().trim().optional(),
  customerId: z.string().trim().min(1, 'Customer is required.'),
  retailer: z.string().trim().optional(),
  address: z.string().trim().min(1, 'Address is required.'),
  city: z.string().trim().min(1, 'City is required.'),
  state: z.string().trim().optional(),
  zipCode: z.string().trim().min(1, 'Zip code is required.'),
  countryId: z.string().trim().min(1, 'Country is required.'),
  timezone: z.string().trim().min(1, 'Timezone is required.'),
})

type StoreFormValues = z.infer<typeof storeFormSchema>

const timezoneItems = TimezoneUtils.getTimezones({ countries: ['us', 'fr'] }).map((timezone) => ({
  value: timezone.name,
  label: timezone.name,
}))

type CreateStoreFormProps = {
  store?: Store
  customerId?: string
  onCancel: () => void
  onSaved: () => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
}

export function CreateStoreForm({ store, customerId, onCancel, onSaved, onDirtyChange }: CreateStoreFormProps) {
  const isEditMode = !!store?.id
  const queryClient = useQueryClient()
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(store?.parent)
  const createStoreMutation = useMutation({
    mutationFn: createStoreRequest,
    onSuccess: async (_store, payload) => {
      const customerId = payload.customerId

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: storesQueryKeys.all }),
        customerId
          ? queryClient.invalidateQueries({
              queryKey: storesQueryKeys.customer(customerId),
            })
          : Promise.resolve(),
      ])
      await onSaved()
    },
  })
  const updateStoreMutation = useMutation({
    mutationFn: (payload: CreateStorePayload) => {
      if (!store) throw new Error('Store is required.')

      return updateStoreRequest(store.id, payload)
    },
    onSuccess: async (_store, payload) => {
      const customerId = payload.customerId

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: storesQueryKeys.all }),
        customerId && customerId !== store?.parent?.id
          ? queryClient.invalidateQueries({
              queryKey: storesQueryKeys.customer(customerId),
            })
          : Promise.resolve(),
        store ? queryClient.invalidateQueries({ queryKey: storesQueryKeys.detail(store.id) }) : Promise.resolve(),
      ])
      await onSaved()
    },
  })
  const activeMutation = isEditMode ? updateStoreMutation : createStoreMutation

  const getCustomerOption = useCallback((customer: Customer): SelectInputItem => {
    return { value: customer.id, label: customer.name }
  }, [])

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: store?.name ?? '',
      number: store?.number ?? '',
      customerId: store?.parentId ?? store?.parent?.id ?? customerId ?? '',
      retailer: store?.retailer ?? '',
      address: store?.address?.street ?? '',
      city: store?.address?.city ?? '',
      state: store?.address?.stateId ?? '',
      zipCode: store?.address?.zip ?? '',
      countryId: store?.address?.countryId ?? '',
      timezone: store?.timezone ?? '',
    },
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const submitForm = handleSubmit(async (values) => {
    const selectedCustomerId = values.customerId.trim()

    const payload: CreateStorePayload = {
      type: OrganizationType.STORE,
      name: values.name.trim(),
      number: values.number?.trim(),
      customerId: selectedCustomerId,
      retailer: values.retailer?.trim(),
      address: {
        street: values.address.trim(),
        city: values.city.trim(),
        stateId: values.state?.trim(),
        zip: values.zipCode.trim(),
        countryId: values.countryId.trim().toUpperCase(),
      },
      timezone: values.timezone,
      phone: store?.phone,
      email: store?.email,
    }

    if (isEditMode) {
      await updateStoreMutation.mutateAsync(payload)
      return
    }

    await createStoreMutation.mutateAsync(payload)
  })
  const errorMessage = activeMutation.error instanceof Error ? activeMutation.error.message : undefined

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submitForm}>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-2">
        <FieldGroup className="gap-4">
          <TextInput label="Store name" required error={errors.name?.message} {...register('name')} />
          <TextInput label="Store number" error={errors.number?.message} {...register('number')} />
          <Controller
            control={control}
            name="customerId"
            render={({ field, fieldState }) => (
              <SelectInputAsync
                label="Customer"
                placeholder="Select customer"
                required
                queryKey={[...customersQueryKeys.all, 'new-store']}
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
          <TextInput label="Retailer" placeholder="Placeholder" {...register('retailer')} />
          <TextInput label="Address" required error={errors.address?.message} {...register('address')} />
          <TextInput label="City" required error={errors.city?.message} {...register('city')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="State" placeholder="Placeholder" {...register('state')} />
            <TextInput label="Zip Code" required error={errors.zipCode?.message} {...register('zipCode')} />
          </div>
          <Controller
            control={control}
            name="countryId"
            render={({ field, fieldState }) => (
              <CountrySelectInput
                label="Country"
                placeholder="Select country"
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
            name="timezone"
            render={({ field, fieldState }) => (
              <SelectInput
                label="Timezone"
                placeholder="Select timezone"
                required
                searchable
                items={timezoneItems}
                error={fieldState.error?.message}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
        </FieldGroup>
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-transparent px-7 py-6">
        <div className="flex justify-center gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="lg" loading={isSubmitting}>
            {isEditMode ? 'Save' : 'Create'}
          </Button>
        </div>
        <FormError message={errorMessage} />
      </div>
    </form>
  )
}
