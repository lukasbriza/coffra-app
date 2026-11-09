import { describe, expect, it } from 'vitest'

import { operationsOf, PUBLIC_ROUTES, useAppDocument } from './setup'

describe('the security of the OpenAPI document of the app', () => {
  const app = useAppDocument()

  it('declares the bearer scheme', () => {
    expect(app.document().components?.securitySchemes).toMatchObject({ bearer: { type: 'http', scheme: 'bearer' } })
  })

  it('requires the bearer token on the whole API', () => {
    expect(app.document().security).toStrictEqual([{ bearer: [] }])
  })

  it('has exactly the public routes of the API', () => {
    const publicRoutes = app
      .routes()
      .filter(({ isPublic }) => isPublic)
      .map(({ route }) => route)

    expect(publicRoutes.toSorted()).toStrictEqual(PUBLIC_ROUTES)
  })

  it('clears the requirement with an empty one on the public routes, and only there', () => {
    const cleared = operationsOf(app.document()).filter(({ security }) => security !== undefined)

    expect(Object.fromEntries(cleared.map(({ route, security }) => [route, security]))).toStrictEqual(
      Object.fromEntries(PUBLIC_ROUTES.map((route) => [route, [{}]])),
    )
  })
})
