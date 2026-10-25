import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { TransactionType, TransferDirection } from '../../../../../src/modules/prisma'

import { ACCOUNT_ID, expense, group, income, OWNED, OWNER, totalsQuery, useAccountsService, VIEW } from './setup'

describe('AccountsService.findOne', () => {
  const { service, findFirst, groupBy } = useAccountsService()

  it('looks the account up by its id within the rows of the owner', async () => {
    await service.findOne(OWNER, ACCOUNT_ID, {})

    expect(findFirst).toHaveBeenCalledExactlyOnceWith({ where: OWNED })
  })

  it('returns the view of the account; without transactions the balance is the opening balance', async () => {
    await expect(service.findOne(OWNER, ACCOUNT_ID, {})).resolves.toStrictEqual(VIEW)
  })

  it('adds up the transactions of the account into its balance', async () => {
    groupBy.mockResolvedValue([
      income('5000.3'),
      expense('1200.25'),
      group(TransactionType.transfer, '300', TransferDirection.in),
      group(TransactionType.transfer, '100', TransferDirection.out),
    ])

    // 1250.5 + 5000.3 - 1200.25 + 300 - 100
    await expect(service.findOne(OWNER, ACCOUNT_ID, {})).resolves.toStrictEqual({ ...VIEW, balance: '5250.5500' })
  })

  it('aggregates this account only, within the owner scope, up to the end of today (UTC)', async () => {
    await service.findOne(OWNER, ACCOUNT_ID, {})

    expect(groupBy).toHaveBeenCalledExactlyOnceWith(totalsQuery([ACCOUNT_ID]))
  })

  it('counts up to the day asked for, inclusive', async () => {
    await service.findOne(OWNER, ACCOUNT_ID, { asOf: '2026-10-19' })

    expect(groupBy).toHaveBeenCalledExactlyOnceWith(totalsQuery([ACCOUNT_ID], new Date('2026-10-19T00:00:00.000Z')))
  })

  it('answers 404 Account not found when the scoped query finds nothing (missing or foreign)', async () => {
    findFirst.mockResolvedValue(null)

    const error = await service.findOne(OWNER, ACCOUNT_ID, {}).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).getResponse()).toStrictEqual({
      statusCode: 404,
      message: 'Account not found',
      error: 'Not Found',
    })
  })

  it('does not aggregate for an account the owner does not have', async () => {
    findFirst.mockResolvedValue(null)

    await service.findOne(OWNER, ACCOUNT_ID, {}).catch(() => {
      // the 404 is asserted above
    })

    expect(groupBy).not.toHaveBeenCalled()
  })
})
