import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { OWNER, TRANSACTION_ID, useTransactionsController } from './setup'

const PATH = `/api/transactions/${TRANSACTION_ID}`

describe('DELETE /api/transactions/:id', () => {
  const { transactions, send, anonymous, calls } = useTransactionsController()

  it('answers 204 with an empty body', async () => {
    const response = await send('delete', PATH).expect(204)

    expect(response.text).toBe('')
    expect(transactions.remove).toHaveBeenCalledExactlyOnceWith(OWNER, TRANSACTION_ID)
  })

  it('passes the 409 of one side of a transfer through unchanged', async () => {
    transactions.remove.mockRejectedValue(
      new ConflictException('Transaction is part of a transfer and cannot be changed here'),
    )

    const response = await send('delete', PATH).expect(409)

    expect(response.body).toStrictEqual({
      statusCode: 409,
      message: 'Transaction is part of a transfer and cannot be changed here',
      error: 'Conflict',
    })
  })

  it('passes the 404 of a missing or foreign transaction through unchanged', async () => {
    transactions.remove.mockRejectedValue(new NotFoundException('Transaction not found'))

    await send('delete', PATH).expect(404)
  })

  it('answers 400 for an id that is not a UUID', async () => {
    await send('delete', '/api/transactions/abc').expect(400)

    expect(calls()).toBe(0)
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('delete', PATH).expect(401)

    expect(calls()).toBe(0)
  })
})
