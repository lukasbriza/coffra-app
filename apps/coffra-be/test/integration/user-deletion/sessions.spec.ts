import { describe, expect, it } from 'vitest'

import { AuthTokensService } from '../../../src/modules/core'
import { UsersService } from '../../../src/modules/core/users/users.service'
import { useIntegrationApp } from '../support/use-integration-app'

/** The route that deletes the signed-in user. */
const DELETION = '/api/users/me/deletion'

/** The answer of a token whose user no longer exists. */
const GONE = { statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired access token' }

// What the tokens of a deleted user still do. The server keeps no session (the tokens are stateless): the refresh is
// refused at once, the access token keeps passing the guard until it expires but finds nothing and can create nothing.
// The identity at the provider stays, so the next login creates a new, empty user.
describe('the session of a deleted user', () => {
  const { as, anonymous, world, prisma, app, unchanged } = useIntegrationApp()

  /**
   * Issues a full pair for `a`, the way a login does, and deletes `a` with its access token.
   *
   * @returns the pair, issued before the deletion
   */
  const deleteAWithPair = async () => {
    const { a } = world()
    const pair = await app().get(AuthTokensService).issue(a.userId)

    await as({ token: pair.accessToken }).post(DELETION, { confirm: a.email }).expect(204)

    return pair
  }

  it('refuses the refresh token at once', async () => {
    const { refreshToken } = await deleteAWithPair()

    const response = await anonymous().post('/api/auth/refresh', { refreshToken }).expect(401)

    expect(response.body).toStrictEqual({ ...GONE, message: 'Invalid or expired refresh token' })
  })

  it('answers 401 to GET /api/users/me and to a second deletion, which changes nothing', async () => {
    const { a } = world()
    const { accessToken } = await deleteAWithPair()
    const token = { token: accessToken }

    const me = await as(token).get('/api/users/me').expect(401)
    expect(me.body).toStrictEqual(GONE)
    const again = await unchanged(() => as(token).post(DELETION, { confirm: a.email }).expect(401))
    expect(again.body).toStrictEqual(GONE)
  })

  it('finds nothing with the access token and can create nothing', async () => {
    const { a } = world()
    const { accessToken } = await deleteAWithPair()
    const token = { token: accessToken }

    const accounts = await as(token).get('/api/accounts').expect(200)
    const categories = await as(token).get('/api/categories').expect(200)
    expect([accounts.body, categories.body]).toStrictEqual([[], []])
    await as(token).get(`/api/accounts/${a.accounts.main}`).expect(404)
    await unchanged(() => as(token).post('/api/accounts', { name: 'Back', type: 'bank', currency: 'CZK' }).expect(401))
    await unchanged(() => as(token).post('/api/categories', { name: 'Back' }).expect(401))
  })

  it('lets the same identity log in again as a new, empty user', async () => {
    const { a } = world()
    const { externalSubject } = await prisma().user.findUniqueOrThrow({ where: { id: a.userId } })
    await deleteAWithPair()

    // What the callback does after the identity provider vouched for the user.
    const user = await app().get(UsersService).upsertByExternalSubject({ subject: externalSubject, email: a.email })
    const { accessToken } = await app().get(AuthTokensService).issue(user.id)
    const token = { token: accessToken }

    expect(user.id).not.toBe(a.userId)
    const me = await as(token).get('/api/users/me').expect(200)
    const accounts = await as(token).get('/api/accounts').expect(200)
    expect(me.body).toStrictEqual({ id: user.id, email: a.email })
    expect(accounts.body).toStrictEqual([])
  })

  it('leaves the session of the other user working (control)', async () => {
    const { b } = world()
    await deleteAWithPair()

    const me = await as(b).get('/api/users/me').expect(200)
    expect(me.body).toStrictEqual({ id: b.userId, email: b.email })
  })
})
