import { describe, expect, it } from 'vitest'

import { validateEnv } from '../../../src/modules/config/env.validation'

const SECRET_A = 'a'.repeat(32)
const SECRET_B = 'b'.repeat(32)
const SECRET_C = 'c'.repeat(32)

const validEnv = (): Record<string, unknown> => ({
  DATABASE_URL: 'postgresql://coffra:coffra@localhost:5439/coffra_dev?schema=public',
  OIDC_ISSUER_URL: 'http://localhost:8080/realms/coffra',
  OIDC_CLIENT_ID: 'coffra-be',
  OIDC_CLIENT_SECRET: 'client-secret-value',
  OIDC_REDIRECT_URI: 'http://localhost:3000/api/auth/callback',
  JWT_ACCESS_SECRET: SECRET_A,
  JWT_REFRESH_SECRET: SECRET_B,
  AUTH_CHECKS_SECRET: SECRET_C,
  REDIS_URL: 'redis://localhost:6389',
})

const productionEnv = (): Record<string, unknown> => ({
  ...validEnv(),
  NODE_ENV: 'production',
  OIDC_ISSUER_URL: 'https://auth.example.com/realms/coffra',
  OIDC_REDIRECT_URI: 'https://coffra.example.com/api/auth/callback',
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
    'AUTH_CHECKS_SECRET',
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

  it('throws on a login checks secret shorter than 32 chars', () => {
    expect(() => validateEnv({ ...validEnv(), AUTH_CHECKS_SECRET: 'short' })).toThrow('AUTH_CHECKS_SECRET')
  })

  it('throws when the login checks secret equals the access secret', () => {
    expect(() => validateEnv({ ...validEnv(), AUTH_CHECKS_SECRET: SECRET_A })).toThrow(
      'AUTH_CHECKS_SECRET: must differ from JWT_ACCESS_SECRET',
    )
  })

  it('throws when the login checks secret equals the refresh secret', () => {
    expect(() => validateEnv({ ...validEnv(), AUTH_CHECKS_SECRET: SECRET_B })).toThrow(
      'AUTH_CHECKS_SECRET: must differ from JWT_REFRESH_SECRET',
    )
  })

  it('throws on an http OIDC issuer in production', () => {
    expect(() => validateEnv({ ...productionEnv(), OIDC_ISSUER_URL: 'http://localhost:8080/realms/coffra' })).toThrow(
      'OIDC_ISSUER_URL: must use https in production',
    )
  })

  it('throws on an http OIDC redirect URI in production', () => {
    expect(() =>
      validateEnv({ ...productionEnv(), OIDC_REDIRECT_URI: 'http://localhost:3000/api/auth/callback' }),
    ).toThrow('OIDC_REDIRECT_URI: must use https in production')
  })

  it('accepts https OIDC URLs in production and http ones in development', () => {
    expect(() => validateEnv(productionEnv())).not.toThrow()
    expect(() => validateEnv({ ...validEnv(), NODE_ENV: 'development' })).not.toThrow()
  })

  it('does not leak secret values in the error', () => {
    const message = errorMessage({ ...validEnv(), PORT: 'abc', JWT_ACCESS_SECRET: 'short-leaky-secret' })

    expect(message).toContain('PORT')
    expect(message).not.toContain('short-leaky-secret')
  })
})

