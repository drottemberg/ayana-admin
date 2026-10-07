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
  { pathPrefix: '/pricing-options', feature: Feature.CUSTOMERS },
  { pathPrefix: '/classes', feature: Feature.CUSTOMERS },
  { pathPrefix: '/class-sessions', feature: Feature.CUSTOMERS },
  { pathPrefix: '/client-contracts', feature: Feature.CUSTOMERS },
  { pathPrefix: '/orders', feature: Feature.ORDERS },
  { pathPrefix: '/orders/kitchen', feature: Feature.ORDERS },
  { pathPrefix: '/locations', feature: Feature.LOCATIONS },
  { pathPrefix: '/users', feature: Feature.USERS },
  { pathPrefix: '/data', feature: Feature.DATA },
  { pathPrefix: '/device-type-groups', feature: Feature.DEVICE_TYPE },
  { pathPrefix: '/device-types', feature: Feature.DEVICE_TYPE },
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
