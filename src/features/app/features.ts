import { Feature, type Feature as FeatureType } from '@/types/feature'

type FeatureRoute = {
  pathPrefix: string
  feature: FeatureType
}

export type FeatureNavItem = {
  feature?: FeatureType
}

const routeFeatures: FeatureRoute[] = [
  { pathPrefix: '/ai-planogram', feature: Feature.PLANOGRAMS },
  { pathPrefix: '/command-logs', feature: Feature.LOGS },
  { pathPrefix: '/contracts', feature: Feature.CONTRACTS },
  { pathPrefix: '/customers', feature: Feature.CUSTOMERS },
  { pathPrefix: '/devices', feature: Feature.DEVICES },
  { pathPrefix: '/issues', feature: Feature.ISSUES },
  { pathPrefix: '/agent-support-issues', feature: Feature.ISSUES },
  { pathPrefix: '/media', feature: Feature.MEDIA },
  { pathPrefix: '/products', feature: Feature.PRODUCTS },
  { pathPrefix: '/pricing-options', feature: Feature.PRICING_OPTIONS },
  { pathPrefix: '/classes', feature: Feature.CLASSES },
  { pathPrefix: '/class-sessions', feature: Feature.CLASS_SESSIONS },
  { pathPrefix: '/bookings', feature: Feature.BOOKINGS },
  { pathPrefix: '/client-contracts', feature: Feature.CLIENT_CONTRACTS },
  { pathPrefix: '/credit-transactions', feature: Feature.CREDIT_TRANSACTIONS },
  { pathPrefix: '/messages', feature: Feature.MESSAGES },
  { pathPrefix: '/orders', feature: Feature.ORDERS },
  { pathPrefix: '/orders/kitchen', feature: Feature.ORDERS },
  { pathPrefix: '/locations', feature: Feature.LOCATIONS },
  { pathPrefix: '/users', feature: Feature.USERS },
  { pathPrefix: '/invites', feature: Feature.INVITATIONS },
  { pathPrefix: '/data', feature: Feature.DATA },
  { pathPrefix: '/reports', feature: Feature.REPORTS },
  { pathPrefix: '/device-type-groups', feature: Feature.DEVICE_TYPE },
  { pathPrefix: '/device-types', feature: Feature.DEVICE_TYPE },
  { pathPrefix: '/llm-configs', feature: Feature.LLM_CONFIG },
].sort((a, b) => b.pathPrefix.length - a.pathPrefix.length)

export function getRequiredFeature(pathname: string): FeatureType | null {
  const routeFeature = routeFeatures.find(
    ({ pathPrefix }) => pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`),
  )

  return routeFeature?.feature ?? null
}

export function canUseFeature(item: FeatureNavItem, hasFeature: (feature: FeatureType) => boolean): boolean {
  return item.feature == null || hasFeature(item.feature)
}
