import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { FormError } from '@/components/form-error'
import { BaseModal } from '@/components/modals/BaseModal'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { SelectInput, SelectInputAsync, type SelectInputItem } from '@/components/ui/select-input'
import { TextInput } from '@/components/ui/text-input'
import { getCustomersListRequest } from '@/features/customers/api'
import { customersQueryKeys } from '@/features/customers/query-keys'
import {
  createProductBrandRequest,
  createProductRequest,
  getProductBrandsRequest,
  updateProductRequest,
} from '@/features/products/api'
import { productsQueryKeys } from '@/features/products/query-keys'
import { useConnect } from '@/features/app/use-connect'
import { useDictionaryQuery } from '@/lib/query-hooks'
import { cn } from '@/lib/utils'
import type { Customer } from '@/types/customer'
import { OrganizationType } from '@/types/organization'
import type { CreateProductPayload, Product, UpdateProductPayload } from '@/types/product'
import { getPortalSafe, Portal } from '@/utils/portal-utils'

type ComboboxContainer = React.ComponentProps<typeof SelectInput>['container']

const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.'),
  customerId: z.string().trim().optional(),
  brandId: z.string().trim().optional(),
})

type ProductFormValues = z.infer<typeof productFormSchema>

type CreateProductFormProps = {
  product?: Product
  customerId?: string
  onCancel: () => void
  onSaved: () => Promise<void> | void
  onDirtyChange?: (dirty: boolean) => void
  comboboxContainer?: ComboboxContainer
  className?: string
}

