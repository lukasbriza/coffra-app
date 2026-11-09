import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../../scripts/openapi/build-open-api-document'
import { serializeOpenApi } from '../../../../scripts/openapi/serialize-open-api'
import { AppModule } from '../../../../src/app.module'

describe('the OpenAPI document of the app', () => {
  it('is the same text for two builds of the same code', async () => {
    const first = await buildOpenApiDocument(AppModule)
    const second = await buildOpenApiDocument(AppModule)

    expect(serializeOpenApi(second)).toBe(serializeOpenApi(first))
  }, 30_000)
})
