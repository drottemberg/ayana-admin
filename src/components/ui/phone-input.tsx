import * as React from 'react'

import { TextInput } from '@/components/ui/text-input'
import type { TextInputProps } from '@/components/ui/text-input'

const PHONE_ALLOWED_PATTERN = /^[+\d\s().-]*$/

type PhoneInputProps = Omit<TextInputProps, 'type' | 'inputMode' | 'autoComplete' | 'onChange'> & {
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(({ onChange, ...props }, ref) => {
  return (
    <TextInput
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      onChange={(event) => {
        if (!PHONE_ALLOWED_PATTERN.test(event.target.value)) return
        onChange?.(event)
      }}
      {...props}
    />
  )
})
PhoneInput.displayName = 'PhoneInput'

export { PhoneInput }
export type { PhoneInputProps }
