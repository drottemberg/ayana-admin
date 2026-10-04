import * as React from 'react'
import { useQuery, type QueryKey } from '@tanstack/react-query'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

type ComboboxContentContainer = React.ComponentProps<typeof ComboboxContent>['container']

type SelectInputValue = string | number

type SelectInputItem = {
  value: SelectInputValue
  label: React.ReactNode
  disabled?: boolean
}

type SelectInputItemInput = SelectInputValue | SelectInputItem

type SelectInputChangeEvent = {
  type: 'change'
  target: {
    name?: string
    value: SelectInputValue
  }
  currentTarget: {
    name?: string
    value: SelectInputValue
  }
}

type SelectInputBlurEvent = {
  type: 'blur'
  target: {
    name?: string
  }
  currentTarget: {
    name?: string
  }
}

type SelectInputProps = {
  label?: React.ReactNode
  labelAction?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  emptyMessage?: React.ReactNode
  items: SelectInputItemInput[]
  placeholder?: string
  containerClassName?: string
  labelClassName?: string
  hintClassName?: string
  errorClassName?: string
  className?: string
  contentClassName?: string
  container?: ComboboxContentContainer
  id?: string
  name?: string
  value?: SelectInputValue
  defaultValue?: SelectInputValue
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  isLoading?: boolean
  loadingMessage?: React.ReactNode
  searchable?: boolean
  filterItems?: boolean
  'aria-invalid'?: boolean | 'true' | 'false'
  onValueChange?: (value: SelectInputValue) => void
  onSearchChange?: (value: string) => void
  onChange?: (event: SelectInputChangeEvent) => void
  onBlur?: (event: SelectInputBlurEvent) => void
}

type MultiselectInputProps = {
  label?: React.ReactNode
  labelAction?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  emptyMessage?: React.ReactNode
  createLabel?: (value: string) => React.ReactNode
  items: SelectInputItemInput[]
  value: string[]
  placeholder?: string
  containerClassName?: string
  labelClassName?: string
  hintClassName?: string
  errorClassName?: string
  className?: string
  contentClassName?: string
  container?: ComboboxContentContainer
  id?: string
  name?: string
  required?: boolean
  disabled?: boolean
  isLoading?: boolean
  loadingMessage?: React.ReactNode
  creatable?: boolean
  searchable?: boolean
  filterItems?: boolean
  'aria-invalid'?: boolean | 'true' | 'false'
  onValueChange: (value: string[]) => void
  onSearchChange?: (value: string) => void
  onBlur?: (event: SelectInputBlurEvent) => void
}

type SelectInputAsyncProps<TData> = Omit<SelectInputProps, 'items' | 'emptyMessage' | 'onSearchChange'> & {
  queryKey: QueryKey
  queryFn: (search: string) => Promise<TData[]>
  getOption: (item: TData) => SelectInputItem
  selectedItems?: TData[]
  debounceMs?: number
  emptyMessage?: React.ReactNode
  errorMessage?: React.ReactNode
  loadingMessage?: React.ReactNode
  onSelectedItemsChange?: (items: TData[]) => void
}

type MultiselectInputAsyncProps<TData> = Omit<MultiselectInputProps, 'items' | 'emptyMessage' | 'onSearchChange'> & {
  queryKey: QueryKey
  queryFn: (search: string) => Promise<TData[]>
  getOption: (item: TData) => SelectInputItem
  selectedItems?: TData[]
  debounceMs?: number
  emptyMessage?: React.ReactNode
  errorMessage?: React.ReactNode
  loadingMessage?: React.ReactNode
  onSelectedItemsChange?: (items: TData[]) => void
}

function setRefs<T>(refs: Array<React.ForwardedRef<T> | undefined>, value: T | null) {
  refs.forEach((ref) => {
    if (!ref) return

    if (typeof ref === 'function') {
      ref(value)
      return
    }

    ref.current = value
  })
}

function normalizeItems(items: SelectInputItemInput[]): SelectInputItem[] {
  return items.map((item) =>
    typeof item === 'string' || typeof item === 'number' ? { value: item, label: item } : item,
  )
}

function getValueText(value: SelectInputValue | null | undefined) {
  return value == null ? '' : String(value)
}

