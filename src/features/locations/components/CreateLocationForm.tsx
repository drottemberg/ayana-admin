import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { State } from 'country-state-city'
import countries from 'world-countries'

import { FormError } from '@/components/form-error'
import { CountrySelectInput } from '@/components/ui/country-select-input'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { PhoneInput } from '@/components/ui/phone-input'
import { SelectInput, SelectInputAsync, type SelectInputItem } from '@/components/ui/select-input'
import { TextInput } from '@/components/ui/text-input'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { getCustomerRequest } from '@/features/customers/api'
import {
  createLocationRequest,
  fetchLocationCustomerOptions,
  updateLocationRequest,
  type CreateLocationPayload,
} from '@/features/locations/api'
import { locationsQueryKeys } from '@/features/locations/query-keys'
import { validatePhone } from '@/lib/phone'
import type { Customer } from '@/types/customer'
import type { Location } from '@/types/location'
import { TimezoneUtils } from '@/utils'

const optionalPhone = z
  .string()
  .optional()
  .refine((value) => (value ? !validatePhone(value) : true), 'Enter a valid phone number.')

const locationFormSchema = z.object({
  name: z.string().trim().min(1, 'Location name is required.'),
  slug: z.string().optional(),
  customerId: z.string().trim().min(1, 'Customer is required.'),
  phone: optionalPhone,
  email: z
    .string()
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, 'Enter a valid email.'),
  timezone: z.string().trim().min(1, 'Timezone is required.'),
  currency: z.string().trim().min(1, 'Currency is required.'),
  street: z.string().trim().min(1, 'Address is required.'),
  suite: z.string().optional(),
  city: z.string().trim().min(1, 'City is required.'),
  stateId: z.string().optional(),
  zip: z.string().trim().min(1, 'Zip code is required.'),
  countryId: z.string().trim().min(1, 'Country is required.'),
  description: z.string().optional(),
  googleReviewUrl: z.string().trim().optional().or(z.literal('')).refine((value) => !value || z.string().url().safeParse(value).success, 'Enter a valid Google review URL.'),
  contactName: z.string().optional(),
  contactPhone: optionalPhone,
  contactEmail: z
    .string()
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, 'Enter a valid email.'),
})

type LocationFormValues = z.infer<typeof locationFormSchema>

type CreateLocationFormProps = {
  customerId?: string
  location?: Location
  onCancel: () => void
  onSaved: () => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
}

const timezoneItems: SelectInputItem[] = TimezoneUtils.getTimezones().map((timezone) => ({
  value: timezone.name,
  label: TimezoneUtils.getTimezoneLabel(timezone),
}))

const currencies = new Map<string, { name: string; symbol: string }>()
countries.forEach((country) => {
  Object.entries(country.currencies ?? {}).forEach(([code, currency]) => currencies.set(code, currency))
})

const currencyItems: SelectInputItem[] = [...currencies.entries()]
  .sort(
    ([codeA, currencyA], [codeB, currencyB]) =>
      currencyA.name.localeCompare(currencyB.name) || codeA.localeCompare(codeB),
  )
  .map(([code, currency]) => ({
    value: code,
    label: `${code} — ${currency.name}${currency.symbol ? ` (${currency.symbol})` : ''}`,
  }))

