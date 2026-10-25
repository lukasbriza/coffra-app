import { HttpStatus, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { useOwnershipService } from './setup'

describe('OwnershipService.orNotFound', () => {
  const { service } = useOwnershipService()

  it('hands back the row a scoped query found, unchanged', () => {
    const row = { id: '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d', name: 'Cash' }

    expect(service().orNotFound(row, 'Account')).toBe(row)
  })

  it('turns a missing row into a 404 named after the resource', () => {
    expect(() => service().orNotFound(null, 'Account')).toThrow(NotFoundException)

    try {
      service().orNotFound(null, 'Category')
      expect.unreachable('orNotFound must throw on null')
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException)
      expect((error as NotFoundException).getStatus()).toBe(HttpStatus.NOT_FOUND)
      expect((error as NotFoundException).getResponse()).toStrictEqual({
        statusCode: 404,
        message: 'Category not found',
        error: 'Not Found',
      })
    }
  })
})