function getLabelText(label: React.ReactNode, fallback: string) {
  return typeof label === 'string' || typeof label === 'number' ? String(label) : fallback
}

function findItemLabel(items: SelectInputItem[], itemValue: SelectInputValue | null | undefined) {
  if (itemValue == null || itemValue === '') return ''

  const item = items.find((option) => option.value === itemValue)
  return item ? getLabelText(item.label, getValueText(item.value)) : getValueText(itemValue)
}

function filterItem(item: SelectInputItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return (
    getValueText(item.value).toLowerCase().includes(normalizedQuery) ||
    getLabelText(item.label, getValueText(item.value)).toLowerCase().includes(normalizedQuery)
  )
}

function useDebouncedValue(value: string, delay = 300) {
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeoutId)
  }, [delay, value])

  return debouncedValue
}

function useAsyncSelectOptions<TData>({
  queryKey,
  queryFn,
  getOption,
  selectedItems = [],
  debounceMs,
}: {
  queryKey: QueryKey
  queryFn: (search: string) => Promise<TData[]>
  getOption: (item: TData) => SelectInputItem
  selectedItems?: TData[]
  debounceMs: number
}) {
  const [search, setSearch] = React.useState('')
  const debouncedSearch = useDebouncedValue(search, debounceMs)
  const query = useQuery({
    queryKey: [...queryKey, debouncedSearch],
    queryFn: () => queryFn(debouncedSearch),
    placeholderData: (previousData) => previousData,
  })
  const dataByValue = React.useMemo(() => {
    return new Map<SelectInputValue, TData>(
      [...selectedItems, ...(query.data ?? [])].map((item) => {
        return [getOption(item).value, item]
      }),
    )
  }, [getOption, query.data, selectedItems])

  const items = React.useMemo(() => {
    const options = new Map<SelectInputValue, SelectInputItem>()

    selectedItems.forEach((item) => {
      const option = getOption(item)
      options.set(option.value, option)
    })
    query.data?.forEach((item) => {
      const option = getOption(item)
      options.set(option.value, option)
    })

    return Array.from(options.values())
  }, [getOption, query.data, selectedItems])

  return {
    items,
    dataByValue,
    isFetching: query.isFetching,
    isError: query.isError,
    setSearch,
  }
}

