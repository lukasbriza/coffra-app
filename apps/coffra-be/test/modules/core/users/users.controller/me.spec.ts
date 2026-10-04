import { describe, expect, it } from 'vitest'

import { useUsersController, user } from './setup'

describe('GET /api/users/me', () => {
  const { findById, me, session } = useUsersController()

  it('returns the id and the email of the user the access token was issued to', async () => {
    const { accessToken } = await session()

    const response = await me(`Bearer ${accessToken}`).expect(200)

    expect(response.body).toEqual({ id: user.id, email: user.email })
  })

  it('leaves out everything else about the user', async () => {
    const { accessToken } = await session()

    const response = await me(`Bearer ${accessToken}`).expect(200)

    expect(Object.keys(response.body as object).toSorted()).toEqual(['email', 'id'])
  })

  it('looks the user up by the id in the token', async () => {
    const { accessToken } = await session()

    await me(`Bearer ${accessToken}`).expect(200)

    expect(findById).toHaveBeenCalledExactlyOnceWith(user.id)
  })

  it('answers 401 when the user was deleted while the access token was still valid', async () => {
    findById.mockResolvedValue(null)
    const { accessToken } = await session()

    const response = await me(`Bearer ${accessToken}`).expect(401)

    expect((response.body as { message: string }).message).toBe('Invalid or expired access token')
  })

  it('answers 401 without a token and does not look anything up', async () => {
    await me().expect(401)

    expect(findById).not.toHaveBeenCalled()
  })

  it('answers 401 for a refresh token', async () => {
    const { refreshToken } = await session()

    await me(`Bearer ${refreshToken}`).expect(401)

    expect(findById).not.toHaveBeenCalled()
  })
})