describe('validateEnv: HTTP hardening', () => {
  it('has the safe defaults when nothing is set: no CORS, no proxy, a limit of 120 and 10 per minute', () => {
    const env = validateEnv(validEnv())

    expect(env.CORS_ORIGINS).toStrictEqual([])
    expect(env.TRUST_PROXY_HOPS).toBe(0)
    expect(env.RATE_LIMIT_TTL_SECONDS).toBe(60)
    expect(env.RATE_LIMIT_MAX).toBe(120)
    expect(env.RATE_LIMIT_AUTH_MAX).toBe(10)
  })

  it('converts the numeric strings of the environment', () => {
    const env = validateEnv({
      ...validEnv(),
      TRUST_PROXY_HOPS: '2',
      RATE_LIMIT_TTL_SECONDS: '30',
      RATE_LIMIT_MAX: '500',
      RATE_LIMIT_AUTH_MAX: '5',
    })

    expect(env.TRUST_PROXY_HOPS).toBe(2)
    expect(env.RATE_LIMIT_TTL_SECONDS).toBe(30)
    expect(env.RATE_LIMIT_MAX).toBe(500)
    expect(env.RATE_LIMIT_AUTH_MAX).toBe(5)
  })

  describe('CORS_ORIGINS', () => {
    it.each([
      ['an empty value (a bare `CORS_ORIGINS=` in .env)', '', []],
      ['only commas and spaces', ' , ,', []],
      ['one https origin', 'https://app.example.com', ['https://app.example.com']],
      ['one origin with a port', 'http://localhost:5173', ['http://localhost:5173']],
      [
        'two origins, spaces around the comma',
        'https://app.example.com, http://localhost:5173 ',
        ['https://app.example.com', 'http://localhost:5173'],
      ],
      [
        'an empty entry between two',
        'https://a.example.com,,https://b.example.com',
        ['https://a.example.com', 'https://b.example.com'],
      ],
    ])('accepts %s', (_name, value, expected) => {
      expect(validateEnv({ ...validEnv(), CORS_ORIGINS: value }).CORS_ORIGINS).toStrictEqual(expected)
    })

    it.each([
      ['a wildcard', '*'],
      ['the opaque origin', 'null'],
      ['a host without a scheme', 'app.example.com'],
      ['a trailing slash', 'https://app.example.com/'],
      ['a path', 'https://app.example.com/app'],
      ['a host in upper case', 'https://APP.example.com'],
      ['the default port of https', 'https://app.example.com:443'],
      ['the default port of http', 'http://localhost:80'],
      ['another scheme', 'ftp://app.example.com'],
      ['a query', 'https://app.example.com?x=1'],
      ['one bad entry among good ones', 'https://app.example.com,*'],
    ])('refuses %s', (_name, value) => {
      expect(() => validateEnv({ ...validEnv(), CORS_ORIGINS: value })).toThrow(
        /CORS_ORIGINS: entry \d+ must be an origin/,
      )
    })

    it('says which entry is wrong, and never what it said', () => {
      const message = errorMessage({
        ...validEnv(),
        CORS_ORIGINS: 'https://app.example.com,https://secret-host.example.com/',
      })

      expect(message).toContain('CORS_ORIGINS: entry 2')
      expect(message).not.toContain('secret-host')
    })
  })

  describe('REDIS_URL', () => {
    it.each([
      ['left out', undefined],
      ['empty (a bare `REDIS_URL=` in .env)', ''],
    ])('is required: refuses it %s', (_name, value) => {
      const { REDIS_URL: _present, ...without } = validEnv()

      expect(errorMessage(value === undefined ? without : { ...without, REDIS_URL: value })).toContain(
        'REDIS_URL must be a redis:// or rediss:// connection string',
      )
    })

    it.each([
      'redis://localhost:6389',
      'redis://:password@redis.internal:6379/2',
      'rediss://user:password@redis.example.com:6380',
    ])('accepts %s', (value) => {
      expect(validateEnv({ ...validEnv(), REDIS_URL: value }).REDIS_URL).toBe(value)
    })

    it.each([
      ['no scheme', ':hunter2@localhost:6379'],
      ['another scheme', 'http://:hunter2@localhost:6379'],
      ['a scheme without the slashes', 'redis:hunter2@localhost'],
      ['only the scheme', 'redis://'],
    ])('refuses %s, and does not repeat the value, which can hold a password', (_name, value) => {
      const message = errorMessage({ ...validEnv(), REDIS_URL: value })

      expect(message).toContain('REDIS_URL must be a redis:// or rediss:// connection string')
      expect(message).not.toContain('hunter2')
    })
  })

  describe('TRUST_PROXY_HOPS', () => {
    it.each(['0', '1', '10'])('accepts %s', (value) => {
      expect(validateEnv({ ...validEnv(), TRUST_PROXY_HOPS: value }).TRUST_PROXY_HOPS).toBe(Number(value))
    })

    it.each([
      ['below zero', '-1'],
      ['above ten', '11'],
      ['a fraction', '1.5'],
      ['text', 'abc'],
      ['`true`, which would trust any X-Forwarded-For', 'true'],
    ])('refuses %s', (_name, value) => {
      expect(errorMessage({ ...validEnv(), TRUST_PROXY_HOPS: value })).toContain('TRUST_PROXY_HOPS')
    })
  })

  describe.each(['RATE_LIMIT_TTL_SECONDS', 'RATE_LIMIT_MAX', 'RATE_LIMIT_AUTH_MAX'])('%s', (name) => {
    it('accepts a whole number from 1', () => {
      expect(() => validateEnv({ ...validEnv(), [name]: '1' })).not.toThrow()
    })

    it.each([
      ['zero', '0'],
      ['below zero', '-5'],
      ['a fraction', '1.5'],
      ['text', 'many'],
    ])('refuses %s', (_case, value) => {
      expect(errorMessage({ ...validEnv(), [name]: value })).toContain(name)
    })
  })
})

describe('validateEnv: SWAGGER_ENABLED', () => {
  it.each([
    ['development', true],
    ['test', true],
    ['production', false],
  ])('is %s by default: %s', (nodeEnv, expected) => {
    const env = nodeEnv === 'production' ? productionEnv() : { ...validEnv(), NODE_ENV: nodeEnv }

    expect(validateEnv(env).SWAGGER_ENABLED).toBe(expected)
  })

  it('counts an empty value (a bare `SWAGGER_ENABLED=` in .env) as not set', () => {
    expect(validateEnv({ ...productionEnv(), SWAGGER_ENABLED: '' }).SWAGGER_ENABLED).toBe(false)
    expect(validateEnv({ ...validEnv(), SWAGGER_ENABLED: '' }).SWAGGER_ENABLED).toBe(true)
  })

  it('turns it on in production when asked to, and off in development', () => {
    expect(validateEnv({ ...productionEnv(), SWAGGER_ENABLED: 'true' }).SWAGGER_ENABLED).toBe(true)
    expect(validateEnv({ ...validEnv(), SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED).toBe(false)
  })

  it.each(['yes', '1', 'TRUE', 'on'])('refuses %s: only true and false', (value) => {
    expect(errorMessage({ ...validEnv(), SWAGGER_ENABLED: value })).toContain('SWAGGER_ENABLED must be true or false')
  })
})