const SelectInput = React.forwardRef<HTMLInputElement, SelectInputProps>(
  (
    {
      className,
      contentClassName,
      container,
      label,
      labelAction,
      hint,
      error,
      emptyMessage,
      items,
      placeholder,
      containerClassName,
      labelClassName,
      hintClassName,
      errorClassName,
      id,
      value,
      defaultValue = '',
      required,
      disabled,
      readOnly = false,
      isLoading = false,
      loadingMessage = 'Loading...',
      searchable = true,
      filterItems = true,
      onValueChange,
      onSearchChange,
      onChange,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const fieldId = React.useId()
    const anchor = useComboboxAnchor()
    const inputRef = React.useRef<HTMLInputElement>(null)
    const skipNextSearchChangeRef = React.useRef(false)
    const inputId = id ?? (typeof props.name === 'string' && props.name.length > 0 ? props.name : fieldId)
    const isInvalid = Boolean(error) || props['aria-invalid'] === true || props['aria-invalid'] === 'true'
    const normalizedItems = React.useMemo(() => normalizeItems(items), [items])
    const isControlled = value !== undefined
    const [internalValue, setInternalValue] = React.useState(defaultValue)
    const currentValue = isControlled ? value : internalValue
    const selectedItem = normalizedItems.find((item) => item.value === currentValue) ?? null
    const selectedLabel = findItemLabel(normalizedItems, currentValue)
    const [inputValue, setInputValue] = React.useState<string | null>(null)
    const displayValue = inputValue ?? selectedLabel
    const filterValue = inputValue ?? ''
    const visibleItems = React.useMemo(
      () =>
        searchable && filterItems ? normalizedItems.filter((item) => filterItem(item, filterValue)) : normalizedItems,
      [filterItems, filterValue, normalizedItems, searchable],
    )
    const name = props.name

    const [autoContainer, setAutoContainer] = React.useState<HTMLElement | null>(null)

    React.useLayoutEffect(() => {
      if (container) return

      const node = anchor.current
      setAutoContainer(
        node?.closest('[data-slot="dialog-content"], [data-slot="drawer-content"]') as HTMLElement | null,
      )
    }, [anchor, container])

    const getItemLabel = React.useCallback(
      (itemValue: SelectInputValue | null | undefined) => {
        if (itemValue == null || itemValue === '') return ''

        return findItemLabel(normalizedItems, itemValue)
      },
      [normalizedItems],
    )

    return (
      <Field data-slot="select-input-field" data-invalid={isInvalid} className={containerClassName}>
        {(label || labelAction) && (
          <div className="flex items-center justify-between gap-2">
            {label ? (
              <FieldLabel htmlFor={inputId} className={labelClassName} required={required}>
                {label}
              </FieldLabel>
            ) : (
              <span />
            )}
            {labelAction}
          </div>
        )}

        <Combobox
          inputRef={(node) => {
            inputRef.current = node
            setRefs([ref], node)
          }}
          id={inputId}
          name={name}
          value={selectedItem}
          defaultValue={normalizedItems.find((item) => item.value === defaultValue) ?? null}
          inputValue={searchable ? displayValue : selectedLabel}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          items={normalizedItems}
          filter={searchable ? filterItem : null}
          itemToStringLabel={(item) => getItemLabel(item.value)}
          itemToStringValue={(item) => getValueText(item.value)}
          isItemEqualToValue={(item, selectedItem) => item.value === selectedItem.value}
          onInputValueChange={(nextInputValue) => {
            if (skipNextSearchChangeRef.current) {
              skipNextSearchChangeRef.current = false
              return
            }

            if (searchable) {
              setInputValue(nextInputValue)
              onSearchChange?.(nextInputValue)
            }
          }}
          onValueChange={(nextValue) => {
            if (!nextValue) return
            const nextItemValue = nextValue.value

            if (!isControlled) {
              setInternalValue(nextItemValue)
            }

            skipNextSearchChangeRef.current = true
            setInputValue(null)
            onValueChange?.(nextItemValue)
            if (inputRef.current) {
              inputRef.current.value = getValueText(nextItemValue)
            }
            onChange?.({
              type: 'change',
              target: inputRef.current ?? { name, value: nextItemValue },
              currentTarget: inputRef.current ?? { name, value: nextItemValue },
            })
          }}
          onOpenChange={(open) => {
            if (open) {
              return
            }

            setInputValue(null)

            onBlur?.({
              type: 'blur',
              target: { name },
              currentTarget: { name },
            })
          }}
        >
          <div ref={anchor}>
            <ComboboxInput
              id={inputId}
              placeholder={placeholder}
              disabled={disabled}
              showClear={false}
              showTrigger={!readOnly}
              aria-invalid={isInvalid || undefined}
              className={cn(
                'h-9 w-full rounded-[10px] bg-white text-base',
                '[&_[data-slot=input-group-control]]:cursor-pointer',
                className,
              )}
              readOnly={readOnly || !searchable}
            />
          </div>
          <ComboboxContent className={contentClassName} container={container ?? autoContainer} anchor={anchor}>
            <ComboboxList>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
                  {loadingMessage}
                </div>
              ) : null}
              <ComboboxEmpty>{emptyMessage ?? 'No options found.'}</ComboboxEmpty>
              {visibleItems.map((item) => (
                <ComboboxItem key={item.value} value={item} disabled={item.disabled}>
                  {item.label}
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        {error ? (
          <FieldError className={errorClassName}>{error}</FieldError>
        ) : hint ? (
          <FieldDescription className={hintClassName}>{hint}</FieldDescription>
        ) : null}
      </Field>
    )
  },
)
SelectInput.displayName = 'SelectInput'

function MultiselectInput({
  className,
  contentClassName,
  container,
  label,
  labelAction,
  hint,
  error,
  emptyMessage,
  createLabel = (value) => `Create "${value}"`,
  items,
  value,
  placeholder,
  containerClassName,
  labelClassName,
  hintClassName,
  errorClassName,
  id,
  name,
  required,
  disabled,
  isLoading = false,
  loadingMessage = 'Loading...',
  creatable = false,
  searchable = true,
  filterItems = true,
  onValueChange,
  onSearchChange,
  onBlur,
  ...props
}: MultiselectInputProps) {
  const fieldId = React.useId()
  const anchor = useComboboxAnchor()
  const skipNextSearchChangeRef = React.useRef(false)
  const inputId = id ?? (typeof name === 'string' && name.length > 0 ? name : fieldId)
  const isInvalid = Boolean(error) || props['aria-invalid'] === true || props['aria-invalid'] === 'true'
  const normalizedItems = React.useMemo(() => normalizeItems(items), [items])
  const selectedItems = value.map((itemValue) => {
    return normalizedItems.find((item) => item.value === itemValue) ?? { value: itemValue, label: itemValue }
  })
  const [inputValue, setInputValue] = React.useState('')
  const [autoContainer, setAutoContainer] = React.useState<HTMLElement | null>(null)
  const trimmedInput = inputValue.trim()
  const selectedValues = React.useMemo(() => new Set(value), [value])
  const hasExactOption = normalizedItems.some(
    (item) => getValueText(item.value).toLowerCase() === trimmedInput.toLowerCase(),
  )
  const hasExactSelected = value.some((itemValue) => itemValue.toLowerCase() === trimmedInput.toLowerCase())
  const canCreate = creatable && trimmedInput.length > 0 && !hasExactOption && !hasExactSelected
  const createItem = React.useMemo(
    () => (canCreate ? { value: trimmedInput, label: createLabel(trimmedInput), __create: true } : null),
    [canCreate, createLabel, trimmedInput],
  )
  const comboboxItems = React.useMemo(
    () => (createItem ? [...normalizedItems, createItem] : normalizedItems),
    [createItem, normalizedItems],
  )
  const visibleItems = React.useMemo(
    () =>
      searchable && filterItems ? normalizedItems.filter((item) => filterItem(item, inputValue)) : normalizedItems,
    [filterItems, inputValue, normalizedItems, searchable],
  )

  React.useLayoutEffect(() => {
    if (container) return

    const node = anchor.current
    setAutoContainer(node?.closest('[data-slot="dialog-content"], [data-slot="drawer-content"]') as HTMLElement | null)
  }, [anchor, container])

  const updateValue = React.useCallback(
    (nextValue: string[]) => {
      onValueChange(Array.from(new Set(nextValue)))
    },
    [onValueChange],
  )

  return (
    <Field data-slot="multiselect-input-field" data-invalid={isInvalid} className={containerClassName}>
      {(label || labelAction) && (
        <div className="flex items-center justify-between gap-2">
          {label ? (
            <FieldLabel htmlFor={inputId} className={labelClassName} required={required}>
              {label}
            </FieldLabel>
          ) : (
            <span />
          )}
          {labelAction}
        </div>
      )}
      <div ref={anchor}>
        <Combobox
          id={inputId}
          name={name}
          multiple
          readOnly={!searchable}
          value={selectedItems}
          inputValue={inputValue}
          required={required}
          disabled={disabled}
          items={comboboxItems}
          filter={searchable ? filterItem : null}
          itemToStringLabel={(item) => findItemLabel(comboboxItems, item.value)}
          itemToStringValue={(item) => getValueText(item.value)}
          isItemEqualToValue={(item, selectedItem) => item.value === selectedItem.value}
          onInputValueChange={(nextInputValue) => {
            if (skipNextSearchChangeRef.current) {
              skipNextSearchChangeRef.current = false
              return
            }

            if (searchable || creatable) {
              setInputValue(nextInputValue)
              onSearchChange?.(nextInputValue)
            }
          }}
          onValueChange={(nextItems) => {
            skipNextSearchChangeRef.current = true
            updateValue(nextItems.map((item) => getValueText(item.value)))
            setInputValue('')
          }}
          onOpenChange={(open) => {
            if (open) return

            onBlur?.({
              type: 'blur',
              target: { name },
              currentTarget: { name },
            })
          }}
        >
          <ComboboxChips
            aria-invalid={isInvalid || undefined}
            className={cn('min-h-9 rounded-[10px] bg-white text-base', className)}
          >
            {selectedItems.map((item) => (
              <ComboboxChip
                key={item.value}
                className="h-6 rounded-full bg-primary px-3 text-sm text-primary-foreground"
              >
                {item.label}
              </ComboboxChip>
            ))}
            <ComboboxChipsInput
              id={inputId}
              placeholder={value.length ? undefined : placeholder}
              disabled={disabled}
              readOnly={!searchable && !creatable}
              className="min-h-7 text-base placeholder:text-muted-foreground/70"
            />
          </ComboboxChips>

          <ComboboxContent className={contentClassName} container={container ?? autoContainer} anchor={anchor}>
            <ComboboxList>
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
                  {loadingMessage}
                </div>
              ) : null}
              <ComboboxEmpty>{emptyMessage ?? 'No options found.'}</ComboboxEmpty>
              {visibleItems.map((item) => (
                <ComboboxItem
                  key={item.value}
                  value={item}
                  disabled={item.disabled || selectedValues.has(getValueText(item.value))}
                >
                  {item.label}
                </ComboboxItem>
              ))}
              {createItem ? (
                <ComboboxItem key="create-new-item" value={createItem}>
                  {createItem.label}
                </ComboboxItem>
              ) : null}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      {error ? (
        <FieldError className={errorClassName}>{error}</FieldError>
      ) : hint ? (
        <FieldDescription className={hintClassName}>{hint}</FieldDescription>
      ) : null}
    </Field>
  )
}

