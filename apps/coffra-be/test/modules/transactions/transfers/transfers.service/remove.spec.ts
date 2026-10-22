import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { OWNER, PAIR_ID, prismaError, useTransfersService } from './setup'

describe('TransfersService.remove', () => {
  const { service, findMany, deleteMany } = useTransfersService()

  it('deletes both sides in one statement, within the owner scope, without a read before', async () => {
    await expect(service.remove(OWNER, PAIR_ID)).resolves.toBeUndefined()

    expect(deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { transferPairId: PAIR_ID, account: { userId: OWNER.userId } },
    })
    expect(findMany).not.toHaveBeenCalled()
  })

  it('answers 404 when nothing was deleted (missing or foreign)', async () => {
    deleteMany.mockResolvedValue({ count: 0 })

    const error = await service.remove(OWNER, PAIR_ID).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Transfer not found')
  })

  it('passes any error on unchanged: nothing refers to a transaction, so not even a foreign key error', async () => {
    const restricted = prismaError('P2003')
    const plain = new Error('connection lost')
    deleteMany.mockRejectedValueOnce(restricted).mockRejectedValueOnce(plain)

    await expect(service.remove(OWNER, PAIR_ID)).rejects.toBe(restricted)
    await expect(service.remove(OWNER, PAIR_ID)).rejects.toBe(plain)
  })
})
