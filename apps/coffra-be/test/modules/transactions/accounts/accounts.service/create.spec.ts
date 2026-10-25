import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { AccountType, Prisma } from '../../../../../src/modules/prisma'

import { OWNER, prismaError, row, useAccountsService, VIEW } from './setup'

const INPUT = { name: 'Main account', type: AccountType.bank, currency: 'CZK', openingBalance: '1250.5' }

describe('AccountsService.create', () => {
  const { service, create, groupBy } = useAccountsService()

  it('writes the listed fields and the owner from the ownership layer, nothing else', async () => {
    create.mockResolvedValue(row())

    await service.create(OWNER, INPUT)

    expect(create).toHaveBeenCalledExactlyOnceWith({
      data: { name: 'Main account', type: 'bank', currency: 'CZK', openingBalance: '1250.5', userId: OWNER.userId },
    })
  })

  it('never writes tenantId', async () => {
    create.mockResolvedValue(row())

    await service.create(OWNER, INPUT)

    expect((create.mock.calls[0]?.[0] as { data: object }).data).not.toHaveProperty('tenantId')
  })

  it('leaves openingBalance to the column default when the input has none', async () => {
    create.mockResolvedValue(row({ openingBalance: new Prisma.Decimal(0) }))

    const view = await service.create(OWNER, { name: 'Wallet', type: AccountType.cash, currency: 'EUR' })

    expect((create.mock.calls[0]?.[0] as { data: object }).data).not.toHaveProperty('openingBalance')
    expect(view.openingBalance).toBe('0.0000')
    expect(view.balance).toBe('0.0000')
  })

  it('returns the view of the created row', async () => {
    create.mockResolvedValue(row())

    await expect(service.create(OWNER, INPUT)).resolves.toStrictEqual(VIEW)
  })

  it('gives a negative opening balance as the balance, and aggregates nothing: a new account has no transactions', async () => {
    create.mockResolvedValue(row({ openingBalance: new Prisma.Decimal('-1500.25') }))

    const view = await service.create(OWNER, { ...INPUT, openingBalance: '-1500.25' })

    expect(view.balance).toBe('-1500.2500')
    expect(groupBy).not.toHaveBeenCalled()
  })

  it('answers 401 when the owner no longer exists (foreign key to the user)', async () => {
    create.mockRejectedValue(prismaError('P2003'))

    const error = await service.create(OWNER, INPUT).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(UnauthorizedException)
    expect((error as UnauthorizedException).message).toBe('Invalid or expired access token')
  })

  it('passes any other error on unchanged', async () => {
    const unique = prismaError('P2002')
    const plain = new Error('connection lost')

    create.mockRejectedValueOnce(unique).mockRejectedValueOnce(plain)

    await expect(service.create(OWNER, INPUT)).rejects.toBe(unique)
    await expect(service.create(OWNER, INPUT)).rejects.toBe(plain)
  })
})
