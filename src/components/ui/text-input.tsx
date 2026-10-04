import * as React from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'
import { HugeiconsIcon } from '@hugeicons/react'
import LayoutGridIcon from '@hugeicons/core-free-icons/LayoutGridIcon'
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon'

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { inputBaseClassName } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

type BuiltInInputIcon = 'search' | 'grid'

type TextInputProps = React.ComponentProps<'input'> & {
  label?: React.ReactNode
  labelAction?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  containerClassName?: string
  labelClassName?: string
  hintClassName?: string
  errorClassName?: string
  startIcon?: BuiltInInputIcon
  endIcon?: BuiltInInputIcon
  endAdornment?: React.ReactNode
  isLoading?: boolean
}

function IconGlyph({ icon, className }: { icon: BuiltInInputIcon; className?: string }) {
  const glyph = icon === 'grid' ? LayoutGridIcon : Search01Icon

  return (
    <HugeiconsIcon icon={glyph} size={18} strokeWidth={1.8} className={cn('text-muted-foreground/80', className)} />
  )
}

const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      className,
      type,
      label,
      labelAction,
      hint,
      error,
      containerClassName,
      labelClassName,
      hintClassName,
      errorClassName,
      startIcon,
      endIcon,
      endAdornment,
      id,
      required,
      isLoading,
      ...props
    },
    ref,
  ) => {
    const fieldId = React.useId()
    const inputId = id ?? (typeof props.name === 'string' && props.name.length > 0 ? props.name : fieldId)
    const isInvalid = Boolean(error) || props['aria-invalid'] === true || props['aria-invalid'] === 'true'
    const resolvedStartIcon = startIcon ?? (type === 'search' ? 'search' : undefined)

    return (
      <Field data-slot="input-field" data-invalid={isInvalid} className={containerClassName}>
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

        <div className="relative">
          {resolvedStartIcon && (
            <IconGlyph
              icon={resolvedStartIcon}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
          )}
          <InputPrimitive
            ref={ref}
            id={inputId}
            type={type}
            data-slot="input"
            aria-invalid={isInvalid || undefined}
            className={cn(
              inputBaseClassName,
              resolvedStartIcon && 'pl-10',
              endAdornment ? 'pr-18' : endIcon && 'pr-10',
              className,
            )}
            required={required}
            {...props}
          />
          {isLoading ? (
            <div className="absolute top-1/2 right-3 -translate-y-1/2">
              <Spinner />
            </div>
          ) : endAdornment ? (
            <div className="absolute top-1/2 right-3 -translate-y-1/2">{endAdornment}</div>
          ) : endIcon ? (
            <IconGlyph icon={endIcon} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" />
          ) : null}
        </div>

        {error ? (
          <FieldError className={errorClassName}>{error}</FieldError>
        ) : hint ? (
          <FieldDescription className={hintClassName}>{hint}</FieldDescription>
        ) : null}
      </Field>
    )
  },
)
TextInput.displayName = 'TextInput'

export { TextInput }
export type { TextInputProps, BuiltInInputIcon }
