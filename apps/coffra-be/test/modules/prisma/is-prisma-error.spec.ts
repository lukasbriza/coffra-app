import { describe, expect, it } from 'vitest'

import { isPrismaError, Prisma, PrismaErrorCode } from '../../../src/modules/prisma'

const prismaError = (code: string): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('query failed', { code, clientVersion: '7.8.0' })

describe('isPrismaError', () => {
  it('matches a known Prisma error with the given code', () => {
    expect(isPrismaError(prismaError('P2003'), PrismaErrorCode.ForeignKeyViolation)).toBe(true)
    expect(isPrismaError(prismaError('P2025'), PrismaErrorCode.RecordNotFound)).toBe(true)
    expect(isPrismaError(prismaError('P2002'), PrismaErrorCode.UniqueViolation)).toBe(true)
  })

  it('does not match a known Prisma error with another code', () => {
    expect(isPrismaError(prismaError('P2025'), PrismaErrorCode.ForeignKeyViolation)).toBe(false)
  })

  it('does not match another error carrying the same code', () => {
    const lookalike = Object.assign(new Error('query failed'), { code: 'P2003' })

    expect(isPrismaError(lookalike, PrismaErrorCode.ForeignKeyViolation)).toBe(false)
  })

  it.each([undefined, null, 'P2003', { code: 'P2003' }])('does not match %j', (value) => {
    expect(isPrismaError(value, PrismaErrorCode.ForeignKeyViolation)).toBe(false)
  })
})
