import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { ACCOUNT_ID, OWNED, OWNER, prismaError, row, useAccountsService } from './setup'

describe('AccountsService.remove', () => {
  const { service, findFirst, remove } = useAccountsService()

  it('finds the account within the rows of the owner first, then deletes with the same scope', async () => {
    remove.mockResolvedValue(row())

    await expect(service.remove(OWNER, ACCOUNT_ID)).resolves.toBeUndefined()

    expect(findFirst).toHaveBeenCalledExactlyOnceWith({ where: OWNED })
    expect(remove).toHaveBeenCalledExactlyOnceWith({ where: OWNED })
  })

  it('answers 404 without deleting when the scoped query finds nothing (missing or foreign)', async () => {
    findFirst.mockResolvedValue(null)

    await expect(service.remove(OWNER, ACCOUNT_ID)).rejects.toThrow(NotFoundException)
    expect(remove).not.toHaveBeenCalled()
  })

  it('answers 409 when the account still has transactions (the Restrict of the database)', async () => {
    remove.mockRejectedValue(prismaError('P2003'))

    const error = await service.remove(OWNER, ACCOUNT_ID).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(ConflictException)
    expect((error as ConflictException).message).toBe('Account has transactions and cannot be deleted')
  })

  it('answers the same 404 when the account was deleted between the read and the delete', async () => {
    remove.mockRejectedValue(prismaError('P2025'))

    const error = await service.remove(OWNER, ACCOUNT_ID).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Account not found')
  })

  it('passes any other error on unchanged', async () => {
    const failure = new Error('connection lost')
    remove.mockRejectedValue(failure)

    await expect(service.remove(OWNER, ACCOUNT_ID)).rejects.toBe(failure)
  })
})
