import { describe, expect, it } from 'vitest'

import { operationsOf, PUBLIC_ROUTES, useAppDocument } from './setup'

describe('the OpenAPI document of the app', () => {
  const app = useAppDocument()

  it('is compared with the routes the controllers declare', () => {
    // Routes that found nothing would make the next test pass for nothing.
    expect(app.routes().map(({ route }) => route)).toEqual(
      expect.arrayContaining([...PUBLIC_ROUTES, 'GET /api/accounts/{id}', 'DELETE /api/transfers/{pairId}']),
    )
  })

  it('lists every route of the app, and nothing else', () => {
    const documented = operationsOf(app.document()).map(({ route }) => route)
    const declared = app.routes().map(({ route }) => route)

    expect(documented.toSorted()).toStrictEqual(declared.toSorted())
  })
})
