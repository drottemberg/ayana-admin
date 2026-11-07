import ISO6391 from 'iso-639-1'

import { MultiselectInput } from '@/components/ui/select-input'

const languageFlags: Record<string, string> = {
  ar: '🇸🇦', bg: '🇧🇬', bn: '🇧🇩', ca: '🏴', cs: '🇨🇿', da: '🇩🇰', de: '🇩🇪', el: '🇬🇷', en: '🇬🇧',
  es: '🇪🇸', et: '🇪🇪', fa: '🇮🇷', fi: '🇫🇮', fr: '🇫🇷', he: '🇮🇱', hi: '🇮🇳', hr: '🇭🇷', hu: '🇭🇺',
  id: '🇮🇩', it: '🇮🇹', ja: '🇯🇵', ko: '🇰🇷', lt: '🇱🇹', lv: '🇱🇻', ms: '🇲🇾', nl: '🇳🇱', no: '🇳🇴',
  pl: '🇵🇱', pt: '🇵🇹', ro: '🇷🇴', ru: '🇷🇺', sk: '🇸🇰', sl: '🇸🇮', sr: '🇷🇸', sv: '🇸🇪', sw: '🇹🇿',
  ta: '🇱🇰', th: '🇹🇭', tr: '🇹🇷', uk: '🇺🇦', ur: '🇵🇰', vi: '🇻🇳', zh: '🇨🇳',
}

const languageItems = ISO6391.getAllCodes().map((code) => ({
  value: code,
  label: `${languageFlags[code] ?? '🌐'} ${ISO6391.getName(code)}${ISO6391.getNativeName(code) !== ISO6391.getName(code) ? ` (${ISO6391.getNativeName(code)})` : ''}`,
}))

export function normalizeCoachLanguages(values: string[] | null | undefined): string[] {
  return [...new Set((values ?? []).flatMap((value) => {
    const normalized = value.trim()
    if (ISO6391.validate(normalized)) return [normalized.toLowerCase()]
    const code = ISO6391.getCode(normalized)
    return code ? [code] : []
  }))]
}

export function coachLanguageLabel(value: string): string {
  const code = normalizeCoachLanguages([value])[0]
  if (!code) return value
  return `${languageFlags[code] ?? '🌐'} ${ISO6391.getName(code)}`
}

export function CoachLanguagesInput({ value, onValueChange }: { value: string[]; onValueChange: (value: string[]) => void }) {
  return <MultiselectInput
    aria-label="Teaching language"
    items={languageItems}
    value={normalizeCoachLanguages(value)}
    onValueChange={(next) => onValueChange(normalizeCoachLanguages(next))}
    placeholder="Select languages"
    emptyMessage="No matching language."
  />
}