const SelectInputAsync = React.forwardRef(
  <TData,>(
    {
      queryKey,
      queryFn,
      getOption,
      selectedItems,
      debounceMs = 300,
      value,
      loadingMessage = 'Loading...',
      errorMessage = 'Failed to load options.',
      emptyMessage = 'No options found.',
      onSelectedItemsChange,
      ...props
    }: SelectInputAsyncProps<TData>,
    ref: React.ForwardedRef<HTMLInputElement>,
  ) => {
    const asyncOptions = useAsyncSelectOptions({
      queryKey,
      queryFn,
      getOption,
      selectedItems,
      debounceMs,
    })

    return (
      <SelectInput
        {...props}
        ref={ref}
        value={value}
        items={asyncOptions.items}
        searchable
        filterItems={false}
        isLoading={asyncOptions.isFetching}
        loadingMessage={loadingMessage}
        emptyMessage={asyncOptions.isError ? errorMessage : emptyMessage}
        onSearchChange={asyncOptions.setSearch}
        onValueChange={(nextValue) => {
          props.onValueChange?.(nextValue)
          const selectedItem = asyncOptions.dataByValue.get(nextValue)
          onSelectedItemsChange?.(selectedItem ? [selectedItem] : [])
        }}
      />
    )
  },
) as <TData>(props: SelectInputAsyncProps<TData> & React.RefAttributes<HTMLInputElement>) => React.ReactElement | null

