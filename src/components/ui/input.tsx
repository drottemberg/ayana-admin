import * as React from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'

import { cn } from '@/lib/utils'

const inputBaseClassName =
  'text-body h-9 w-full min-w-0 rounded-[10px] border border-input bg-white px-3.5 transition-[border-color,box-shadow,background-color,color] outline-none placeholder:text-muted-foreground/70 focus-visible:border-[var(--color-accent-500)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent-500)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/50 disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-0'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <InputPrimitive
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(inputBaseClassName, className)}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
export { Input, inputBaseClassName }
