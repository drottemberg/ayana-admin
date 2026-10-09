import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { PhoneInput } from '@/components/ui/phone-input'
import { SelectInput, type SelectInputItem } from '@/components/ui/select-input'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import type { CreateCustomerPayload, Customer } from '@/types/customer'
import { FormError } from '@/components/form-error'
import { createCustomerRequest, updateCustomerRequest } from '@/features/customers/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { normalizePhone, validatePhone } from '@/lib/phone'
import { TimezoneUtils } from '@/utils'
import countries from 'world-countries'

const customerFormSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required.'),
  slug: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: 'Enter a valid email.',
    }),
  phone: z
    .string()
    .optional()
    .refine((value) => (value ? !validatePhone(value) : true), {
      message: 'Enter a valid phone number.',
    }),
  timezone: z.string().optional(),
  currency: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^[A-Za-z]{3}$/.test(value), {
      message: 'Enter a 3-letter currency code.',
    }),
  description: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z
    .string()
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: 'Enter a valid email.',
    }),
  contactPhone: z
    .string()
    .optional()
    .refine((value) => (value ? !validatePhone(value) : true), {
      message: 'Enter a valid phone number.',
    }),
})

type CustomerFormValues = z.infer<typeof customerFormSchema>

const timezoneItems: SelectInputItem[] = TimezoneUtils.getTimezones().map((timezone) => ({
  value: timezone.name,
  label: TimezoneUtils.getTimezoneLabel(timezone),
}))

const currencies = new Map<string, { name: string; symbol: string }>()
countries.forEach((country) => {
  Object.entries(country.currencies ?? {}).forEach(([code, currency]) => {
    currencies.set(code, currency)
  })
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

type CreateCustomerFormProps = {
  customer?: Customer
  onCancel: () => void
  onSaved: () => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
}

export function CreateCustomerForm({ customer, onCancel, onSaved, onDirtyChange }: CreateCustomerFormProps) {
  const isEditMode = !!customer?.id
  const queryClient = useQueryClient()
  const createCustomerMutation = useMutation({
    mutationFn: createCustomerRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customersQueryKeys.all })
      await onSaved()
    },
  })
  const updateCustomerMutation = useMutation({
    mutationFn: (payload: CreateCustomerPayload) => {
      if (!customer) throw new Error('Customer is required.')

      return updateCustomerRequest(customer.id, payload)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: customersQueryKeys.all }),
        customer
          ? queryClient.invalidateQueries({ queryKey: customersQueryKeys.detail(customer.id) })
          : Promise.resolve(),
      ])
      await onSaved()
    },
  })
  const activeMutation = isEditMode ? updateCustomerMutation : createCustomerMutation
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting, isValid },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: customer?.name ?? '',
      slug: customer?.slug ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      timezone: customer?.timezone ?? '',
      currency: customer?.currency ?? 'EUR',
      description: customer?.description ?? '',
      contactName: customer?.contactName ?? '',
      contactEmail: customer?.contactEmail ?? '',
      contactPhone: customer?.contactPhone ?? '',
    },
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const submitForm = handleSubmit(async (values) => {
    const payload: CreateCustomerPayload = {
      name: values.name.trim(),
      slug: values.slug?.trim() || undefined,
      email: values.email?.trim() || undefined,
      phone: values.phone ? normalizePhone(values.phone) : undefined,
      timezone: values.timezone?.trim() || undefined,
      currency: values.currency?.trim().toUpperCase() || 'EUR',
      description: values.description?.trim() || undefined,
      contactName: values.contactName?.trim() || undefined,
      contactEmail: values.contactEmail?.trim() || undefined,
      contactPhone: values.contactPhone ? normalizePhone(values.contactPhone) : undefined,
    }

    if (isEditMode) {
      await updateCustomerMutation.mutateAsync(payload)
      return
    }

    await createCustomerMutation.mutateAsync(payload)
  })
  const errorMessage = activeMutation.error instanceof Error ? activeMutation.error.message : undefined

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={submitForm}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-7 py-2">
        <TextInput
          label="Customer name"
          placeholder="Customer name"
          required
          error={errors.name?.message}
          {...register('name')}
        />
        <TextInput
          label="Storefront URL slug"
          placeholder="ayana-paris"
          error={errors.slug?.message}
          {...register('slug')}
        />
        <TextInput
          label="Email"
          type="email"
          placeholder="hello@company.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field, fieldState }) => (
            <PhoneInput
              label="Phone"
              placeholder="6 12 34 56 78"
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
            name="timezone"
            render={({ field, fieldState }) => (
              <SelectInput
                label="Timezone"
                placeholder="Select timezone"
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
        <Field>
          <FieldLabel htmlFor="customer-description">Description</FieldLabel>
          <Textarea id="customer-description" rows={3} {...register('description')} />
          {errors.description?.message ? <FieldError>{errors.description.message}</FieldError> : null}
        </Field>
        <TextInput
          label="Contact name"
          placeholder="Contact name"
          error={errors.contactName?.message}
          {...register('contactName')}
        />
        <TextInput
          label="Contact email"
          type="email"
          placeholder="contact@company.com"
          error={errors.contactEmail?.message}
          {...register('contactEmail')}
        />
        <Controller
          control={control}
          name="contactPhone"
          render={({ field, fieldState }) => (
            <PhoneInput
              label="Contact phone"
              placeholder="6 12 34 56 78"
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

      <div className="mt-auto flex flex-col gap-3 px-7 py-6">
        <div className="mt-auto flex justify-center gap-3">
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={isSubmitting || !isValid} loading={isSubmitting}>
            {isEditMode ? 'Save' : 'Create'}
          </Button>
        </div>
        <FormError message={errorMessage} />
      </div>
    </form>
  )
}