function MultiselectInputAsync<TData>({
  queryKey,
  queryFn,
  getOption,
  selectedItems,
  debounceMs = 300,
  value,
  loadingMessage = 'Loading...',
  errorMessage = 'Failed to load options.',
  emptyMessage = 'No options found.',
  onSelectedItemsChange,
  ...props
}: MultiselectInputAsyncProps<TData>) {
  const asyncOptions = useAsyncSelectOptions({
    queryKey,
    queryFn,
    getOption,
    selectedItems,
    debounceMs,
  })

  return (
    <MultiselectInput
      {...props}
      value={value}
      items={asyncOptions.items}
      searchable
      filterItems={false}
      isLoading={asyncOptions.isFetching}
      loadingMessage={loadingMessage}
      emptyMessage={asyncOptions.isError ? errorMessage : emptyMessage}
      onSearchChange={asyncOptions.setSearch}
      onValueChange={(nextValue) => {
        props.onValueChange(nextValue)
        onSelectedItemsChange?.(nextValue.flatMap((itemValue) => asyncOptions.dataByValue.get(itemValue) ?? []))
      }}
    />
  )
}

export { SelectInput, MultiselectInput, SelectInputAsync, MultiselectInputAsync }
export type {
  SelectInputItem,
  SelectInputItemInput,
  SelectInputProps,
  MultiselectInputProps,
  SelectInputAsyncProps,
  MultiselectInputAsyncProps,
}
