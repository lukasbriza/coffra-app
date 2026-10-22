import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { OWNER, PAIR_ID, useTransfersController } from './setup'

const PATH = `/api/transfers/${PAIR_ID}`

describe('DELETE /api/transfers/:pairId', () => {
  const { transfers, send, anonymous, calls } = useTransfersController()

  it('answers 204 with an empty body', async () => {
    const response = await send('delete', PATH).expect(204)

    expect(response.text).toBe('')
    expect(transfers.remove).toHaveBeenCalledExactlyOnceWith(OWNER, PAIR_ID)
  })

  it('passes the 404 of a missing or foreign transfer through unchanged', async () => {
    transfers.remove.mockRejectedValue(new NotFoundException('Transfer not found'))

    const response = await send('delete', PATH).expect(404)

    expect(response.body).toStrictEqual({ statusCode: 404, message: 'Transfer not found', error: 'Not Found' })
  })

  it('answers 400 for a pairId that is not a UUID', async () => {
    await send('delete', '/api/transfers/abc').expect(400)

    expect(calls()).toBe(0)
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('delete', PATH).expect(401)

    expect(calls()).toBe(0)
  })
})
