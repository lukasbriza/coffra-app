import { describe, expect, it } from 'vitest'

import { ownedRows } from '../support/owned-rows'
import { conflict } from '../support/responses'
import { useIntegrationApp } from '../support/use-integration-app'

/** The route that deletes the signed-in user. */
const DELETION = '/api/users/me/deletion'

describe('isolation of the users', () => {
  const { as, anonymous, world, snapshot, unchanged } = useIntegrationApp()

  it('turns a request without a token away and deletes nothing', async () => {
    const { a } = world()

    await unchanged(() => anonymous().post(DELETION, { confirm: a.email }).expect(401))
  })

  describe('POST /api/users/me/deletion', () => {
    it('deletes the caller and leaves every row of the other user exactly as it was, updatedAt included', async () => {
      const { a, b } = world()
      const before = await snapshot()

      await as(a).post(DELETION, { confirm: a.email }).expect(204)

      const after = await snapshot()
      expect(ownedRows(after, b.userId)).toStrictEqual(ownedRows(before, b.userId))
      expect(ownedRows(before, b.userId).transactions).toHaveLength(4) // the comparison is not of two empty lists
    })

    it('deletes the other user for their own token, and leaves the caller as they were (control)', async () => {
      const { a, b } = world()
      const before = await snapshot()

      await as(b).post(DELETION, { confirm: b.email }).expect(204)

      expect(ownedRows(await snapshot(), a.userId)).toStrictEqual(ownedRows(before, a.userId))
    })

    it('refuses the email of the other user as the confirmation: a 409 and nothing deleted for either', async () => {
      const { a, b } = world()

      const response = await unchanged(() => as(a).post(DELETION, { confirm: b.email }).expect(409))

      expect(response.body).toStrictEqual(conflict('Confirmation does not match the email of the user'))
    })

    it('cannot pick the user in the body: an id of the other user there is dropped, the caller is deleted', async () => {
      const { a, b } = world()
      const before = await snapshot()

      await as(a).post(DELETION, { confirm: a.email, userId: b.userId, id: b.userId }).expect(204)

      const after = await snapshot()
      expect(ownedRows(after, b.userId)).toStrictEqual(ownedRows(before, b.userId))
      expect(after.users.map(({ id }) => id)).toStrictEqual([b.userId])
    })

    it('leaves the other user the same accounts, balances, categories and dashboard through the API', async () => {
      const { a, b } = world()
      const paths = [
        '/api/accounts',
        '/api/categories',
        '/api/transactions',
        '/api/dashboard?period=1y',
        '/api/users/me',
      ]
      const read = async (): Promise<unknown[]> => {
        const bodies: unknown[] = []

        // One request at a time, like every integration spec.
        for (const path of paths) {
          const response = await as(b).get(path).expect(200)
          bodies.push(response.body)
        }

        return bodies
      }
      const before = await read()

      await as(a).post(DELETION, { confirm: a.email }).expect(204)

      expect(await read()).toStrictEqual(before)
    })
  })
})
