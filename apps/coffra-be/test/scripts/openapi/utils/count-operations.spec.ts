import type { OpenAPIObject } from '@nestjs/swagger'
import { describe, expect, it } from 'vitest'

import { countOperations } from '../../../../scripts/openapi/utils/count-operations'

/** An operation with nothing but an answer. */
const OPERATION = { responses: { '200': { description: 'OK' } } }

describe('countOperations', () => {
  it('counts one operation per method of each path, and nothing else of a path', () => {
    const document: OpenAPIObject = {
      openapi: '3.0.0',
      info: { title: 'Probe', version: '1.0' },
      paths: {
        '/a': { get: OPERATION, post: OPERATION, parameters: [], summary: 'not an operation' },
        '/b': { delete: OPERATION },
        '/c': {},
      },
    }

    expect(countOperations(document)).toBe(3)
  })

  it('counts nothing in a document without paths', () => {
    expect(countOperations({ openapi: '3.0.0', info: { title: 'Probe', version: '1.0' }, paths: {} })).toBe(0)
  })
})
