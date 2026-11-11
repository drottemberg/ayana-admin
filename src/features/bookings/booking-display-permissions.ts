import type { CustomerRole } from '@/types/membership'
import type { StaffRole } from '@/types/membership'

type BookingViewer = {
  staffRole?: StaffRole | null
  customerMemberships?: Array<{ customerId: string; role: CustomerRole }>
}

export function canViewBookingContractDetails(
  viewer: BookingViewer | undefined,
  appMode: 'admin' | 'customer',
  customerId?: string | null,
) {
  if (appMode === 'admin') return viewer?.staffRole === 'ADMIN' || viewer?.staffRole === 'SUPER_ADMIN'
  if (!customerId) return false
  const role = viewer?.customerMemberships?.find((membership) => membership.customerId === customerId)?.role
  return role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER'
}
