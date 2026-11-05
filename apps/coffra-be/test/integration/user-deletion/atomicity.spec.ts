import { randomUUID } from 'node:crypto'

import { afterEach, describe, it } from 'vitest'

import { TransactionType } from '../../../src/modules/prisma'
import { parseIsoDate } from '../../../src/utils'
import { useIntegrationApp } from '../support/use-integration-app'

/** The route that deletes the signed-in user. */
const DELETION = '/api/users/me/deletion'

/** A trigger of this spec only, removed after every test. */
const REFUSE_TRIGGER = 'coffra_test_refuse_user_delete'

// The user and all their data go in one database transaction: a failure at any step leaves every row in place. Two
// real failures, no mock: a row of another user that refers to a category of the user (the API never writes one, the
// database allows it) stops the deletion half way, after the transactions and the accounts of the user are gone; a
// trigger on `User` stops it at the last step, after all the data of the user is gone.
describe('deleting a user is all or nothing', () => {
  const { as, world, prisma, unchanged, expectErrors } = useIntegrationApp()

  afterEach(async () => {
    await prisma().$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${REFUSE_TRIGGER} ON "User"`)
    await prisma().$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${REFUSE_TRIGGER}()`)
  })

  /**
   * Writes an expense of `b` on its own account with a category of `a`.
   *
   * @returns the id of that transaction
   */
  const foreignReference = async (): Promise<string> => {
    const { a, b } = world()
    const id = randomUUID()

    await prisma().transaction.create({
      data: {
        id,
        accountId: b.accounts.main,
        type: TransactionType.expense,
        amount: '1',
        date: parseIsoDate('2026-01-20'),
        categoryId: a.categories.unused,
      },
    })

    return id
  }

  /** Makes every delete of a `User` row fail, inside the database. */
  const refuseUserDelete = async (): Promise<void> => {
    await prisma().$executeRawUnsafe(
      `CREATE FUNCTION ${REFUSE_TRIGGER}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'refused by the spec'; END $$`,
    )
    await prisma().$executeRawUnsafe(
      `CREATE TRIGGER ${REFUSE_TRIGGER} BEFORE DELETE ON "User" FOR EACH ROW EXECUTE FUNCTION ${REFUSE_TRIGGER}()`,
    )
  }

  it('keeps everything when a row of another user still refers to a category of the user (half way)', async () => {
    const { a } = world()
    await foreignReference()
    expectErrors()

    await unchanged(() => as(a).post(DELETION, { confirm: a.email }).expect(500))
  })

  it('deletes the user once that row is gone (control)', async () => {
    const { a } = world()
    const id = await foreignReference()
    await prisma().transaction.delete({ where: { id } })

    await as(a).post(DELETION, { confirm: a.email }).expect(204)
  })

  it('keeps everything when the user row itself cannot be deleted (the last step)', async () => {
    const { a } = world()
    await refuseUserDelete()
    expectErrors()

    await unchanged(() => as(a).post(DELETION, { confirm: a.email }).expect(500))
  })

  it('deletes the user once the trigger is gone (control)', async () => {
    const { a } = world()
    await refuseUserDelete()
    await prisma().$executeRawUnsafe(`DROP TRIGGER ${REFUSE_TRIGGER} ON "User"`)

    await as(a).post(DELETION, { confirm: a.email }).expect(204)
  })
})
