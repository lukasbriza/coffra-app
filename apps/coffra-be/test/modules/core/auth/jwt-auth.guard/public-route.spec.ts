import { describe, expect, it, vi } from 'vitest'

import { AuthTokensService } from '../../../../../src/modules/core/auth/auth-tokens.service'

import { ACCESS_SECRET, base64Url, handler, nowSeconds, useJwtAuthGuard, USER_ID } from './setup'

describe('JwtAuthGuard on a public route', () => {
  const { application, get, jwt } = useJwtAuthGuard()

  // A route marked on its method, and a controller marked as a whole.
  it.each(['/api/probe/open', '/api/open-class'])('lets %s through without a token', async (path) => {
    await get(path).expect(200, { open: true })

    expect(handler).toHaveBeenCalledOnce()
  })

  it.each(['/api/probe/open', '/api/open-class'])('lets %s through with a token that is not valid', async (path) => {
    const expired = await jwt().signAsync({ sub: USER_ID, exp: nowSeconds() - 10 }, { secret: ACCESS_SECRET })

    await get(path, `Bearer ${expired}`).expect(200)
    await get(path, 'Bearer not-a-jwt').expect(200)
    await get(path, `Bearer ${base64Url({ nonsense: true })}`).expect(200)
  })

  it('does not check any token, and does not set the header that marks a rejection', async () => {
    const verifyAccess = vi.spyOn(application().get(AuthTokensService), 'verifyAccess')

    const response = await get('/api/probe/open', 'Bearer not-a-jwt').expect(200)

    expect(verifyAccess).not.toHaveBeenCalled()
    expect(response.headers['www-authenticate']).toBeUndefined()
  })

  it('leaves the neighbouring route protected', async () => {
    await get('/api/probe').expect(401)
  })
})