export function CreateProductForm({
  product,
  customerId,
  onCancel,
  onSaved,
  onDirtyChange,
  comboboxContainer,
  className,
}: CreateProductFormProps) {
  const isEditMode = !!product?.id
  const queryClient = useQueryClient()
  const { session } = useConnect()
  const portal = getPortalSafe()
  const isAdminContext = portal === Portal.ADMIN
  const currentOrganization = session?.currentOrganization
  const currentCustomer = useMemo(
    () =>
      !isAdminContext && currentOrganization?.id
        ? ({
            id: currentOrganization.id,
            name: currentOrganization.name,
            type: OrganizationType.CUSTOMER,
          } as Customer)
        : undefined,
    [currentOrganization, isAdminContext],
  )
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(product?.customer)
  const [brandSearch, setBrandSearch] = useState('')
  const [isAddBrandOpen, setIsAddBrandOpen] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const resolvedCustomerId = product?.customer.id ?? customerId ?? currentCustomer?.id ?? ''
  const createBrandMutation = useMutation({
    mutationFn: createProductBrandRequest,
    onSuccess: async (brand) => {
      await queryClient.invalidateQueries({ queryKey: [...productsQueryKeys.brands, brand.customerId] })
      setValue('brandId', brand.id)
      setNewBrandName('')
      setIsAddBrandOpen(false)
    },
  })
  const createProductMutation = useMutation({
    mutationFn: createProductRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productsQueryKeys.all })
      await onSaved()
    },
  })
  const updateProductMutation = useMutation({
    mutationFn: (payload: UpdateProductPayload) => {
      if (!product) throw new Error('Product is required.')

      return updateProductRequest(product.id, payload)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productsQueryKeys.all }),
        product ? queryClient.invalidateQueries({ queryKey: productsQueryKeys.detail(product.id) }) : Promise.resolve(),
      ])
      await onSaved()
    },
  })
  const activeMutation = isEditMode ? updateProductMutation : createProductMutation
  const getCustomerOption = useCallback((customer: Customer): SelectInputItem => {
    return { value: customer.id, label: customer.name }
  }, [])
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: product?.name ?? '',
      customerId: resolvedCustomerId,
      brandId: product?.brand?.id ?? '',
    },
  })
  const selectedCustomerId = useWatch({ control, name: 'customerId' })
  const activeCustomerId = selectedCustomerId || resolvedCustomerId
  const selectedCustomerForInput = selectedCustomer ?? product?.customer ?? currentCustomer
  const { data: brands = [], isFetching } = useDictionaryQuery({
    queryKey: [...productsQueryKeys.brands, activeCustomerId],
    queryFn: () => getProductBrandsRequest(activeCustomerId),
    enabled: Boolean(activeCustomerId),
  })
  const brandItems = brands.map((brand) => ({ value: brand.id, label: brand.name }))

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const submitForm = handleSubmit(async (values) => {
    try {
      if (isEditMode) {
        await updateProductMutation.mutateAsync({
          name: values.name.trim(),
          brandId: values.brandId?.trim() || undefined,
        })
        return
      }

      const submitCustomerId = (isAdminContext ? values.customerId : activeCustomerId)?.trim()
      if (!submitCustomerId) {
        setError('customerId', { message: 'Customer is required.' })
        return
      }

      const payload: CreateProductPayload = {
        name: values.name.trim(),
        customerId: submitCustomerId,
        brandId: values.brandId?.trim() || undefined,
      }

      await createProductMutation.mutateAsync(payload)
    } catch {
      // React Query stores the error on the mutation; keep the drawer open so FormError can render it.
    }
  })
  const isSaving = isSubmitting || activeMutation.isPending
  const errorMessage = activeMutation.error instanceof Error ? activeMutation.error.message : undefined

  const submitNewBrand = async () => {
    const name = newBrandName.trim()
    if (!name || !activeCustomerId) return

    await createBrandMutation.mutateAsync({ customerId: activeCustomerId, name })
  }

  return (
    <>
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
              label="Product name"
              placeholder="Placeholder"
              required
              error={errors.name?.message}
              {...register('name')}
            />
            {isAdminContext ? (
              <Controller
                control={control}
                name="customerId"
                render={({ field, fieldState }) => (
                  <SelectInputAsync
                    label="Customer"
                    placeholder="Select customer"
                    required
                    readOnly={isEditMode}
                    queryKey={[...customersQueryKeys.all, 'new-product']}
                    queryFn={(search) => getCustomersListRequest({ contractId: null }, search)}
                    getOption={getCustomerOption}
                    selectedItems={selectedCustomerForInput ? [selectedCustomerForInput] : []}
                    container={comboboxContainer}
                    loadingMessage="Loading customers..."
                    errorMessage="Failed to load customers."
                    emptyMessage="No customers found."
                    error={fieldState.error?.message}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      setValue('brandId', '', { shouldDirty: true, shouldValidate: true })
                      setBrandSearch('')
                    }}
                    onSelectedItemsChange={(items) => setSelectedCustomer(items[0])}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />
            ) : null}
            <Controller
              control={control}
              name="brandId"
              render={({ field, fieldState }) => (
                <SelectInput
                  label="Brand"
                  placeholder={activeCustomerId ? 'Select brand' : 'Select customer first'}
                  labelAction={
                    <div className="flex items-center gap-2">
                      {createBrandMutation.isPending ? <Spinner className="size-3.5" /> : null}
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        disabled={!activeCustomerId}
                        onClick={() => {
                          setNewBrandName(brandSearch)
                          setIsAddBrandOpen(true)
                        }}
                      >
                        + Add brand
                      </Button>
                    </div>
                  }
                  isLoading={isFetching}
                  searchable
                  disabled={!activeCustomerId}
                  items={brandItems}
                  container={comboboxContainer}
                  error={fieldState.error?.message}
                  value={field.value}
                  onSearchChange={setBrandSearch}
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
              {isEditMode ? 'Save' : 'Create'}
            </Button>
          </div>
          <FormError message={errorMessage} />
        </div>
      </form>

      <BaseModal
        open={isAddBrandOpen}
        onOpenChange={setIsAddBrandOpen}
        onClose={() => setIsAddBrandOpen(false)}
        title="Add brand"
        portalContainer={comboboxContainer}
        footer={
          <>
            <Button variant="outline" className="h-9 px-4" onClick={() => setIsAddBrandOpen(false)}>
              Cancel
            </Button>
            <Button className="h-9 px-4" loading={createBrandMutation.isPending} onClick={() => void submitNewBrand()}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <TextInput
            label="Name"
            placeholder="Brand name"
            value={newBrandName}
            onChange={(event) => setNewBrandName(event.target.value)}
            autoFocus
          />
          <FormError
            message={createBrandMutation.error instanceof Error ? createBrandMutation.error.message : undefined}
          />
        </div>
      </BaseModal>
    </>
  )
}
