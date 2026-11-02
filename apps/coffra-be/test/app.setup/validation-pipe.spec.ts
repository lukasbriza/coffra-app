import { describe, expect, it } from 'vitest'

import { useHttpApp } from './setup'

describe('the global ValidationPipe', () => {
  const app = useHttpApp()

  it('rejects an invalid body with 400', async () => {
    await app.post('/api/echo', { name: 'a', count: 'abc' }).expect(400)
  })

  it('strips unknown properties and transforms types', async () => {
    const response = await app.post('/api/echo', { name: 'a', count: '5', extra: true }).expect(201)

    expect(response.body).toEqual({ name: 'a', count: 5 })
  })
})
