import 'reflect-metadata'

import { getMetadataStorage } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { EXPORT_ENV } from '../../../scripts/openapi/constants'
import { Env, NodeEnv, validateEnv } from '../../../src/modules/config/env.validation'

describe('EXPORT_ENV', () => {
  it('has every variable of the app, the optional ones too, and nothing else', () => {
    const variables = getMetadataStorage()
      .getTargetValidationMetadatas(Env, '', true, false)
      .map(({ propertyName }) => propertyName)

    expect(Object.keys(EXPORT_ENV).toSorted()).toStrictEqual([...new Set(variables)].toSorted())
  })

  it('is a valid environment on its own: production, without the Swagger UI', () => {
    const env = validateEnv({ ...EXPORT_ENV })

    expect(env.NODE_ENV).toBe(NodeEnv.Production)
    expect(env.SWAGGER_ENABLED).toBe(false)
  })

  it('points at nothing real', () => {
    for (const name of ['OIDC_ISSUER_URL', 'OIDC_REDIRECT_URI'] as const) {
      expect(new URL(EXPORT_ENV[name]).hostname.endsWith('.invalid')).toBe(true)
    }

    for (const name of ['DATABASE_URL', 'REDIS_URL'] as const) {
      expect(new URL(EXPORT_ENV[name])).toMatchObject({ hostname: '127.0.0.1', port: '1' })
    }
  })
})
