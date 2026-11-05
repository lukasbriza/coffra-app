import { ConflictException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { USER, useUserDeletionService } from './setup'

describe('UserDeletionService.delete: the confirmation', () => {
  const { service, log, erasers, tx } = useUserDeletionService()

  it.each([
    ['another email', 'other@coffra.local'],
    ['the email in other letter case', 'DEV@coffra.local'],
    ['the email with a space around it', ' dev@coffra.local '],
    ['a part of the email', 'dev@coffra'],
    ['the id of the user', USER.id],
  ])('refuses %s with a 409 and deletes nothing', async (_name, confirm) => {
    const failure = service().delete(USER.id, { confirm })

    await expect(failure).rejects.toThrow(ConflictException)
    await expect(failure).rejects.toThrow('Confirmation does not match the email of the user')
    expect(log).toStrictEqual(['transaction', 'findUnique'])
    expect(erasers.transactions.eraseOwnerData).not.toHaveBeenCalled()
    expect(tx.user.delete).not.toHaveBeenCalled()
  })

  it('compares with the email stored now, not with one the client knew before', async () => {
    tx.user.findUnique.mockResolvedValue({ ...USER, email: 'renamed@coffra.local' })

    await expect(service().delete(USER.id, { confirm: USER.email })).rejects.toThrow(ConflictException)
    await service().delete(USER.id, { confirm: 'renamed@coffra.local' })

    expect(tx.user.delete).toHaveBeenCalledOnce()
  })
})
