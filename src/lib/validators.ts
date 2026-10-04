import { z } from 'zod'

export const MIN_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_LENGTH = 32

export const PASSWORD_RULES = [
  {
    label: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    shortLabel: `at least ${MIN_PASSWORD_LENGTH} characters long`,
    regex: new RegExp(`.{${MIN_PASSWORD_LENGTH},}`),
  },
  {
    label: 'Password must include at least one number.',
    shortLabel: 'at least one number',
    regex: /\d/,
  },
  {
    label: 'Password must include at least one special character.',
    shortLabel: 'one special character',
    regex: /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/,
  },
  {
    label: 'Password must include at least one capital letter.',
    shortLabel: 'one capital letter',
    regex: /[A-Z]/,
  },
] as const

type PasswordValidatorOptions = {
  optional?: boolean
  requiredMessage?: string
}

export function createPasswordValidator(options?: PasswordValidatorOptions & { optional?: false }): z.ZodString
export function createPasswordValidator(
  options: PasswordValidatorOptions & { optional: true },
): z.ZodUnion<[z.ZodString, z.ZodLiteral<''>, z.ZodUndefined]>
export function createPasswordValidator(options: PasswordValidatorOptions = {}) {
  const { optional = false, requiredMessage = 'Password is required.' } = options
  const passwordSchema = PASSWORD_RULES.reduce(
    (schema, rule) => schema.regex(rule.regex, rule.label),
    z.string().min(1, requiredMessage),
  )

  if (!optional) return passwordSchema

  return z.union([passwordSchema, z.literal(''), z.undefined()])
}
