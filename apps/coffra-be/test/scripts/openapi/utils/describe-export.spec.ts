import { describe, expect, it } from 'vitest'

import { describeExport } from '../../../../scripts/openapi/utils/describe-export'

describe('describeExport', () => {
  it('names the number of operations and the file', () => {
    expect(describeExport(25, '../../packages/coffra-api/src/schema.json')).toBe(
      'Wrote the OpenAPI document (25 operations) to ../../packages/coffra-api/src/schema.json',
    )
  })

  it('says operation for one', () => {
    expect(describeExport(1, 'openapi.json')).toBe('Wrote the OpenAPI document (1 operation) to openapi.json')
  })
})
