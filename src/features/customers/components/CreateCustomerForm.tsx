import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { PhoneInput } from '@/components/ui/phone-input'
import { TextInput } from '@/components/ui/text-input'
import type { CreateCustomerPayload, Customer } from '@/types/customer'
import { FormError } from '@/components/form-error'
import { createCustomerRequest, updateCustomerRequest } from '@/features/customers/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import { normalizePhone, validatePhone } from '@/lib/phone'

const customerFormSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required.'),
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
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting, isValid },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: customer?.name ?? '',
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
        <PhoneInput
          label="Contact phone"
          placeholder="988-710-9998"
          error={errors.contactPhone?.message}
          {...register('contactPhone')}
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
