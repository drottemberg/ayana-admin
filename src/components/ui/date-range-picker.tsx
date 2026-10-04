import Calendar03Icon from '@hugeicons/core-free-icons/Calendar03Icon'
import { HugeiconsIcon } from '@hugeicons/react'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type DateRangeValue = {
  from?: string
  to?: string
}

type DateRangePickerProps = {
  value?: DateRangeValue
  placeholder?: string
  className?: string
  disabled?: boolean
  onValueChange?: (value: DateRangeValue | undefined) => void
}

function toDateRange(value?: DateRangeValue): DateRange | undefined {
  if (!value?.from) return undefined
  return {
    from: new Date(`${value.from}T00:00:00`),
    to: value.to ? new Date(`${value.to}T00:00:00`) : undefined,
  }
}

function fromDateRange(range?: DateRange): DateRangeValue | undefined {
  if (!range?.from) return undefined
  return {
    from: format(range.from, 'yyyy-MM-dd'),
    to: range.to ? format(range.to, 'yyyy-MM-dd') : undefined,
  }
}

export function DateRangePicker({
  value,
  placeholder = 'Pick a range',
  className,
  disabled,
  onValueChange,
}: DateRangePickerProps) {
  const range = toDateRange(value)
  const hasValue = Boolean(value?.from)

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            disabled={disabled}
            data-active={hasValue}
            className={cn(
              'h-9 justify-start px-2.5 data-[active=true]:border-foreground',
              className,
            )}
          >
            <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
            {range?.from ? (
              range.to ? (
                <>
                  {format(range.from, 'LLL dd, y')} – {format(range.to, 'LLL dd, y')}
                </>
              ) : (
                format(range.from, 'LLL dd, y')
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={range?.from}
          selected={range}
          onSelect={(next) => onValueChange?.(fromDateRange(next))}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}
