import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { AccountType, Prisma } from '../../../../../src/modules/prisma'

import { ACCOUNT_ID, OWNED, OWNER, prismaError, row, useAccountsService } from './setup'

describe('AccountsService.update', () => {
  const { service, findFirst, update } = useAccountsService()

  it('finds the account within the rows of the owner first, then writes with the same scope', async () => {
    update.mockResolvedValue(row({ name: 'Savings' }))

    await service.update(OWNER, ACCOUNT_ID, { name: 'Savings' })

    expect(findFirst).toHaveBeenCalledExactlyOnceWith({ where: OWNED })
    expect(update).toHaveBeenCalledExactlyOnceWith({ where: OWNED, data: { name: 'Savings' } })
  })

  it('writes only the fields the input has', async () => {
    update.mockResolvedValue(row())

    await service.update(OWNER, ACCOUNT_ID, { type: AccountType.cash, openingBalance: '-20' })

    expect((update.mock.calls[0]?.[0] as { data: unknown }).data).toStrictEqual({
      type: 'cash',
      openingBalance: '-20',
    })
  })

  it('never writes the currency, even when an input carries one', async () => {
    update.mockResolvedValue(row())
    const input = { name: 'Savings', currency: 'EUR' } as Parameters<typeof service.update>[2]

    await service.update(OWNER, ACCOUNT_ID, input)

    expect((update.mock.calls[0]?.[0] as { data: object }).data).toStrictEqual({ name: 'Savings' })
  })

  it('returns the view of the changed row', async () => {
    update.mockResolvedValue(row({ name: 'Savings', openingBalance: new Prisma.Decimal('-20') }))

    await expect(service.update(OWNER, ACCOUNT_ID, { name: 'Savings', openingBalance: '-20' })).resolves.toStrictEqual({
      id: ACCOUNT_ID,
      name: 'Savings',
      type: 'bank',
      currency: 'CZK',
      openingBalance: '-20.0000',
    })
  })

  it('answers 404 without writing when the scoped query finds nothing (missing or foreign)', async () => {
    findFirst.mockResolvedValue(null)

    await expect(service.update(OWNER, ACCOUNT_ID, { name: 'Savings' })).rejects.toThrow(NotFoundException)
    expect(update).not.toHaveBeenCalled()
  })

  it('answers the same 404 when the account was deleted between the read and the write', async () => {
    update.mockRejectedValue(prismaError('P2025'))

    const error = await service.update(OWNER, ACCOUNT_ID, { name: 'Savings' }).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Account not found')
  })

  it('passes any other error on unchanged', async () => {
    const failure = prismaError('P2003')
    update.mockRejectedValue(failure)

    await expect(service.update(OWNER, ACCOUNT_ID, { name: 'Savings' })).rejects.toBe(failure)
  })
})
