'use client'

import * as React from 'react'
import Calendar04Icon from '@hugeicons/core-free-icons/Calendar04Icon'
import { HugeiconsIcon } from '@hugeicons/react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type DatePickerChangeEvent = {
  type: 'change'
  target: {
    name?: string
    value: string
  }
  currentTarget: {
    name?: string
    value: string
  }
}

type DatePickerBlurEvent = {
  type: 'blur'
  target: {
    name?: string
  }
  currentTarget: {
    name?: string
  }
}

type DatePickerProps = {
  label?: React.ReactNode
  labelAction?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  placeholder?: React.ReactNode
  container?: React.ComponentProps<typeof PopoverContent>['container']
  containerClassName?: string
  labelClassName?: string
  hintClassName?: string
  errorClassName?: string
  className?: string
  id?: string
  name?: string
  value?: string
  defaultValue?: string
  required?: boolean
  disabled?: boolean
  'aria-invalid'?: boolean | 'true' | 'false'
  onValueChange?: (value: string) => void
  onChange?: (event: DatePickerChangeEvent) => void
  onBlur?: (event: DatePickerBlurEvent) => void
}

function formatDateValue(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function parseDateValue(value?: string) {
  if (!value) return undefined

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      label,
      labelAction,
      hint,
      error,
      placeholder = 'Pick a date',
      container,
      containerClassName,
      labelClassName,
      hintClassName,
      errorClassName,
      className,
      id,
      value,
      defaultValue = '',
      required,
      disabled,
      onValueChange,
      onChange,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const fieldId = React.useId()
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const contentRef = React.useRef<HTMLDivElement | null>(null)
    const inputId = id ?? (typeof props.name === 'string' && props.name.length > 0 ? props.name : fieldId)
    const name = props.name
    const isInvalid = Boolean(error) || props['aria-invalid'] === true || props['aria-invalid'] === 'true'
    const isControlled = value !== undefined
    const [internalValue, setInternalValue] = React.useState(defaultValue)
    const currentValue = isControlled ? value : internalValue
    const date = parseDateValue(currentValue)
    const [open, setOpen] = React.useState(false)
    const [autoContainer, setAutoContainer] = React.useState<HTMLElement | null>(null)

    React.useLayoutEffect(() => {
      if (container) return

      const node = contentRef.current
      setAutoContainer(
        node?.closest('[data-slot="dialog-content"], [data-slot="drawer-content"]') as HTMLElement | null,
      )
    }, [container])

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const handleChange = (nextDate?: Date) => {
      const nextValue = nextDate ? formatDateValue(nextDate) : ''

      if (!isControlled) {
        setInternalValue(nextValue)
      }

      if (inputRef.current) {
        inputRef.current.value = nextValue
      }

      onValueChange?.(nextValue)
      onChange?.({
        type: 'change',
        target: { name, value: nextValue },
        currentTarget: { name, value: nextValue },
      })
    }

    return (
      <Field data-slot="date-picker-field" data-invalid={isInvalid} className={containerClassName} ref={contentRef}>
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

        <input ref={inputRef} id={inputId} name={name} value={currentValue} readOnly required={required} hidden />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                data-empty={!date}
                disabled={disabled}
                aria-invalid={isInvalid || undefined}
                className={cn(
                  'h-9 w-full justify-between rounded-[10px] bg-white px-3.5 text-left font-normal focus-visible:border-[var(--color-accent-500)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent-500)] aria-invalid:border-destructive aria-invalid:ring-0 data-[empty=true]:text-muted-foreground',
                  open && !isInvalid && 'border-[var(--color-accent-500)] ring-2 ring-[var(--color-accent-500)]',
                  className,
                )}
              >
                {date ? format(date, 'PPP') : <span>{placeholder}</span>}
                <HugeiconsIcon icon={Calendar04Icon} strokeWidth={2} />
              </Button>
            }
          />
          <PopoverContent className="w-auto p-0" align="start" container={container ?? autoContainer}>
            <Calendar mode="single" selected={date} onSelect={handleChange} defaultMonth={date} />
          </PopoverContent>
        </Popover>

        {error ? (
          <FieldError className={errorClassName}>{error}</FieldError>
        ) : hint ? (
          <FieldDescription className={hintClassName}>{hint}</FieldDescription>
        ) : null}
      </Field>
    )
  },
)
DatePicker.displayName = 'DatePicker'

export { DatePicker }
export type { DatePickerProps }
