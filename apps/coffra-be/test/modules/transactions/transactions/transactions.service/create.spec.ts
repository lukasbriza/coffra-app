import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_ID,
  accountRead,
  CATEGORY_ID,
  categoryRead,
  INPUT,
  OWNER,
  prismaError,
  useTransactionsService,
  VIEW,
} from './setup'

const notFound = async (promise: Promise<unknown>): Promise<string> => {
  const error = await promise.catch((error_: unknown) => error_)

  expect(error).toBeInstanceOf(NotFoundException)
  return (error as NotFoundException).message
}

describe('TransactionsService.create', () => {
  const { service, create, findAccount, findCategory } = useTransactionsService()

  it('reads the account and the category of the input within the owner scope', async () => {
    await service.create(OWNER, INPUT)

    expect(findAccount).toHaveBeenCalledExactlyOnceWith(accountRead(ACCOUNT_ID))
    expect(findCategory).toHaveBeenCalledExactlyOnceWith(categoryRead(CATEGORY_ID))
  })

  it('asks for the account and the category at once, not one after the other', () => {
    findAccount.mockReturnValue(
      new Promise(() => {
        // never answers: the category must be asked for all the same
      }),
    )

    void service.create(OWNER, INPUT)

    expect(findCategory).toHaveBeenCalledOnce()
  })

  it('writes the fields of the input, the date as midnight UTC, nothing else', async () => {
    await service.create(OWNER, INPUT)

    expect(create).toHaveBeenCalledExactlyOnceWith({
      data: {
        accountId: ACCOUNT_ID,
        type: 'expense',
        amount: '1250.5',
        date: new Date('2026-10-19T00:00:00.000Z'),
        categoryId: CATEGORY_ID,
        note: 'Lunch',
      },
    })
  })

  it('leaves out a category and a note that are not in the input, and does not look for a category', async () => {
    await service.create(OWNER, { accountId: ACCOUNT_ID, type: 'income', amount: '100', date: '2026-10-19' })

    expect((create.mock.calls[0]?.[0] as { data: object }).data).toStrictEqual({
      accountId: ACCOUNT_ID,
      type: 'income',
      amount: '100',
      date: new Date('2026-10-19T00:00:00.000Z'),
    })
    expect(findCategory).not.toHaveBeenCalled()
  })

  it('writes a null category and note as they are, and does not look for a category', async () => {
    await service.create(OWNER, { ...INPUT, categoryId: null, note: null })

    expect((create.mock.calls[0]?.[0] as { data: object }).data).toMatchObject({ categoryId: null, note: null })
    expect(findCategory).not.toHaveBeenCalled()
  })

  it('returns the view of the created row', async () => {
    await expect(service.create(OWNER, INPUT)).resolves.toStrictEqual(VIEW)
  })

  it('answers 404 without writing when the account is not among those of the owner (missing or foreign)', async () => {
    findAccount.mockResolvedValue(null)

    await expect(notFound(service.create(OWNER, INPUT))).resolves.toBe('Account not found')
    expect(create).not.toHaveBeenCalled()
  })

  it('answers 404 without writing when the category is not among those of the owner (missing or foreign)', async () => {
    findCategory.mockResolvedValue(null)

    await expect(notFound(service.create(OWNER, INPUT))).resolves.toBe('Category not found')
    expect(create).not.toHaveBeenCalled()
  })

  it('reports the account first when neither is found, whichever query returns first', async () => {
    findAccount.mockReturnValue(
      new Promise((resolve) =>
        setTimeout(() => {
          resolve(null)
        }, 5),
      ),
    )
    findCategory.mockResolvedValue(null)

    await expect(notFound(service.create(OWNER, INPUT))).resolves.toBe('Account not found')
  })

  it('answers the same 404 when the account was deleted between the check and the write (foreign key)', async () => {
    create.mockRejectedValue(prismaError('P2003'))
    findAccount.mockResolvedValueOnce({ currency: 'CZK' }).mockResolvedValueOnce(null)

    await expect(notFound(service.create(OWNER, INPUT))).resolves.toBe('Account not found')
  })

  it('answers the same 404 when the category was deleted between the check and the write (foreign key)', async () => {
    create.mockRejectedValue(prismaError('P2003'))
    findCategory.mockResolvedValueOnce({ id: CATEGORY_ID }).mockResolvedValueOnce(null)

    await expect(notFound(service.create(OWNER, INPUT))).resolves.toBe('Category not found')
  })

  it('passes the foreign key error on when the account and the category are both still there', async () => {
    const failure = prismaError('P2003')
    create.mockRejectedValue(failure)

    await expect(service.create(OWNER, INPUT)).rejects.toBe(failure)
  })

  it('passes any other error on unchanged, without reading the references again', async () => {
    const gone = prismaError('P2025')
    const plain = new Error('connection lost')
    create.mockRejectedValueOnce(gone).mockRejectedValueOnce(plain)

    await expect(service.create(OWNER, INPUT)).rejects.toBe(gone)
    await expect(service.create(OWNER, INPUT)).rejects.toBe(plain)
    expect(findAccount).toHaveBeenCalledTimes(2)
  })
})
