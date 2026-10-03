import { describe, expect, it } from 'vitest'

import { validateEnv } from '../../../src/modules/config/env.validation'

const SECRET_A = 'a'.repeat(32)
const SECRET_B = 'b'.repeat(32)

const validEnv = (): Record<string, unknown> => ({
  DATABASE_URL: 'postgresql://coffra:coffra@localhost:5439/coffra_dev?schema=public',
  OIDC_ISSUER_URL: 'http://localhost:8080/realms/coffra',
  OIDC_CLIENT_ID: 'coffra-be',
  OIDC_CLIENT_SECRET: 'client-secret-value',
  OIDC_REDIRECT_URI: 'http://localhost:3000/api/auth/callback',
  JWT_ACCESS_SECRET: SECRET_A,
  JWT_REFRESH_SECRET: SECRET_B,
})

const errorMessage = (config: Record<string, unknown>): string => {
  try {
    validateEnv(config)
  } catch (error) {
    return (error as Error).message
  }
  return ''
}

describe('validateEnv', () => {
  it('accepts a valid env and fills defaults', () => {
    const env = validateEnv(validEnv())

    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(3000)
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900)
    expect(env.JWT_REFRESH_TTL_SECONDS).toBe(2_592_000)
  })

  it('converts numeric strings to numbers', () => {
    const env = validateEnv({ ...validEnv(), PORT: '4000', JWT_ACCESS_TTL_SECONDS: '60' })

    expect(env.PORT).toBe(4000)
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(60)
  })

  it.each([
    'DATABASE_URL',
    'OIDC_ISSUER_URL',
    'OIDC_CLIENT_ID',
    'OIDC_CLIENT_SECRET',
    'OIDC_REDIRECT_URI',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
  ])('throws naming %s when missing', (name) => {
    const config = Object.fromEntries(Object.entries(validEnv()).filter(([key]) => key !== name))

    expect(() => validateEnv(config)).toThrow(name)
  })

  it('throws on empty required string', () => {
    expect(() => validateEnv({ ...validEnv(), OIDC_CLIENT_ID: '' })).toThrow('OIDC_CLIENT_ID')
  })

  it.each(['abc', '0', '70000'])('throws on invalid PORT %s', (port) => {
    expect(() => validateEnv({ ...validEnv(), PORT: port })).toThrow('PORT')
  })

  it('throws on non-postgres DATABASE_URL', () => {
    expect(() => validateEnv({ ...validEnv(), DATABASE_URL: 'mysql://u:p@localhost/db' })).toThrow('DATABASE_URL')
  })

  it('throws on invalid NODE_ENV', () => {
    expect(() => validateEnv({ ...validEnv(), NODE_ENV: 'staging' })).toThrow('NODE_ENV')
  })

  it('throws on JWT secret shorter than 32 chars', () => {
    expect(() => validateEnv({ ...validEnv(), JWT_ACCESS_SECRET: 'short' })).toThrow('JWT_ACCESS_SECRET')
  })

  it('throws when access and refresh secrets are equal', () => {
    expect(() => validateEnv({ ...validEnv(), JWT_REFRESH_SECRET: SECRET_A })).toThrow(
      'JWT_REFRESH_SECRET: must differ from JWT_ACCESS_SECRET',
    )
  })

  it('throws on an http OIDC issuer in production', () => {
    expect(() => validateEnv({ ...validEnv(), NODE_ENV: 'production' })).toThrow(
      'OIDC_ISSUER_URL: must use https in production',
    )
  })

  it('accepts an https OIDC issuer in production and an http one in development', () => {
    expect(() =>
      validateEnv({ ...validEnv(), NODE_ENV: 'production', OIDC_ISSUER_URL: 'https://auth.example.com/realms/coffra' }),
    ).not.toThrow()
    expect(() => validateEnv({ ...validEnv(), NODE_ENV: 'development' })).not.toThrow()
  })

  it('does not leak secret values in the error', () => {
    const message = errorMessage({ ...validEnv(), PORT: 'abc', JWT_ACCESS_SECRET: 'short-leaky-secret' })

    expect(message).toContain('PORT')
    expect(message).not.toContain('short-leaky-secret')
  })
})
