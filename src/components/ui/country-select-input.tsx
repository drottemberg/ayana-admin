import * as React from 'react'

import { SelectInput, type SelectInputProps } from '@/components/ui/select-input'
import * as GeoUtils from '@/utils/geo-utils'

type CountrySelectInputProps = Omit<SelectInputProps, 'items' | 'onValueChange'> & {
  locale?: string
  onValueChange?: (value: string) => void
}

const CountrySelectInput = React.forwardRef<HTMLInputElement, CountrySelectInputProps>(
  ({ locale, onValueChange, ...props }, ref) => {
    const items = React.useMemo(() => {
      return GeoUtils.getCountries({ locale }).map((country) => ({
        value: country.value,
        label: country.label,
      }))
    }, [locale])

    return (
      <SelectInput
        ref={ref}
        searchable
        items={items}
        onValueChange={(value) => onValueChange?.(String(value).toUpperCase())}
        {...props}
      />
    )
  },
)
CountrySelectInput.displayName = 'CountrySelectInput'

export { CountrySelectInput }
export type { CountrySelectInputProps }
