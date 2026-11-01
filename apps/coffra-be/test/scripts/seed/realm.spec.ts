import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { DEMO_USER } from '../../../scripts/seed/constants'

/** The part of the realm export the spec reads. */
type Realm = { users: { id: string; username: string; email: string }[] }

const REALM_FILE = path.join(__dirname, '..', '..', '..', 'docker', 'keycloak', 'coffra-realm.json')

describe('the demo user', () => {
  const { users } = JSON.parse(readFileSync(REALM_FILE, 'utf8')) as Realm

  it('is the user of the dev realm, so the first login finds the seeded data', () => {
    const realmUser = users.find(({ email }) => email === DEMO_USER.email)

    expect(realmUser, `no user ${DEMO_USER.email} in the realm`).toBeDefined()
    expect(realmUser?.id).toBe(DEMO_USER.subject)
    expect(realmUser?.username).toBe(DEMO_USER.email)
  })
})
