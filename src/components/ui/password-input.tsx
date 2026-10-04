import * as React from 'react'

import { TextInput } from '@/components/ui/text-input'
import type { TextInputProps } from '@/components/ui/text-input'

type PasswordInputProps = Omit<TextInputProps, 'type' | 'endIcon' | 'endAdornment'>

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(({ className, ...props }, ref) => {
  const [isVisible, setIsVisible] = React.useState(false)

  return (
    <TextInput
      ref={ref}
      type={isVisible ? 'text' : 'password'}
      className={className}
      endAdornment={
        <button
          type="button"
          className="text-button cursor-pointer text-foreground"
          onClick={() => setIsVisible((prev) => !prev)}
          aria-label={isVisible ? 'Hide password' : 'Show password'}
        >
          {isVisible ? 'Hide' : 'Show'}
        </button>
      }
      {...props}
    />
  )
})
PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
export type { PasswordInputProps }