export function CreateLocationForm({
  customerId,
  location,
  onCancel,
  onSaved,
  onDirtyChange,
}: CreateLocationFormProps) {
  const isEditMode = Boolean(location?.id)
  const initialCustomerId = location?.parentId ?? customerId
  const queryClient = useQueryClient()
  const userSelectedCustomer = useRef(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>()
  const initialCustomerQuery = useQuery({
    queryKey: customersQueryKeys.detail(initialCustomerId ?? ''),
    queryFn: () => getCustomerRequest(initialCustomerId!),
    enabled: Boolean(initialCustomerId),
  })
  const createMutation = useMutation({
    mutationFn: createLocationRequest,
    onSuccess: async (_saved, payload) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: locationsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: customersQueryKeys.detail(payload.customerId) }),
        queryClient.invalidateQueries({ queryKey: ['customer-detail-batch', payload.customerId] }),
      ])
      await onSaved()
    },
  })
  const updateMutation = useMutation({
    mutationFn: (payload: CreateLocationPayload) => {
      if (!location) throw new Error('Location is required.')

      return updateLocationRequest(location.id, payload)
    },
    onSuccess: async () => {
      const parentId = location?.parentId
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: locationsQueryKeys.all }),
        location
          ? queryClient.invalidateQueries({ queryKey: locationsQueryKeys.detail(location.id) })
          : Promise.resolve(),
        parentId ? queryClient.invalidateQueries({ queryKey: customersQueryKeys.detail(parentId) }) : Promise.resolve(),
        parentId ? queryClient.invalidateQueries({ queryKey: ['customer-detail-batch', parentId] }) : Promise.resolve(),
      ])
      await onSaved()
    },
  })
  const activeMutation = isEditMode ? updateMutation : createMutation
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty, isSubmitting, isValid },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: location?.name ?? '',
      slug: location?.slug ?? '',
      customerId: initialCustomerId ?? '',
      phone: location?.phone ?? '',
      email: location?.email ?? '',
      timezone: location?.timezone ?? '',
      currency: location?.currency ?? '',
      street: location?.address?.street ?? '',
      suite: location?.address?.suite ?? '',
      city: location?.address?.city ?? '',
      stateId: location?.address?.stateId ?? '',
      zip: location?.address?.zip ?? '',
      countryId: location?.address?.countryId ?? '',
      description: location?.description ?? '',
      googleReviewUrl: location?.googleReviewUrl ?? '',
      contactName: location?.contactName ?? '',
      contactPhone: location?.contactPhone ?? '',
      contactEmail: location?.contactEmail ?? '',
    },
  })
  const countryId = useWatch({ control, name: 'countryId' })
  const storefrontSlug = useWatch({ control, name: 'slug' })
  const stateItems = countryId
    ? State.getStatesOfCountry(countryId.toUpperCase())
        .map((state) => ({ value: state.isoCode, label: state.name }))
        .sort((a, b) => a.label.localeCompare(b.label))
    : []

  useEffect(() => {
    const parent = initialCustomerQuery.data
    if (!parent || userSelectedCustomer.current) return

    setSelectedCustomer(parent)
    setValue('customerId', parent.id, { shouldDirty: false, shouldValidate: true })
    if (!location?.timezone)
      setValue('timezone', parent.timezone ?? 'Europe/Paris', { shouldDirty: false, shouldValidate: true })
    if (!location?.currency)
      setValue('currency', parent.currency ?? 'EUR', { shouldDirty: false, shouldValidate: true })
    if (!location?.address?.countryId && parent.address?.countryId) {
      setValue('stateId', '', { shouldDirty: false })
      setValue('countryId', parent.address.countryId, { shouldDirty: false })
    }
  }, [initialCustomerQuery.data, location, setValue])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const getCustomerOption = useCallback((customer: Customer) => ({ value: customer.id, label: customer.name }), [])

  const applyParentDefaults = (customer: Customer) => {
    userSelectedCustomer.current = true
    setSelectedCustomer(customer)
    setValue('timezone', customer.timezone ?? 'Europe/Paris', { shouldDirty: true, shouldValidate: true })
    setValue('currency', customer.currency ?? 'EUR', { shouldDirty: true, shouldValidate: true })
    if (customer.address?.countryId) {
      setValue('stateId', '', { shouldDirty: true })
      setValue('countryId', customer.address.countryId, { shouldDirty: true, shouldValidate: true })
    }
  }

  const submitForm = handleSubmit(async (values) => {
    const payload: CreateLocationPayload = {
      name: values.name.trim(),
      slug: values.slug?.trim() || undefined,
      customerId: values.customerId,
      phone: values.phone?.trim() || undefined,
      email: values.email?.trim() || undefined,
      timezone: values.timezone,
      currency: values.currency.toUpperCase(),
      description: values.description?.trim() || undefined,
      googleReviewUrl: values.googleReviewUrl?.trim() || null,
      contactName: values.contactName?.trim() || undefined,
      contactPhone: values.contactPhone?.trim() || undefined,
      contactEmail: values.contactEmail?.trim() || undefined,
      address: {
        street: values.street.trim(),
        suite: values.suite?.trim() || undefined,
        city: values.city.trim(),
        stateId: values.stateId?.trim() || undefined,
        zip: values.zip.trim(),
        countryId: values.countryId.trim().toUpperCase(),
      },
    }

    if (isEditMode) {
      await updateMutation.mutateAsync(payload)
      return
    }

    await createMutation.mutateAsync(payload)
  })

  const errorMessage = activeMutation.error instanceof Error ? activeMutation.error.message : undefined

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submitForm}>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-2">
        <FieldGroup className="gap-4">
          <TextInput label="Location name" required error={errors.name?.message} {...register('name')} />
          <div>
            <TextInput label="Storefront URL slug" placeholder="clichy" error={errors.slug?.message} {...register('slug')} />
            <p className="mt-1 text-xs text-muted-foreground">
              URL: order.ayana.club/{selectedCustomer?.slug || 'customer'}/{storefrontSlug || location?.slug || 'location'}
            </p>
          </div>
          <Controller
            control={control}
            name="customerId"
            render={({ field, fieldState }) => (
              <SelectInputAsync
                label="Customer"
                placeholder="Select customer"
                required
                disabled={Boolean(customerId || location)}
                queryKey={[...customersQueryKeys.all, 'new-location']}
                queryFn={fetchLocationCustomerOptions}
                getOption={getCustomerOption}
                selectedItems={selectedCustomer ? [selectedCustomer] : []}
                loadingMessage="Loading customers..."
                errorMessage="Failed to load customers."
                emptyMessage="No customers found."
                error={fieldState.error?.message}
                value={field.value}
                onValueChange={(value) => field.onChange(String(value))}
                onSelectedItemsChange={(items) => {
                  if (items[0]) applyParentDefaults(items[0])
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <TextInput label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Controller
            control={control}
            name="phone"
            render={({ field, fieldState }) => (
              <PhoneInput
                label="Phone"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                error={fieldState.error?.message}
              />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
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
                  onValueChange={(value) => field.onChange(String(value))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
            <Controller
              control={control}
              name="currency"
              render={({ field, fieldState }) => (
                <SelectInput
                  label="Currency"
                  placeholder="Select currency"
                  required
                  searchable
                  items={currencyItems}
                  error={fieldState.error?.message}
                  value={field.value}
                  onValueChange={(value) => field.onChange(String(value))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
          </div>
          <TextInput label="Address" required error={errors.street?.message} {...register('street')} />
          <TextInput label="Address line 2" error={errors.suite?.message} {...register('suite')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="City" required error={errors.city?.message} {...register('city')} />
            <Controller
              control={control}
              name="stateId"
              render={({ field, fieldState }) => (
                <SelectInput
                  label="State / region"
                  placeholder={
                    !countryId
                      ? 'Select a country first'
                      : stateItems.length
                        ? 'Select state / region'
                        : 'No regions available'
                  }
                  autoComplete="new-password"
                  items={stateItems}
                  disabled={!countryId || stateItems.length === 0}
                  error={fieldState.error?.message}
                  value={field.value}
                  onValueChange={(value) => field.onChange(String(value))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Zip code" required error={errors.zip?.message} {...register('zip')} />
            <Controller
              control={control}
              name="countryId"
              render={({ field, fieldState }) => (
                <CountrySelectInput
                  label="Country"
                  placeholder="Select country"
                  required
                  autoComplete="new-password"
                  error={fieldState.error?.message}
                  value={field.value}
                  onValueChange={(value) => {
                    if (value !== field.value) setValue('stateId', '', { shouldDirty: true })
                    field.onChange(value)
                  }}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
          </div>
          <TextInput label="Contact name" error={errors.contactName?.message} {...register('contactName')} />
          <Controller
            control={control}
            name="contactPhone"
            render={({ field, fieldState }) => (
              <PhoneInput
                label="Contact phone"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label="Contact email"
            type="email"
            error={errors.contactEmail?.message}
            {...register('contactEmail')}
          />
          <TextInput label="Description" error={errors.description?.message} {...register('description')} />
          <div>
            <TextInput
              label="Google review link"
              type="url"
              placeholder="https://g.page/r/.../review"
              error={errors.googleReviewUrl?.message}
              {...register('googleReviewUrl')}
            />
            <p className="mt-1 text-xs text-muted-foreground">Used to invite customers to review this location after a completed visit or pickup.</p>
          </div>
        </FieldGroup>
      </div>

      <div className="mt-auto flex flex-col gap-3 px-7 py-6">
        <div className="flex justify-center gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={!isDirty || !isValid || isSubmitting} loading={isSubmitting}>
            {isEditMode ? 'Save location' : 'Add location'}
          </Button>
        </div>
        <FormError message={errorMessage} />
      </div>
    </form>
  )
}
