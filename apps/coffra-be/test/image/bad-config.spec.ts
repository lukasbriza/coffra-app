import { describe, expect, it } from 'vitest'

import { runOnce } from './support/container'
import { containerDatabaseUrl, imageDatabase, productionEnvironment, SECRETS } from './support/environment'

// The control is `starts.spec.ts`: the same environment without the defect starts and is healthy.
describe('starting the image with a configuration that is wrong', () => {
  const environment = productionEnvironment(containerDatabaseUrl(imageDatabase()))

  it.each([
    {
      name: 'a missing secret',
      env: Object.fromEntries(Object.entries(environment).filter(([name]) => name !== 'JWT_ACCESS_SECRET')),
      reason: 'JWT_ACCESS_SECRET',
    },
    {
      name: 'two secrets that are the same',
      env: { ...environment, JWT_REFRESH_SECRET: SECRETS.JWT_ACCESS_SECRET },
      reason: 'JWT_REFRESH_SECRET: must differ from JWT_ACCESS_SECRET',
    },
    {
      name: 'an identity provider on plain http',
      // `localhost`: the linter rewrites any other `http://` address to `https://`, which would drop the defect
      env: { ...environment, OIDC_ISSUER_URL: 'http://localhost:8080/realms/coffra' },
      reason: 'OIDC_ISSUER_URL: must use https in production',
    },
    {
      name: 'a database url that is not Postgres',
      env: { ...environment, DATABASE_URL: 'mysql://root@db.example.test/coffra' },
      reason: 'DATABASE_URL must be a postgres:// or postgresql:// connection string',
    },
  ])('refuses $name and says why, without a secret in the log', async ({ env, reason }) => {
    const result = await runOnce({ environment: env })

    expect(result.code).not.toBe(0)
    expect(result.output).toContain('Invalid environment configuration')
    expect(result.output).toContain(reason)

    for (const secret of Object.values(SECRETS)) {
      expect(result.output).not.toContain(secret)
    }
  })
})
