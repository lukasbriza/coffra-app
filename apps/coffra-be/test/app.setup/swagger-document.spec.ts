import { describe, expect, it } from 'vitest'

import { buildSwaggerDocument } from '../../src/swagger.setup'

import { useHttpApp } from './setup'

describe('the OpenAPI document and the Swagger UI', () => {
  const app = useHttpApp({ swagger: true })

  it('declares the bearer security scheme', () => {
    const document = buildSwaggerDocument(app.app())

    expect(document.components?.securitySchemes).toMatchObject({ bearer: { type: 'http', scheme: 'bearer' } })
  })

  it('requires the bearer token on every operation unless it is public', () => {
    const { paths, security } = buildSwaggerDocument(app.app())

    expect(security).toEqual([{ bearer: [] }])
    expect(paths['/api/echo'].post?.security).toBeUndefined()
  })

  it('shows no lock on a public operation', () => {
    expect(buildSwaggerDocument(app.app()).paths['/api/health'].get?.security).toEqual([{}])
  })

  it('tells the reader about the limit and the answers it gives', () => {
    const { description } = buildSwaggerDocument(app.app()).info

    expect(description).toContain('429')
    expect(description).toContain('503')
  })

  it('serves the UI on /api/swagger', async () => {
    await app.get('/api/swagger').expect(200)
  })
})
