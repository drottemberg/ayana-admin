export const ObjectType = {
  USER: 'USER',
  ORGANIZATION: 'ORGANIZATION',
  DEVICE: 'DEVICE',
  CONTRACT: 'CONTRACT',
} as const

export type ObjectType = (typeof ObjectType)[keyof typeof ObjectType]
