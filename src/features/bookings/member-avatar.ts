const avatarColors = [
  'bg-[#fbe6dc] text-[#97401e]',
  'bg-[#e5ecdf] text-[#405b38]',
  'bg-[#f0eaf6] text-[#72618d]',
  'bg-[#f5ecd5] text-[#806320]',
  'bg-[#e7eff1] text-[#55727c]',
]

export function memberAvatarColor(id: string) {
  let hash = 0
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

export function memberAvatarInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
}
