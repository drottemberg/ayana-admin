import { saveSelectedOrgId } from '@/features/organizations/storage'
import { OrganizationEntity, type OrganizationDto, type OrganizationShortDto } from '@/lib/entities/organization.entity'
import { UserEntity, type UserDto } from '@/lib/entities/user.entity'
import type { Feature, FeatureFlags } from '@/types/feature'

// Mirrors gkManager-backend's PermissionResolver.EntityPermissions — "what can I do on the
// Customers/Users screens," one map per portal, not a new authorization layer, just exposing
// the same per-entity rules the backend already enforces so the frontend knows what to render.
export type EntityPermissions = {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
  archive: boolean
}

export type AppPermissions = {
  customers?: EntityPermissions
  users?: EntityPermissions
  organization?: { editSelf: boolean }
}

export type AppConnectDto = {
  self?: UserDto | null
  user?: UserDto | null
  orgId?: string | null
  organizations?: Record<string, OrganizationShortDto> | null
  organization?: OrganizationDto | null
  features?: FeatureFlags
  permissions?: AppPermissions
}

export class AppConnectEntity {
  readonly dto: AppConnectDto
  readonly user: UserEntity
  readonly orgId: string | null
  readonly organizationsById: Map<string, OrganizationEntity>
  readonly organization: OrganizationEntity | null
  readonly features: FeatureFlags
  readonly permissions: AppPermissions

  constructor(dto: AppConnectDto = {}) {
    this.dto = dto
    this.user = new UserEntity(dto.user ?? dto.self ?? {})
    this.orgId = dto.orgId ?? null
    this.organizationsById = new Map(
      Object.entries(dto.organizations ?? {}).map(([id, organization]) => [
        id,
        new OrganizationEntity({ id, ...organization }),
      ]),
    )
    this.organization = dto.organization ? new OrganizationEntity(dto.organization) : null
    this.features = dto.features ?? {}
    this.permissions = dto.permissions ?? {}
  }

  can(entity: 'customers' | 'users', action: keyof EntityPermissions): boolean {
    return this.permissions[entity]?.[action] ?? false
  }

  get organizations(): OrganizationEntity[] {
    return Array.from(this.organizationsById.values())
  }

  get currentOrganization(): OrganizationEntity | null {
    return this.organization ?? (this.orgId ? (this.organizationsById.get(this.orgId) ?? null) : null)
  }

  getOrganization(organizationId: string): OrganizationEntity | null {
    return this.organizationsById.get(organizationId) ?? null
  }

  hasFeature(feature: Feature): boolean {
    return this.features[feature] ?? false
  }

  syncSelectedOrganization(): void {
    saveSelectedOrgId(this.orgId)
  }

  toJSON(): AppConnectDto {
    return { ...this.dto }
  }
}
