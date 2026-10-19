import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { ACCOUNT_ID, OWNED, OWNER, useAccountsService, VIEW } from './setup'

describe('AccountsService.findOne', () => {
  const { service, findFirst } = useAccountsService()

  it('looks the account up by its id within the rows of the owner', async () => {
    await service.findOne(OWNER, ACCOUNT_ID)

    expect(findFirst).toHaveBeenCalledExactlyOnceWith({ where: OWNED })
  })

  it('returns the view of the account', async () => {
    await expect(service.findOne(OWNER, ACCOUNT_ID)).resolves.toStrictEqual(VIEW)
  })

  it('answers 404 Account not found when the scoped query finds nothing (missing or foreign)', async () => {
    findFirst.mockResolvedValue(null)

    const error = await service.findOne(OWNER, ACCOUNT_ID).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).getResponse()).toStrictEqual({
      statusCode: 404,
      message: 'Account not found',
      error: 'Not Found',
    })
  })
})
