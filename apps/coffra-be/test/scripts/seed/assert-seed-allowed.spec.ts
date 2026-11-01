import { describe, expect, it } from 'vitest'

import { assertSeedAllowed } from '../../../scripts/seed/assert-seed-allowed'

const URL_WITH_PASSWORD = 'postgresql://coffra:hunter2-secret@localhost:5439/coffra_dev?schema=public'

describe('assertSeedAllowed', () => {
  it.each(['development', 'test', undefined])(
    'lets the seed run with NODE_ENV %s and gives the database',
    (nodeEnv) => {
      expect(assertSeedAllowed({ NODE_ENV: nodeEnv, DATABASE_URL: URL_WITH_PASSWORD })).toBe(URL_WITH_PASSWORD)
    },
  )

  it('accepts the postgres:// spelling too', () => {
    expect(assertSeedAllowed({ DATABASE_URL: 'postgres://u:p@localhost/db' })).toBe('postgres://u:p@localhost/db')
  })

  it('refuses production, whatever the database', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'production', DATABASE_URL: URL_WITH_PASSWORD })).toThrow(
      'Refusing to seed: NODE_ENV is production.',
    )
  })

  it('refuses production before it looks at the database', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'production' })).toThrow('NODE_ENV is production')
  })

  it.each([
    [{}, 'DATABASE_URL: is not set.'],
    [{ DATABASE_URL: '' }, 'DATABASE_URL: is not set.'],
    [{ DATABASE_URL: 'mysql://u:hunter2-secret@localhost/db' }, 'DATABASE_URL: must be a postgres:// or postgresql://'],
    [{ DATABASE_URL: 'postgresql://' }, 'DATABASE_URL: must be a postgres:// or postgresql://'],
  ])('refuses the database %j', (env, message) => {
    expect(() => assertSeedAllowed(env)).toThrow(message)
  })

  it('never puts the value of DATABASE_URL in a message', () => {
    expect(() => assertSeedAllowed({ DATABASE_URL: 'mysql://u:hunter2-secret@localhost/db' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('hunter2-secret') as string }) as Error,
    )
  })
})
