import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'

export function ClassSessionDateTimeField({
  label,
  value,
  onValueChange,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
}) {
  const [date = '', time = ''] = value.split('T')
  const update = (nextDate: string, nextTime: string) => {
    onValueChange(nextDate && nextTime ? `${nextDate}T${nextTime}` : '')
  }

  return <div className="grid gap-1.5">
    <span className="text-sm font-medium">{label}</span>
    <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-2">
      <DatePicker
        value={date}
        placeholder="Choose date"
        onValueChange={(nextDate) => update(nextDate, time || '09:00')}
      />
      <Input
        aria-label={`${label} time`}
        required
        type="time"
        value={time}
        onChange={(event) => update(date, event.target.value)}
      />
    </div>
  </div>
}
