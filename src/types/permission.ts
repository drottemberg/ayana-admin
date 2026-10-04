export const Permission = {
  USER: 'USER',
  ORGANIZATION: 'ORGANIZATION',
  DEVICE: 'DEVICE',
  CONTRACT: 'CONTRACT',
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]
