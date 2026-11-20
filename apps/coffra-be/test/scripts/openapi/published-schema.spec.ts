import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../scripts/openapi/build-open-api-document'
import { serializeOpenApi } from '../../../scripts/openapi/serialize-open-api'
import { AppModule } from '../../../src/app.module'

/** The contract the frontends use: the document of this app, committed in the API package. */
const PUBLISHED_SCHEMA = path.join(__dirname, '../../../../../packages/coffra-api/src/schema.json')

/** What to do when the contract is behind the code. */
const UPDATE_HINT =
  'The API changed: run `pnpm --filter @lukasbriza/coffra-api api-schema:update` and commit both schemas'

describe('the published API contract', () => {
  it('is the OpenAPI document of this code', async () => {
    const document = await buildOpenApiDocument(AppModule)
    const expected = serializeOpenApi(document)
    const published = readFileSync(PUBLISHED_SCHEMA, 'utf8')

    // The parsed comparison shows what changed; the text one also catches formatting and line endings.
    expect(JSON.parse(published), UPDATE_HINT).toStrictEqual(JSON.parse(expected))
    expect(published, UPDATE_HINT).toBe(expected)
  }, 30_000)
})
