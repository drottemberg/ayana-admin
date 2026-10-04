import * as React from 'react'
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon'
import { HugeiconsIcon } from '@hugeicons/react'

import { TextInput } from '@/components/ui/text-input'
import type { TextInputProps } from '@/components/ui/text-input'
import { Button } from '@/components/ui/button'

type SearchInputProps = Omit<TextInputProps, 'type' | 'startIcon'> & {
  debounceMs?: number
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, defaultValue, onChange, debounceMs = 300, ...props }, ref) => {
    const [inputValue, setInputValue] = React.useState(value ?? defaultValue ?? '')
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const changeEventRef = React.useRef<React.ChangeEvent<HTMLInputElement> | null>(null)

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node

        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref],
    )

    React.useEffect(() => {
      if (value !== undefined) {
        setInputValue(value)
      }
    }, [value])

    React.useEffect(() => {
      if (!changeEventRef.current) {
        return
      }

      const timeoutId = window.setTimeout(() => {
        if (changeEventRef.current) {
          onChange?.(changeEventRef.current)
          changeEventRef.current = null
        }
      }, debounceMs)

      return () => window.clearTimeout(timeoutId)
    }, [debounceMs, inputValue, onChange])

    return (
      <TextInput
        ref={setRefs}
        type="text"
        startIcon="search"
        endAdornment={
          inputValue ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Clear search"
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                changeEventRef.current = null
                setInputValue('')
                onChange?.({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)
                inputRef.current?.focus()
              }}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          ) : null
        }
        value={inputValue}
        onChange={(event) => {
          changeEventRef.current = event
          setInputValue(event.target.value)
        }}
        {...props}
      />
    )
  },
)
SearchInput.displayName = 'SearchInput'

export { SearchInput }
export type { SearchInputProps }
