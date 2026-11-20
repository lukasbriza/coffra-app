import type { OpenAPIObject } from '@nestjs/swagger'
import { describe, expect, it } from 'vitest'

import { serializeOpenApi } from '../../../scripts/openapi/serialize-open-api'

/** A small document whose keys are out of order at every depth. */
const DOCUMENT: OpenAPIObject = {
  paths: {
    '/b': {
      post: { responses: { '404': { description: 'Missing' }, '201': { description: 'Created' } } },
      get: {
        responses: { '200': { description: 'OK' } },
        parameters: [
          { name: 'z', in: 'query' },
          { name: 'a', in: 'query' },
        ],
      },
    },
    '/a': { get: { responses: { '200': { description: 'OK' } } } },
  },
  openapi: '3.0.0',
  info: { version: '1.0', title: 'Probe' },
  components: {
    schemas: {
      Probe: {
        type: 'object',
        required: ['zeta', 'alpha'],
        properties: { zeta: { type: 'string', enum: ['z', 'a'] }, alpha: { type: 'string' } },
      },
    },
  },
}

/**
 * The same document with every key inserted in another order.
 *
 * @returns a document deeply equal to `DOCUMENT`
 */
const reordered = (): OpenAPIObject => ({
  info: { title: 'Probe', version: '1.0' },
  components: {
    schemas: {
      Probe: {
        properties: { alpha: { type: 'string' }, zeta: { enum: ['z', 'a'], type: 'string' } },
        required: ['zeta', 'alpha'],
        type: 'object',
      },
    },
  },
  openapi: '3.0.0',
  paths: {
    '/a': { get: { responses: { '200': { description: 'OK' } } } },
    '/b': {
      get: {
        parameters: [
          { in: 'query', name: 'z' },
          { in: 'query', name: 'a' },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: { responses: { '201': { description: 'Created' }, '404': { description: 'Missing' } } },
    },
  },
})

describe('serializeOpenApi', () => {
  it('sorts the keys at every depth', () => {
    const parsed = JSON.parse(serializeOpenApi(DOCUMENT)) as OpenAPIObject

    expect(Object.keys(parsed)).toStrictEqual(['components', 'info', 'openapi', 'paths'])
    expect(Object.keys(parsed.paths)).toStrictEqual(['/a', '/b'])
    expect(Object.keys(parsed.paths['/b'])).toStrictEqual(['get', 'post'])
    expect(Object.keys(parsed.paths['/b'].get ?? {})).toStrictEqual(['parameters', 'responses'])
    expect(Object.keys(parsed.components?.schemas?.Probe ?? {})).toStrictEqual(['properties', 'required', 'type'])
  })

  it('keeps the order of arrays', () => {
    const parsed = JSON.parse(serializeOpenApi(DOCUMENT)) as OpenAPIObject

    expect(parsed.components?.schemas?.Probe).toMatchObject({
      required: ['zeta', 'alpha'],
      properties: { zeta: { enum: ['z', 'a'] } },
    })
    expect(parsed.paths['/b'].get?.parameters).toStrictEqual([
      { in: 'query', name: 'z' },
      { in: 'query', name: 'a' },
    ])
  })

  it('gives the same text for the same document, whatever order its keys were inserted in', () => {
    expect(serializeOpenApi(reordered())).toBe(serializeOpenApi(DOCUMENT))
  })

  it(String.raw`indents with two spaces, uses \n only and ends with one \n`, () => {
    const text = serializeOpenApi(DOCUMENT)

    expect(text.split('\n', 2)[1]).toBe('  "components": {')
    expect(text).not.toContain('\r')
    expect(text.endsWith('}\n')).toBe(true)
  })

  it('writes the document it was given and leaves it as it was', () => {
    const before = JSON.stringify(DOCUMENT)
    const text = serializeOpenApi(DOCUMENT)

    expect(JSON.parse(text)).toStrictEqual(DOCUMENT)
    expect(JSON.stringify(DOCUMENT)).toBe(before)
  })
})
