import { OrganizationType } from '@/types/organization'
import type { OrganizationPermissionNode } from '@/features/users/components/user-drawer-steps/organization-permissions'

export const mockOrganizationPermissionTree: OrganizationPermissionNode = {
  id: 'mock-root',
  name: 'All organizations',
  type: OrganizationType.MASTER,
  children: [
    {
      id: 'customer-north',
      name: 'North Retail Group',
      type: OrganizationType.CUSTOMER,
      children: [
        {
          id: 'store-north-kyiv',
          name: 'Kyiv Central Store',
          type: OrganizationType.STORE,
          parentId: 'customer-north',
          children: [],
        },
        {
          id: 'store-north-lviv',
          name: 'Lviv Market Store',
          type: OrganizationType.STORE,
          parentId: 'customer-north',
          children: [],
        },
      ],
    },
    {
      id: 'customer-south',
      name: 'South Operations',
      type: OrganizationType.CUSTOMER,
      children: [
        {
          id: 'store-south-odesa',
          name: 'Odesa Harbor Store',
          type: OrganizationType.STORE,
          parentId: 'customer-south',
          children: [],
        },
        {
          id: 'store-south-dnipro',
          name: 'Dnipro East Store',
          type: OrganizationType.STORE,
          parentId: 'customer-south',
          children: [],
        },
      ],
    },
  ],
}
