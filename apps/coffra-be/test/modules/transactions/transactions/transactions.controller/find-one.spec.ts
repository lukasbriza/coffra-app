import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { OWNER, TRANSACTION_ID, useTransactionsController, VIEW } from './setup'

describe('GET /api/transactions/:id', () => {
  const { transactions, send, anonymous, calls } = useTransactionsController()

  it('answers 200 with the transaction', async () => {
    const response = await send('get', `/api/transactions/${TRANSACTION_ID}`).expect(200)

    expect(response.body).toStrictEqual(VIEW)
    expect(transactions.findOne).toHaveBeenCalledExactlyOnceWith(OWNER, TRANSACTION_ID)
  })

  it.each(['abc', '123', `${TRANSACTION_ID}0`, TRANSACTION_ID.replaceAll('-', '')])(
    'answers 400 for the id %j, before the service runs',
    async (id) => {
      const response = await send('get', `/api/transactions/${id}`).expect(400)

      expect((response.body as { message: string }).message).toBe('Validation failed (uuid is expected)')
      expect(calls()).toBe(0)
    },
  )

  it('passes the 404 of a missing or foreign transaction through unchanged', async () => {
    transactions.findOne.mockRejectedValue(new NotFoundException('Transaction not found'))

    const response = await send('get', `/api/transactions/${TRANSACTION_ID}`).expect(404)

    expect(response.body).toStrictEqual({ statusCode: 404, message: 'Transaction not found', error: 'Not Found' })
  })

  it('answers 401 without a token, before the id is checked', async () => {
    await anonymous('get', '/api/transactions/abc').expect(401)

    expect(calls()).toBe(0)
  })
})
