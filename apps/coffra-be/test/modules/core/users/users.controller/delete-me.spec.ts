import { ConflictException, UnauthorizedException } from '@nestjs/common'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { useUsersController, user } from './setup'

type ErrorBody = { statusCode: number; message: string[] | string }

describe('POST /api/users/me/deletion', () => {
  const { deleteUser, deleteMe, server, session } = useUsersController()

  /** A bearer header of a fresh session of the user. */
  const bearer = async (userId = user.id): Promise<string> => {
    const { accessToken } = await session(userId)

    return `Bearer ${accessToken}`
  }

  it('answers 204 with no body', async () => {
    const response = await deleteMe({ confirm: user.email }, await bearer()).expect(204)

    expect(response.text).toBe('')
  })

  it('deletes the user of the token with the confirmation of the body', async () => {
    await deleteMe({ confirm: user.email }, await bearer()).expect(204)

    expect(deleteUser).toHaveBeenCalledExactlyOnceWith(user.id, expect.objectContaining({ confirm: user.email }))
  })

  it('never lets the body choose the user: an id in the body is dropped, the one of the token is used', async () => {
    const foreign = '7d1c2b9a-5e4f-4a3b-8c2d-1e0f9a8b7c62'

    await deleteMe({ confirm: user.email, userId: foreign, id: foreign }, await bearer()).expect(204)

    const [userId, input] = deleteUser.mock.calls[0] ?? []
    expect(userId).toBe(user.id)
    expect({ ...input }).toStrictEqual({ confirm: user.email }) // own properties of the DTO instance only
  })

  it('passes the confirmation on exactly as sent, without trimming or changing its case', async () => {
    await deleteMe({ confirm: ' DEV@coffra.local ' }, await bearer()).expect(204)

    expect(deleteUser.mock.calls[0]?.[1].confirm).toBe(' DEV@coffra.local ')
  })

  it.each([
    ['no body', undefined],
    ['no confirmation', {}],
    ['an empty confirmation', { confirm: '' }],
    ['a null confirmation', { confirm: null }],
    ['a confirmation that is a number', { confirm: 42 }],
    ['a confirmation that is a list', { confirm: [user.email] }],
    ['a confirmation of 321 characters', { confirm: 'a'.repeat(321) }],
  ])('answers 400 for %s, before the service runs', async (_name, body) => {
    const response = await deleteMe(body, await bearer()).expect(400)

    expect((response.body as ErrorBody).statusCode).toBe(400)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it.each([
    ['a number', 42],
    ['a list', [user.email]],
    ['an object', { email: user.email }],
  ])('tells the client that a confirmation which is %s must be a string', async (_name, confirm) => {
    const response = await deleteMe({ confirm }, await bearer()).expect(400)

    expect((response.body as ErrorBody).message).toContain('confirm must be a string')
  })

  it('accepts a confirmation of 320 characters (the service compares it)', async () => {
    await deleteMe({ confirm: 'a'.repeat(320) }, await bearer()).expect(204)
  })

  it('passes the 409 of a confirmation that is not the email through unchanged', async () => {
    deleteUser.mockRejectedValue(new ConflictException('Confirmation does not match the email of the user'))

    const response = await deleteMe({ confirm: 'other@coffra.local' }, await bearer()).expect(409)

    expect(response.body).toStrictEqual({
      statusCode: 409,
      message: 'Confirmation does not match the email of the user',
      error: 'Conflict',
    })
  })

  it('passes the 401 of a user that no longer exists through', async () => {
    deleteUser.mockRejectedValue(new UnauthorizedException('Invalid or expired access token'))

    const response = await deleteMe({ confirm: user.email }, await bearer()).expect(401)

    expect((response.body as ErrorBody).message).toBe('Invalid or expired access token')
  })

  it('answers 401 without a token and deletes nothing', async () => {
    await deleteMe({ confirm: user.email }).expect(401)

    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('answers 401 for a refresh token and deletes nothing', async () => {
    const { refreshToken } = await session()

    await deleteMe({ confirm: user.email }, `Bearer ${refreshToken}`).expect(401)

    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('is a POST: DELETE /api/users/me is no route, so a body a client may drop never decides anything', async () => {
    // The confirmation travels in a body, which OpenAPI 3.0 tells clients to ignore on a DELETE.
    await request(server())
      .delete('/api/users/me')
      .set('Authorization', await bearer())
      .send({ confirm: user.email })
      .expect(404)

    expect(deleteUser).not.toHaveBeenCalled()
  })
})
