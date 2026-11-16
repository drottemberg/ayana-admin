import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
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
import { OrganizationBrandingFields } from '@/features/organizations/OrganizationBrandingFields'
import { saveOrganizationBrandingDraft, type BrandingDraft, type BrandingKind } from '@/features/organizations/organization-branding-api'
import {
  getCustomerClientAppLinksRequest,
  updateCustomerClientAppLinksRequest,
  type ClientAppLinks,
} from '@/features/customers/customer-settings-api'

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
  websiteUrl: z.string().trim().optional().or(z.literal('')).refine((value) => !value || (z.string().url().safeParse(value).success && value.startsWith('https://')), 'Enter a valid HTTPS URL.'),
  instagramUrl: z.string().trim().optional().or(z.literal('')).refine((value) => !value || (z.string().url().safeParse(value).success && value.startsWith('https://')), 'Enter a valid HTTPS URL.'),
})

type CustomerFormValues = z.infer<typeof customerFormSchema>

function customerFormDefaults(customer?: Customer): CustomerFormValues {
  return {
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
    websiteUrl: customer?.websiteUrl ?? '',
    instagramUrl: customer?.instagramUrl ?? '',
  }
}

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
  const [brandingDraft, setBrandingDraft] = useState<BrandingDraft>({})
  const [appLinks, setAppLinks] = useState<ClientAppLinks>({ bookingAppUrlTemplate: null, orderAppUrlTemplate: null })
  const [appLinksLoaded, setAppLinksLoaded] = useState(!customer?.id)
  const [appLinksDirty, setAppLinksDirty] = useState(false)
  const createCustomerMutation = useMutation({
    mutationFn: async (payload: CreateCustomerPayload) => {
      const saved = await createCustomerRequest(payload)
      await saveOrganizationBrandingDraft(saved.id, brandingDraft)
      if (appLinks.bookingAppUrlTemplate || appLinks.orderAppUrlTemplate) {
        await updateCustomerClientAppLinksRequest(saved.id, appLinks)
      }
      return saved
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customersQueryKeys.all })
      await onSaved()
    },
  })
  const updateCustomerMutation = useMutation({
    mutationFn: async (payload: CreateCustomerPayload) => {
      if (!customer) throw new Error('Customer is required.')

      const saved = await updateCustomerRequest(customer.id, payload)
      await saveOrganizationBrandingDraft(customer.id, brandingDraft)
      if (appLinksLoaded) await updateCustomerClientAppLinksRequest(customer.id, appLinks)
      return saved
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
    reset,
    formState: { errors, isDirty, isSubmitting, isValid },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    mode: 'onChange',
    defaultValues: customerFormDefaults(customer),
  })

  useEffect(() => {
    reset(customerFormDefaults(customer))
  }, [customer, reset])

  useEffect(() => {
    setBrandingDraft({})
    setAppLinks({ bookingAppUrlTemplate: null, orderAppUrlTemplate: null })
    setAppLinksLoaded(!customer?.id)
    setAppLinksDirty(false)
    if (!customer?.id) return
    let active = true
    void getCustomerClientAppLinksRequest(customer.id).then(({ customer: links }) => {
      if (!active) return
      setAppLinks(links)
      setAppLinksLoaded(true)
      setAppLinksDirty(false)
    }).catch(() => undefined)
    return () => { active = false }
  }, [customer?.id])

  useEffect(() => {
    onDirtyChange?.(isDirty || Object.keys(brandingDraft).length > 0 || appLinksDirty)
  }, [isDirty, brandingDraft, appLinksDirty, onDirtyChange])

  const updateBrandingDraft = (kind: BrandingKind, value: File | null | undefined) => {
    setBrandingDraft((current) => {
      const next = { ...current }
      if (value === undefined) delete next[kind]
      else next[kind] = value
      return next
    })
  }

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
      websiteUrl: values.websiteUrl?.trim() || null,
      instagramUrl: values.instagramUrl?.trim() || null,
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
        <section className="space-y-3 rounded-lg border p-4">
          <div>
            <h3 className="text-sm font-semibold">Online presence</h3>
            <p className="text-xs text-muted-foreground">These links are used in customer emails when a location does not provide its own.</p>
          </div>
          <TextInput label="Website URL" type="url" placeholder="https://example.com" error={errors.websiteUrl?.message} {...register('websiteUrl')} />
          <TextInput label="Instagram URL" type="url" placeholder="https://instagram.com/example" error={errors.instagramUrl?.message} {...register('instagramUrl')} />
        </section>
        <OrganizationBrandingFields
          organizationId={customer?.id}
          logoAttachmentId={customer?.logoAttachmentId}
          logoIconAttachmentId={customer?.logoIconAttachmentId}
          draft={brandingDraft}
          onDraftChange={updateBrandingDraft}
        />
        <section className="space-y-3 rounded-lg border p-4">
          <div>
            <h3 className="text-sm font-semibold">Client app links</h3>
            <p className="text-xs text-muted-foreground">Optional URL templates used for booking and ordering links.</p>
          </div>
          <TextInput
            label="Planning app URL template"
            placeholder="https://example.com/planning?location={location-slug}"
            value={appLinks.bookingAppUrlTemplate ?? ''}
            onChange={(event) => { setAppLinksDirty(true); setAppLinks((current) => ({ ...current, bookingAppUrlTemplate: event.target.value || null })) }}
            disabled={!appLinksLoaded}
          />
          <TextInput
            label="Order app URL template"
            placeholder="https://example.com/store?location={location-slug}"
            value={appLinks.orderAppUrlTemplate ?? ''}
            onChange={(event) => { setAppLinksDirty(true); setAppLinks((current) => ({ ...current, orderAppUrlTemplate: event.target.value || null })) }}
            disabled={!appLinksLoaded}
          />
        </section>
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
